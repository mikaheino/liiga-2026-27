"""Poisson match model: team ratings -> goal expectations -> outcome odds.

For a game we set
    lambda_home = league_avg * off_home * def_away * home_ice
    lambda_away = league_avg * off_away * def_home
then treat each side's goals as independent Poisson draws. From the joint
distribution we read off regulation win / loss / tie, and resolve ties (OT or
shootout) with a small lean toward the stronger team. The output per game is
everything the simulator and the points system need.

We also backtest the whole approach against naive baselines on held-out seasons,
reconstructing each season's ratings from ONLY prior-season information so there
is no leakage.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

from .config import load_config
from .db import get_connection, query_df


# ---- core probability math -------------------------------------------------

def matchup_probs(off_home, def_home, off_away, def_away, cfg, max_goals=12):
    """Return outcome probabilities for one game."""
    mm = cfg["match_model"]
    league_avg = cfg["team_strength"]["league_avg_goals_per_game"]
    lam_h = league_avg * off_home * def_away * mm["home_ice"]
    lam_a = league_avg * off_away * def_home

    gh = stats.poisson.pmf(np.arange(max_goals + 1), lam_h)
    ga = stats.poisson.pmf(np.arange(max_goals + 1), lam_a)
    joint = np.outer(gh, ga)                       # joint[i, j] = P(home i, away j)
    joint /= joint.sum()                           # renormalise the truncated tail

    p_home_reg = np.tril(joint, -1).sum()          # i > j
    p_away_reg = np.triu(joint, 1).sum()           # i < j
    p_tie = np.trace(joint)                         # i == j

    # tie -> OT/shootout; favourite (higher lambda) wins with ot lean
    lean = mm["ot_favourite_lean"]
    home_ot = lean if lam_h >= lam_a else (1 - lean)
    return {
        "lambda_home": float(lam_h),
        "lambda_away": float(lam_a),
        "p_home_reg": float(p_home_reg),
        "p_away_reg": float(p_away_reg),
        "p_overtime": float(p_tie),
        "p_home_ot_win": float(home_ot),
        # convenience: overall P(home win incl. OT)
        "p_home_win": float(p_home_reg + p_tie * home_ot),
    }


def predict_games(schedule: pd.DataFrame, ratings: pd.DataFrame, cfg) -> pd.DataFrame:
    """Attach outcome probabilities to every game in `schedule`.

    schedule needs home_team, away_team. ratings needs team, off_rating,
    def_rating. Teams missing from ratings default to neutral 1.0.
    """
    r = ratings.set_index("team")[["off_rating", "def_rating"]].to_dict("index")
    neutral = {"off_rating": 1.0, "def_rating": 1.0}
    out = []
    for _, g in schedule.iterrows():
        h = r.get(g["home_team"], neutral)
        a = r.get(g["away_team"], neutral)
        p = matchup_probs(h["off_rating"], h["def_rating"],
                          a["off_rating"], a["def_rating"], cfg)
        out.append({**g.to_dict(), **p})
    return pd.DataFrame(out)


# ---- tie-rate calibration ----------------------------------------------------

_LIIGA_OT_RATE = 0.231   # 2022-2026 fallback when no prior games are available


def historical_ot_rate(con, before_season: int) -> float:
    """Fraction of completed games before `before_season` that reached OT/SO."""
    df = query_df(
        con,
        f"""SELECT result_category, COUNT(*) n FROM stg_games
            WHERE ended AND season < {before_season}
            GROUP BY result_category""",
    )
    if df.empty:
        return _LIIGA_OT_RATE
    ot = int(df.loc[df["result_category"].isin(["overtime", "shootout"]), "n"].sum())
    return ot / int(df["n"].sum())


def calibrate_ties(pred: pd.DataFrame, target_ot_rate: float) -> pd.DataFrame:
    """Inflate each game's tie probability so the schedule-wide mean matches the
    observed OT/shootout rate (Dixon-Coles-style diagonal correction).

    Independent Poisson underestimates regulation ties in hockey (~0.16 predicted
    vs ~0.23 observed 2022-2026) because tied teams play conservatively late.
    A single odds-ratio tau is solved so that mean(p_tie') = target, where
    p_tie' = tau*p / (1 - p + tau*p); regulation win/loss shrink proportionally.
    """
    from scipy.optimize import brentq
    p = pred["p_overtime"].to_numpy()
    f = lambda tau: float(np.mean(tau * p / (1 - p + tau * p))) - target_ot_rate
    tau = brentq(f, 1e-6, 1e6)
    p_new = tau * p / (1 - p + tau * p)
    scale = (1 - p_new) / (1 - p)
    out = pred.copy()
    out["p_overtime"] = p_new
    out["p_home_reg"] = pred["p_home_reg"] * scale
    out["p_away_reg"] = pred["p_away_reg"] * scale
    out["p_home_win"] = out["p_home_reg"] + out["p_overtime"] * out["p_home_ot_win"]
    return out


# ---- backtest --------------------------------------------------------------

def _log_loss(y, p, eps=1e-12):
    p = np.clip(p, eps, 1 - eps)
    return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))


def _brier(y, p):
    return float(np.mean((np.asarray(p) - np.asarray(y)) ** 2))


def _ratings_as_of(con, season, cfg, use_goaltending=True, continuity_shrinkage=None):
    """Reconstruct team ratings for `season` using only earlier data, with the
    SAME player-led machinery used for 2027. Rosters for `season` are the teams
    players actually scored for that year; their rates come from prior seasons
    (leakage-free). Defense uses the goaltending model (also leakage-free) unless
    `use_goaltending` is False, which falls back to pure team-history defense."""
    from .players import _replacement_rates
    from .team_strength import (team_offense_from_players, team_history_ratings,
                                combine_ratings, team_continuity_as_of)
    from .goalies import team_goaltending_as_of
    tcfg = cfg["team_strength"]

    # player rates as-of: history strictly before `season` (leakage-free)
    liiga = _compute_liiga_rates_for(con, season, cfg)

    # roster = players with a team in `season` (post-hoc team, pre-`season` rate)
    roster = query_df(
        con,
        f"""SELECT player_id, team, first_name, last_name
            FROM player_season_scoring WHERE season = {season}""",
    )
    liiga_by_id = liiga.set_index("player_id").to_dict("index") if not liiga.empty else {}
    repl = _replacement_rates(liiga) if not liiga.empty else {"F": {"goals": 0.05}}
    rows = []
    for _, p in roster.iterrows():
        pid = int(p["player_id"])
        if pid in liiga_by_id:
            r = liiga_by_id[pid]
            rows.append({"team": p["team"], "position_group": r["position_group"],
                         "projected_goals_per_game": r["projected_goals_per_game"]})
        else:
            rows.append({"team": p["team"], "position_group": "F",
                         "projected_goals_per_game": repl.get("F", {"goals": 0.05})["goals"]})
    pr = pd.DataFrame(rows)
    off_player = team_offense_from_players(pr, tcfg["top_skaters"],
                                           tcfg["league_avg_goals_per_game"])
    history = team_history_ratings(con, season, cfg["players"]["player_history_seasons"],
                                   cfg["players"]["recency_decay"])
    goaltending = team_goaltending_as_of(con, season) if use_goaltending else None
    continuity = team_continuity_as_of(con, season)
    cs = continuity_shrinkage if continuity_shrinkage is not None else tcfg.get("continuity_shrinkage", 0.0)
    return combine_ratings(off_player, history, tcfg["team_weight"],
                           goaltending=goaltending,
                           goalie_weight=tcfg["goalie_weight"],
                           continuity=continuity,
                           continuity_shrinkage=cs)


def _compute_liiga_rates_for(con, target_season, cfg):
    """compute_liiga_rates but for an arbitrary target season (backtest helper)."""
    import copy
    from . import players as _players
    saved = _players.load_config
    cfg2 = copy.deepcopy(cfg)
    cfg2["ingestion"]["target_season"] = target_season
    _players.load_config = lambda: cfg2          # temporary override
    try:
        return _players.compute_liiga_rates(con)
    finally:
        _players.load_config = saved


def _expected_points(pred: pd.DataFrame) -> dict[str, float]:
    """Sum each team's expected Liiga points over a predicted schedule.
    home: 3*P(reg win) + 2*P(OT win) + 1*P(OT loss); away symmetric."""
    pts: dict[str, float] = {}
    for _, g in pred.iterrows():
        h, a = g["home_team"], g["away_team"]
        p_ot = g["p_overtime"]
        h_ot_win, a_ot_win = p_ot * g["p_home_ot_win"], p_ot * (1 - g["p_home_ot_win"])
        pts[h] = pts.get(h, 0.0) + 3 * g["p_home_reg"] + 2 * h_ot_win + 1 * a_ot_win
        pts[a] = pts.get(a, 0.0) + 3 * g["p_away_reg"] + 2 * a_ot_win + 1 * h_ot_win
    return pts


def backtest(seasons=None, use_goaltending=True) -> pd.DataFrame:
    """Evaluate game-level prediction on held-out seasons vs naive baselines."""
    cfg = load_config()
    con = get_connection()
    try:
        if seasons is None:
            # need >=2 prior seasons of history for sensible ratings
            train = sorted(cfg["ingestion"]["train_seasons"])
            seasons = train[2:]
        results = []
        for s in seasons:
            ratings = _ratings_as_of(con, s, cfg, use_goaltending=use_goaltending)
            games = query_df(
                con,
                f"""SELECT home_team, away_team, home_win
                    FROM stg_games WHERE season = {s} AND ended""",
            )
            pred = predict_games(games, ratings, cfg)
            if cfg["match_model"].get("tie_calibration", True):
                pred = calibrate_ties(pred, historical_ot_rate(con, s))
            y = pred["home_win"].to_numpy()
            p_model = pred["p_home_win"].to_numpy()
            p_home_base = np.full_like(y, y.mean(), dtype=float)   # base rate
            results.append(
                {
                    "season": s,
                    "n_games": len(y),
                    "home_win_rate": float(y.mean()),
                    "model_acc": float(((p_model > 0.5) == y).mean()),
                    "model_logloss": _log_loss(y, p_model),
                    "model_brier": _brier(y, p_model),
                    "baseline_logloss": _log_loss(y, p_home_base),
                    "baseline_brier": _brier(y, p_home_base),
                }
            )
    finally:
        con.close()
    return pd.DataFrame(results)


def backtest_standings(seasons=None, use_goaltending=True) -> pd.DataFrame:
    """Evaluate STANDINGS prediction: expected points over each season's actual
    schedule vs the real final table. Reports Spearman rank correlation, points
    MAE, and top-6 overlap. Leakage-free ratings (prior seasons only)."""
    from scipy.stats import spearmanr
    cfg = load_config()
    con = get_connection()
    try:
        if seasons is None:
            train = sorted(cfg["ingestion"]["train_seasons"])
            seasons = train[2:]
        results = []
        for s in seasons:
            ratings = _ratings_as_of(con, s, cfg, use_goaltending=use_goaltending)
            games = query_df(
                con,
                f"""SELECT home_team, away_team FROM stg_games
                    WHERE season = {s} AND ended""",
            )
            pred = predict_games(games, ratings, cfg)
            if cfg["match_model"].get("tie_calibration", True):
                pred = calibrate_ties(pred, historical_ot_rate(con, s))
            exp_pts = _expected_points(pred)
            actual = query_df(
                con,
                f"SELECT team, points FROM team_season WHERE season = {s}",
            )
            actual = actual[actual["team"].isin(exp_pts)]
            actual["pred_points"] = actual["team"].map(exp_pts)
            actual = actual.sort_values("points", ascending=False).reset_index(drop=True)
            actual["actual_rank"] = np.arange(1, len(actual) + 1)
            actual["pred_rank"] = actual["pred_points"].rank(ascending=False).astype(int)
            cutoff = cfg["simulation"]["playoff_cutoff_rank"]
            top_actual = set(actual.nsmallest(cutoff, "actual_rank")["team"])
            top_pred = set(actual.nsmallest(cutoff, "pred_rank")["team"])
            rho = spearmanr(actual["points"], actual["pred_points"]).statistic
            results.append({
                "season": s,
                "n_teams": len(actual),
                "spearman_rho": float(rho),
                "points_mae": float((actual["points"] - actual["pred_points"]).abs().mean()),
                "rank_mae": float((actual["actual_rank"] - actual["pred_rank"]).abs().mean()),
                f"top{cutoff}_hits": f"{len(top_actual & top_pred)}/{cutoff}",
            })
    finally:
        con.close()
    return pd.DataFrame(results)


if __name__ == "__main__":
    from .elo import backtest_elo, backtest_standings_elo
    from .logistic import backtest_lr, backtest_standings_lr, print_coefficients
    pd.set_option("display.width", 200)
    # all leakage-free seasons (2022 excluded: no prior season to rate on)
    seasons = [2023, 2024, 2025, 2026]

    configs = [
        ("Poisson + goaltending (current)",   lambda s: backtest(s, use_goaltending=True)),
        ("Poisson, history-only defense",     lambda s: backtest(s, use_goaltending=False)),
        ("Elo (results-only baseline)",       lambda s: backtest_elo(s)),
        ("Logistic regression",               lambda s: backtest_lr(s)),
    ]
    standings_configs = [
        ("Poisson + goaltending (current)",   lambda s: backtest_standings(s, use_goaltending=True)),
        ("Poisson, history-only defense",     lambda s: backtest_standings(s, use_goaltending=False)),
        ("Elo (results-only baseline)",       lambda s: backtest_standings_elo(s)),
        ("Logistic regression",               lambda s: backtest_standings_lr(s)),
    ]

    print_coefficients()

    for tag, fn in configs:
        print(f"\n===== game-level backtest — {tag} =====")
        print(fn(seasons).to_string(index=False))

    for tag, fn in standings_configs:
        print(f"\n===== standings backtest — {tag} =====")
        print(fn(seasons).to_string(index=False))
