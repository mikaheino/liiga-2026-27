"""In-season thaw of team_strength: the challenger model (A/B since 2026-10-25).

The production (champion) model keeps the Poisson side's team ratings frozen at
their pre-season roster prior; current form reaches it only through win-Elo,
which does not separate offence from defence. The challenger blends each
team's prior toward its observed goals-for/against this season, with a weight
that grows with games played:

    w        = n / (n + n0)          n = team's games played this season
    off      = (1 - w) * off_prior + w * gf_pg / league_gf_pg
    def      = (1 - w) * def_prior + w * ga_pg / league_ga_pg

Everything else -- tie calibration, the 40/60 Poisson/Elo blend, Elo itself --
is identical, so an A/B difference is attributable to the thaw alone.

`n0` and the signal (goals or xG) are chosen by `backtest_inseason()`, a
walk-forward replay of the 2023-2026 seasons: every game day is predicted from
the ratings as they stood that morning. Choosing them on past seasons is
allowed; choosing them on 2026-27 games is not (AGENTS.md §10).

    python -m liiga.inseason          # walk-forward backtest, champion vs thaw grid
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import load_config
from .db import get_connection, query_df
from .elo import _ot_rate_before, _regress_ratings, elo_game_probs, train_elo
from .ensemble import ensemble_game_probs
from .model import _ratings_as_of, calibrate_ties, predict_games

# Chosen by the walk-forward backtest on 2023-2026 (see module docstring).
THAW_N0 = 20.0
THAW_SIGNAL = "xg"

_SIGNAL_COLS = {"goals": ("home_goals", "away_goals"),
                "xg": ("home_xg", "away_xg")}


def _opponent_adjust(rows: pd.DataFrame, iters: int = 20) -> pd.DataFrame:
    """Multiplicative off/def fit: a team's for-rate is judged against the
    defences it actually faced, its against-rate against the attacks.
    Alternating updates of gf ~ league * off_team * def_opp, means held at 1."""
    league_pg = rows["gf"].mean()
    off = pd.Series(1.0, index=rows["team"].unique())
    dfn = off.copy()
    for _ in range(iters):
        exp_gf = (league_pg * rows["opp"].map(dfn)).groupby(rows["team"]).sum()
        off = rows.groupby("team")["gf"].sum() / exp_gf
        off /= off.mean()
        exp_ga = (league_pg * rows["opp"].map(off)).groupby(rows["team"]).sum()
        dfn = rows.groupby("team")["ga"].sum() / exp_ga
        dfn /= dfn.mean()
    return pd.DataFrame({"off_obs": off, "def_obs": dfn})


def observed_rates(played: pd.DataFrame, signal: str = THAW_SIGNAL,
                   opp_adjust: bool = False) -> pd.DataFrame:
    """Per-team games, for-rate and against-rate relative to the league mean.

    `played` holds this season's completed games (home_team, away_team and the
    signal's goal columns). xG falls back to goals where it is missing.
    `opp_adjust` corrects for strength of schedule (`_opponent_adjust`).
    """
    hcol, acol = _SIGNAL_COLS[signal]
    h = played[hcol].fillna(played["home_goals"]).astype(float)
    a = played[acol].fillna(played["away_goals"]).astype(float)
    rows = pd.concat([
        pd.DataFrame({"team": played["home_team"], "opp": played["away_team"], "gf": h, "ga": a}),
        pd.DataFrame({"team": played["away_team"], "opp": played["home_team"], "gf": a, "ga": h}),
    ], ignore_index=True)
    agg = rows.groupby("team").agg(n=("gf", "size"), gf=("gf", "sum"), ga=("ga", "sum"))
    if opp_adjust:
        adj = _opponent_adjust(rows).reindex(agg.index)
        return pd.DataFrame({"team": agg.index, "n": agg["n"].values,
                             "off_obs": adj["off_obs"].values,
                             "def_obs": adj["def_obs"].values})
    league_pg = agg["gf"].sum() / agg["n"].sum()      # = league GA per game too
    return pd.DataFrame({"team": agg.index, "n": agg["n"].values,
                         "off_obs": (agg["gf"] / agg["n"] / league_pg).values,
                         "def_obs": (agg["ga"] / agg["n"] / league_pg).values})


def thaw_ratings(prior: pd.DataFrame, played: pd.DataFrame,
                 n0: float = THAW_N0, signal: str = THAW_SIGNAL,
                 n0_def: float | None = None,
                 opp_adjust: bool = False,
                 n0_gk: float | None = None) -> pd.DataFrame:
    """Blend pre-season off/def ratings toward this season's observed rates.
    `n0_def` gives defence its own shrinkage (default: same as offence).
    `n0_gk` adds goaltending: defence is further scaled toward goals allowed /
    xG allowed, shrunk by its own n0 (None = off)."""
    out = prior.copy()
    if played.empty:
        return out
    obs = observed_rates(played, signal, opp_adjust=opp_adjust)
    out = out.merge(obs, on="team", how="left")
    n = out["n"].fillna(0)
    w_off = n / (n + n0)
    w_def = n / (n + (n0 if n0_def is None else n0_def))
    out["off_rating"] = (1 - w_off) * out["off_rating"] + w_off * out["off_obs"].fillna(1.0)
    out["def_rating"] = (1 - w_def) * out["def_rating"] + w_def * out["def_obs"].fillna(1.0)
    if n0_gk is not None:
        gk = goals_vs_xg_allowed(played).reindex(out["team"]).fillna(1.0).to_numpy()
        w_gk = n / (n + n0_gk)
        out["def_rating"] *= 1 + w_gk * (gk - 1)
    return out.drop(columns=["n", "off_obs", "def_obs"])


def goals_vs_xg_allowed(played: pd.DataFrame) -> pd.Series:
    """Per team: goals allowed / xG allowed this season, relative to the
    league's own ratio (>1 = goaltending below the chances faced). Games
    without xG are left out."""
    p = played.dropna(subset=["home_xg", "away_xg"])
    rows = pd.concat([
        pd.DataFrame({"team": p["home_team"], "ga": p["away_goals"], "xga": p["away_xg"]}),
        pd.DataFrame({"team": p["away_team"], "ga": p["home_goals"], "xga": p["home_xg"]}),
    ])
    agg = rows.groupby("team")[["ga", "xga"]].sum()
    return (agg["ga"] / agg["xga"]) / (agg["ga"].sum() / agg["xga"].sum())


def elo_input(games: pd.DataFrame, margin: str = "goals", scale: float = 1.0) -> pd.DataFrame:
    """Game log for train_elo. margin="xg" makes the MOV multiplier read the xG
    margin (times `scale`) instead of the goal margin; the win/loss result is
    unchanged. Rows without xG keep their goals."""
    if margin == "goals":
        return games
    g = games.copy()
    g["home_goals"] = g["home_xg"].fillna(g["home_goals"]) * scale
    g["away_goals"] = g["away_xg"].fillna(g["away_goals"]) * scale
    return g


def season_played(con, season: int) -> pd.DataFrame:
    """Completed games of `season`, in the shape `thaw_ratings` reads."""
    return query_df(con, f"""
        SELECT home_team, away_team, home_goals, away_goals, home_xg, away_xg
        FROM stg_games WHERE season = {int(season)} AND ended""")


# ---- walk-forward backtest ----------------------------------------------------

_GAME_SQL = """SELECT game_id, season, SUBSTR(start_ts, 1, 10) AS gdate,
                      home_team, away_team, home_goals, away_goals, home_xg, away_xg,
                      home_win, result_category
               FROM stg_games WHERE ended AND season {op} {s}
               ORDER BY season, game_id"""


def poisson_probs(schedule, ratings, cfg, ot_rate):
    """Poisson side of the ensemble, tie-calibrated as in production."""
    pred = predict_games(schedule, ratings, cfg)
    if cfg["match_model"].get("tie_calibration", True):
        pred = calibrate_ties(pred, ot_rate)
    return pred


def _score(pred: pd.DataFrame) -> pd.DataFrame:
    """Per-game 2-way and 3-way log-loss."""
    eps = 1e-12
    y = pred["home_win"].astype(float).to_numpy()
    p = np.clip(pred["p_home_win"].to_numpy(), eps, 1 - eps)
    ot = pred["result_category"].isin(["overtime", "shootout"]).to_numpy()
    reg_h = (~ot) & (pred["home_goals"] > pred["away_goals"]).to_numpy()
    p3 = np.where(ot, pred["p_overtime"],
                  np.where(reg_h, pred["p_home_reg"], pred["p_away_reg"]))
    return pd.DataFrame({"ll2": -(y * np.log(p) + (1 - y) * np.log(1 - p)),
                         "ll3": -np.log(np.clip(p3, eps, 1))})


def _season_elo(history, elo_modes):
    """Pre-season Elo per mode: history at the production k, summer-regressed."""
    return {mode: _regress_ratings(
                train_elo(elo_input(history, m.get("margin", "goals"), m.get("scale", 1.0)),
                          mov_scaling=True), 0.5)
            for mode, m in elo_modes.items()}


def _day_elo(start, before, elo_modes):
    """Elo ratings that morning: the pre-season prior continued through this
    season's games so far at the mode's in-season k (default: production k)."""
    out = {}
    for mode, m in elo_modes.items():
        if before.empty:
            out[mode] = start[mode]
            continue
        log = elo_input(before, m.get("margin", "goals"), m.get("scale", 1.0))
        kw = {"k": m["k"]} if "k" in m else {}
        out[mode] = train_elo(log, mov_scaling=True, ratings=start[mode], **kw)
    return out


def _replay_season(con, cfg, s, variants, poisson_weight, elo_modes):
    """Predict every game of season `s` from that morning's ratings.

    variants: name -> {"elo": mode, "thaw": None | kwargs for thaw_ratings}.
    """
    prior = _ratings_as_of(con, s, cfg, use_goaltending=True)
    ot_rate = _ot_rate_before(con, s)
    ot_lean = cfg["match_model"]["ot_favourite_lean"]
    history = query_df(con, _GAME_SQL.format(op="<", s=int(s)))
    season = query_df(con, _GAME_SQL.format(op="=", s=int(s)))
    start = _season_elo(history, elo_modes)
    rows = []
    for gdate, day in season.groupby("gdate", sort=True):
        before = season[season["gdate"] < gdate]
        elo_pred = {m: elo_game_probs(day, r, ot_rate=ot_rate, ot_lean=ot_lean)
                    for m, r in _day_elo(start, before, elo_modes).items()}
        min_n = (pd.concat([before["home_team"], before["away_team"]])
                 .value_counts().reindex(pd.concat([day["home_team"], day["away_team"]]))
                 .fillna(0).min())
        for name, v in variants.items():
            ratings = prior if v["thaw"] is None else thaw_ratings(prior, before, **v["thaw"])
            pred = ensemble_game_probs(poisson_probs(day, ratings, cfg, ot_rate),
                                       elo_pred[v["elo"]], poisson_weight=poisson_weight)
            sc = _score(pred)
            sc["variant"], sc["season"], sc["min_team_games"] = name, s, min_n
            sc["home_win"], sc["p_home_win"] = pred["home_win"].values, pred["p_home_win"].values
            rows.append(sc)
    return pd.concat(rows, ignore_index=True)


def default_variants(n0_grid=(10, 20, 40, 80), signals=("goals", "xg")) -> dict:
    """Champion plus the 2026-10-25 thaw grid (single n0, raw rates)."""
    variants = {"champion": {"elo": "goals", "thaw": None}}
    variants.update({f"thaw_{sig}_n0={n0:g}": {"elo": "goals",
                                              "thaw": {"n0": float(n0), "signal": sig}}
                     for sig in signals for n0 in n0_grid})
    return variants


def backtest_inseason(seasons=(2023, 2024, 2025, 2026), poisson_weight=0.4,
                      variants=None, elo_modes=None) -> pd.DataFrame:
    """Walk-forward per-game log-loss of every variant."""
    cfg = load_config()
    variants = variants or default_variants()
    elo_modes = elo_modes or {"goals": {}}
    con = get_connection()
    try:
        scored = pd.concat([_replay_season(con, cfg, s, variants, poisson_weight, elo_modes)
                            for s in seasons], ignore_index=True)
    finally:
        con.close()
    return scored


def summarise(scored: pd.DataFrame) -> pd.DataFrame:
    """Mean log-loss per variant: all games, and games where both teams have 10+."""
    late = scored[scored["min_team_games"] >= 10]
    out = pd.DataFrame({
        "ll2_all": scored.groupby("variant")["ll2"].mean(),
        "ll3_all": scored.groupby("variant")["ll3"].mean(),
        "ll2_10plus": late.groupby("variant")["ll2"].mean(),
        "ll3_10plus": late.groupby("variant")["ll3"].mean(),
    })
    base = out.loc["champion"]
    for c in list(out.columns):
        out[f"d_{c}"] = out[c] - base[c]
    return out.sort_values("ll2_all")


if __name__ == "__main__":
    pd.set_option("display.width", 200)
    scored = backtest_inseason()
    print(summarise(scored).round(4).to_string())
    print("\nper season, 2-way log-loss:")
    print(scored.pivot_table(index="variant", columns="season", values="ll2")
          .round(4).to_string())
