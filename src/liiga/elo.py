"""Elo rating model for Liiga game and standings prediction.

Pure results-based model — no player or goalie data. Team ratings start at
BASE=1500 and are updated after every game based on the result vs. expected
outcome. Between seasons, ratings regress halfway back to the mean (configurable).

OT/shootout wins count as ot_weight (default 0.75) rather than 1.0, because the
loser still earned a Liiga point — a full-win update would overstate the margin.

Home advantage in Elo points is calibrated to the observed 55.2% home win rate
(~36 points). Season regression of 0.5 pulls ratings halfway back to 1500 each
summer to account for roster churn.

This model is intentionally kept as a standalone module so it can be run
independently and later ensembled with the Poisson/player model.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import load_config
from .db import get_connection, query_df
from .model import _log_loss, _brier, _expected_points

BASE = 1500.0
# calibrated to historical 55.2% home win rate: -400*log10(1/0.552 - 1) ≈ 36
_DEFAULT_HOME_ADV = 36.0
# k=16 + MOV scaling chosen by leakage-free 2023-2026 sweep: for PRE-SEASON
# standings prediction a slow, margin-aware Elo is the best prior
# (mean standings rho 0.51 vs 0.45 for the old k=32 plain Elo).
_DEFAULT_K = 16.0
_DEFAULT_SEASON_REG = 0.5
_DEFAULT_OT_WEIGHT = 0.75
_DEFAULT_MOV_SCALING = True
# historical fraction of Liiga games going to OT/shootout (2022-2026)
_DEFAULT_OT_RATE = 0.231


def _elo_expected(r_home: float, r_away: float, home_adv: float) -> float:
    """Expected score (≈ win probability) for the home team."""
    return 1.0 / (1.0 + 10.0 ** ((r_away - r_home - home_adv) / 400.0))


def _regress_ratings(ratings: dict[str, float], factor: float) -> dict[str, float]:
    """Pull all ratings toward BASE by `factor` (0 = no change, 1 = full reset)."""
    return {t: BASE + (1.0 - factor) * (r - BASE) for t, r in ratings.items()}


def train_elo(
    games: pd.DataFrame,
    k: float = _DEFAULT_K,
    home_adv: float = _DEFAULT_HOME_ADV,
    season_regression: float = _DEFAULT_SEASON_REG,
    ot_weight: float = _DEFAULT_OT_WEIGHT,
    mov_scaling: bool = False,
) -> dict[str, float]:
    """Update Elo ratings through a chronologically sorted game log.

    `games` must have: home_team, away_team, home_win, result_category, season
    (plus home_goals/away_goals when mov_scaling is on).
    Returns ratings at the END of the last game — call _regress_ratings once more
    if you want pre-next-season ratings.

    mov_scaling: scale each update by ln(1+|goal margin|)/ln(2), so a 1-goal win
    keeps the plain-Elo step and a 3-goal win counts double. OT/SO margins are
    treated as 1 (the ot_weight discount already handles those).
    """
    ratings: dict[str, float] = {}
    prev_season: int | None = None

    for _, g in games.iterrows():
        if prev_season is not None and int(g["season"]) != prev_season:
            ratings = _regress_ratings(ratings, season_regression)
        prev_season = int(g["season"])

        h, a = g["home_team"], g["away_team"]
        rh, ra = ratings.get(h, BASE), ratings.get(a, BASE)
        exp_h = _elo_expected(rh, ra, home_adv)

        ot = str(g["result_category"]) in ("overtime", "shootout")
        if int(g["home_win"]):
            sh = ot_weight if ot else 1.0
        else:
            sh = 1.0 - ot_weight if ot else 0.0

        k_g = k
        if mov_scaling:
            gd = 1.0 if ot else abs(float(g["home_goals"]) - float(g["away_goals"]))
            k_g = k * np.log1p(gd) / np.log(2.0)

        ratings[h] = rh + k_g * (sh - exp_h)
        ratings[a] = ra + k_g * ((1.0 - sh) - (1.0 - exp_h))

    return ratings


def elo_ratings_as_of(
    con,
    season: int,
    k: float = _DEFAULT_K,
    home_adv: float = _DEFAULT_HOME_ADV,
    season_regression: float = _DEFAULT_SEASON_REG,
    ot_weight: float = _DEFAULT_OT_WEIGHT,
    mov_scaling: bool = _DEFAULT_MOV_SCALING,
) -> dict[str, float]:
    """Leakage-free Elo ratings for the START of `season`.

    Trains on all completed games in seasons < `season`, then applies one more
    inter-season regression step to represent the pre-season prior.
    """
    games = query_df(
        con,
        f"""SELECT home_team, away_team, home_win, result_category, season, game_id,
                   home_goals, away_goals
            FROM stg_games WHERE ended AND season < {season}
            ORDER BY season, game_id""",
    )
    if games.empty:
        return {}
    ratings = train_elo(games, k=k, home_adv=home_adv,
                        season_regression=season_regression, ot_weight=ot_weight,
                        mov_scaling=mov_scaling)
    return _regress_ratings(ratings, season_regression)


def elo_ratings_current(
    con,
    season: int,
    k: float = _DEFAULT_K,
    home_adv: float = _DEFAULT_HOME_ADV,
    season_regression: float = _DEFAULT_SEASON_REG,
    ot_weight: float = _DEFAULT_OT_WEIGHT,
    mov_scaling: bool = _DEFAULT_MOV_SCALING,
) -> dict[str, float]:
    """Elo ratings AS OF NOW for `season`: trained through every completed game
    up to and including the current season's played games.

    Mid-season this captures current form; before the first game it reduces to
    elo_ratings_as_of (the pre-season prior with the summer regression applied).
    """
    games = query_df(
        con,
        f"""SELECT home_team, away_team, home_win, result_category, season, game_id,
                   home_goals, away_goals
            FROM stg_games WHERE ended AND season <= {season}
            ORDER BY season, game_id""",
    )
    if games.empty:
        return {}
    ratings = train_elo(games, k=k, home_adv=home_adv,
                        season_regression=season_regression, ot_weight=ot_weight,
                        mov_scaling=mov_scaling)
    if not (games["season"] == season).any():
        # season hasn't started: apply the summer regression as usual
        ratings = _regress_ratings(ratings, season_regression)
    return ratings


def _ot_rate_before(con, season: int) -> float:
    """Historical OT/shootout fraction from completed games before `season`."""
    from .model import historical_ot_rate
    return historical_ot_rate(con, season)


def elo_game_probs(
    schedule: pd.DataFrame,
    ratings: dict[str, float],
    home_adv: float = _DEFAULT_HOME_ADV,
    ot_rate: float = _DEFAULT_OT_RATE,
    ot_lean: float = 0.55,
) -> pd.DataFrame:
    """Per-game probabilities from Elo ratings.

    Output has the same columns as model.predict_games so the two models are
    directly comparable and can be ensembled by averaging p_home_win.
    """
    out = []
    for _, g in schedule.iterrows():
        rh = ratings.get(g["home_team"], BASE)
        ra = ratings.get(g["away_team"], BASE)
        p_win = _elo_expected(rh, ra, home_adv)
        # decompose overall home win prob into regulation / OT components
        p_h_reg = max(p_win - ot_rate * ot_lean, 0.0)
        p_a_reg = max((1.0 - p_win) - ot_rate * (1.0 - ot_lean), 0.0)
        p_ot = max(1.0 - p_h_reg - p_a_reg, 0.0)
        out.append({
            **g.to_dict(),
            "p_home_reg": p_h_reg,
            "p_away_reg": p_a_reg,
            "p_overtime": p_ot,
            "p_home_ot_win": float(ot_lean),
            "p_home_win": float(p_win),
        })
    return pd.DataFrame(out)


def backtest_elo(
    seasons=None,
    k: float = _DEFAULT_K,
    home_adv: float = _DEFAULT_HOME_ADV,
    season_regression: float = _DEFAULT_SEASON_REG,
    ot_weight: float = _DEFAULT_OT_WEIGHT,
    mov_scaling: bool = _DEFAULT_MOV_SCALING,
) -> pd.DataFrame:
    """Game-level backtest of the Elo model.

    Output format is identical to model.backtest() for direct comparison.
    """
    cfg = load_config()
    con = get_connection()
    try:
        if seasons is None:
            train = sorted(cfg["ingestion"]["train_seasons"])
            seasons = train[2:]
        results = []
        for s in seasons:
            ratings = elo_ratings_as_of(con, s, k=k, home_adv=home_adv,
                                        season_regression=season_regression,
                                        ot_weight=ot_weight, mov_scaling=mov_scaling)
            ot_rate = _ot_rate_before(con, s)
            ot_lean = cfg["match_model"]["ot_favourite_lean"]
            games = query_df(
                con,
                f"""SELECT home_team, away_team, home_win
                    FROM stg_games WHERE season = {s} AND ended""",
            )
            pred = elo_game_probs(games, ratings, home_adv=home_adv,
                                  ot_rate=ot_rate, ot_lean=ot_lean)
            y = pred["home_win"].to_numpy()
            p_model = pred["p_home_win"].to_numpy()
            p_base = np.full_like(y, y.mean(), dtype=float)
            results.append({
                "season": s,
                "n_games": len(y),
                "home_win_rate": float(y.mean()),
                "model_acc": float(((p_model > 0.5) == y).mean()),
                "model_logloss": _log_loss(y, p_model),
                "model_brier": _brier(y, p_model),
                "baseline_logloss": _log_loss(y, p_base),
                "baseline_brier": _brier(y, p_base),
            })
    finally:
        con.close()
    return pd.DataFrame(results)


def backtest_standings_elo(
    seasons=None,
    k: float = _DEFAULT_K,
    home_adv: float = _DEFAULT_HOME_ADV,
    season_regression: float = _DEFAULT_SEASON_REG,
    ot_weight: float = _DEFAULT_OT_WEIGHT,
    mov_scaling: bool = _DEFAULT_MOV_SCALING,
) -> pd.DataFrame:
    """Standings-level backtest of the Elo model.

    Output format is identical to model.backtest_standings() for direct comparison.
    """
    from scipy.stats import spearmanr
    cfg = load_config()
    con = get_connection()
    try:
        if seasons is None:
            train = sorted(cfg["ingestion"]["train_seasons"])
            seasons = train[2:]
        results = []
        for s in seasons:
            ratings = elo_ratings_as_of(con, s, k=k, home_adv=home_adv,
                                        season_regression=season_regression,
                                        ot_weight=ot_weight, mov_scaling=mov_scaling)
            ot_rate = _ot_rate_before(con, s)
            ot_lean = cfg["match_model"]["ot_favourite_lean"]
            games = query_df(
                con,
                f"""SELECT home_team, away_team FROM stg_games
                    WHERE season = {s} AND ended""",
            )
            pred = elo_game_probs(games, ratings, home_adv=home_adv,
                                  ot_rate=ot_rate, ot_lean=ot_lean)
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
    pd.set_option("display.width", 200)
    seasons = [2023, 2024, 2025, 2026]
    print("\n===== game-level backtest — Elo =====")
    print(backtest_elo(seasons=seasons).to_string(index=False))
    print("\n===== standings backtest — Elo =====")
    print(backtest_standings_elo(seasons=seasons).to_string(index=False))
