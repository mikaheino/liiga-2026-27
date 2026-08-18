"""Ensemble of Poisson, win-Elo, and O/D Elo models.

Combines models by taking a weighted average of their per-game probability
vectors. All models produce the same output format (p_home_reg, p_away_reg,
p_overtime, p_home_ot_win), so averaging preserves the sum-to-1 constraint.

Run this module directly to sweep all 3-way weight combinations and find the
empirically best split on backtested seasons.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import load_config
from .db import get_connection, query_df
from .model import (_ratings_as_of, predict_games, _log_loss, _brier,
                    _expected_points, calibrate_ties)
from .elo import elo_ratings_as_of, elo_game_probs, _ot_rate_before
from .elo_od import od_ratings_as_of, od_ratings_to_df

_PROB_COLS = ["p_home_reg", "p_away_reg", "p_overtime", "p_home_ot_win"]


def ensemble_game_probs(
    poisson_pred: pd.DataFrame,
    elo_pred: pd.DataFrame,
    poisson_weight: float = 0.5,
) -> pd.DataFrame:
    """Weighted average of Poisson and Elo probability vectors.

    Both inputs must be aligned row-for-row (same games in the same order).
    Non-probability columns are taken from poisson_pred.
    """
    w = poisson_weight
    result = poisson_pred.copy()
    for col in _PROB_COLS:
        result[col] = w * poisson_pred[col] + (1.0 - w) * elo_pred[col]
    result["p_home_win"] = (
        result["p_home_reg"] + result["p_overtime"] * result["p_home_ot_win"]
    )
    return result


def backtest_ensemble(seasons=None, poisson_weight: float = 0.5) -> pd.DataFrame:
    """Game-level backtest of the Poisson+Elo ensemble.
    Output format matches model.backtest() for direct comparison.
    """
    cfg = load_config()
    con = get_connection()
    try:
        if seasons is None:
            train = sorted(cfg["ingestion"]["train_seasons"])
            seasons = train[2:]
        ot_lean = cfg["match_model"]["ot_favourite_lean"]
        results = []
        for s in seasons:
            poisson_ratings = _ratings_as_of(con, s, cfg, use_goaltending=True)
            elo_ratings = elo_ratings_as_of(con, s)
            ot_rate = _ot_rate_before(con, s)
            games = query_df(
                con,
                f"SELECT home_team, away_team, home_win FROM stg_games WHERE season = {s} AND ended",
            )
            poisson_pred = predict_games(games, poisson_ratings, cfg)
            if cfg["match_model"].get("tie_calibration", True):
                poisson_pred = calibrate_ties(poisson_pred, ot_rate)
            elo_pred = elo_game_probs(games, elo_ratings, ot_rate=ot_rate, ot_lean=ot_lean)
            pred = ensemble_game_probs(poisson_pred, elo_pred, poisson_weight)
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


def backtest_standings_ensemble(seasons=None, poisson_weight: float = 0.5) -> pd.DataFrame:
    """Standings-level backtest of the Poisson+Elo ensemble.
    Output format matches model.backtest_standings() for direct comparison.
    """
    from scipy.stats import spearmanr
    cfg = load_config()
    con = get_connection()
    try:
        if seasons is None:
            train = sorted(cfg["ingestion"]["train_seasons"])
            seasons = train[2:]
        ot_lean = cfg["match_model"]["ot_favourite_lean"]
        results = []
        for s in seasons:
            poisson_ratings = _ratings_as_of(con, s, cfg, use_goaltending=True)
            elo_ratings = elo_ratings_as_of(con, s)
            ot_rate = _ot_rate_before(con, s)
            games = query_df(
                con,
                f"SELECT home_team, away_team FROM stg_games WHERE season = {s} AND ended",
            )
            poisson_pred = predict_games(games, poisson_ratings, cfg)
            if cfg["match_model"].get("tie_calibration", True):
                poisson_pred = calibrate_ties(poisson_pred, ot_rate)
            elo_pred = elo_game_probs(games, elo_ratings, ot_rate=ot_rate, ot_lean=ot_lean)
            pred = ensemble_game_probs(poisson_pred, elo_pred, poisson_weight)
            exp_pts = _expected_points(pred)
            actual = query_df(con, f"SELECT team, points FROM team_season WHERE season = {s}")
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


def backtest_standings_3way(
    seasons=None,
    poisson_weight: float = 0.2,
    elo_weight: float = 0.4,
    od_weight: float = 0.4,
) -> pd.DataFrame:
    """Standings backtest of the 3-way Poisson + win-Elo + O/D-Elo ensemble.
    Weights must sum to 1. Output format matches model.backtest_standings().
    """
    from scipy.stats import spearmanr
    assert abs(poisson_weight + elo_weight + od_weight - 1.0) < 1e-6, "weights must sum to 1"
    cfg = load_config()
    con = get_connection()
    try:
        if seasons is None:
            train = sorted(cfg["ingestion"]["train_seasons"])
            seasons = train[2:]
        ot_lean = cfg["match_model"]["ot_favourite_lean"]
        results = []
        for s in seasons:
            poisson_ratings = _ratings_as_of(con, s, cfg, use_goaltending=True)
            elo_ratings = elo_ratings_as_of(con, s)
            od_ratings = od_ratings_to_df(od_ratings_as_of(con, s))
            ot_rate = _ot_rate_before(con, s)
            games = query_df(
                con,
                f"SELECT home_team, away_team FROM stg_games WHERE season = {s} AND ended",
            )
            poisson_pred = predict_games(games, poisson_ratings, cfg)
            od_pred = predict_games(games, od_ratings, cfg)
            if cfg["match_model"].get("tie_calibration", True):
                poisson_pred = calibrate_ties(poisson_pred, ot_rate)
                od_pred = calibrate_ties(od_pred, ot_rate)
            elo_pred = elo_game_probs(games, elo_ratings, ot_rate=ot_rate, ot_lean=ot_lean)
            # 3-way weighted average
            pred = poisson_pred.copy()
            for col in _PROB_COLS:
                pred[col] = (poisson_weight * poisson_pred[col]
                             + elo_weight * elo_pred[col]
                             + od_weight * od_pred[col])
            pred["p_home_win"] = pred["p_home_reg"] + pred["p_overtime"] * pred["p_home_ot_win"]
            exp_pts = _expected_points(pred)
            actual = query_df(con, f"SELECT team, points FROM team_season WHERE season = {s}")
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


def _sweep_3way(seasons):
    """Grid search over all 3-way weight combinations (step 0.1).
    Precomputes all per-season predictions once to avoid redundant rating calls.
    """
    from scipy.stats import spearmanr
    cfg = load_config()
    con = get_connection()
    try:
        ot_lean = cfg["match_model"]["ot_favourite_lean"]
        cutoff = cfg["simulation"]["playoff_cutoff_rank"]
        # precompute all per-season prediction frames
        season_data = {}
        for s in seasons:
            poisson_ratings = _ratings_as_of(con, s, cfg, use_goaltending=True)
            elo_ratings = elo_ratings_as_of(con, s)
            od_ratings = od_ratings_to_df(od_ratings_as_of(con, s))
            ot_rate = _ot_rate_before(con, s)
            games = query_df(
                con,
                f"SELECT home_team, away_team FROM stg_games WHERE season = {s} AND ended",
            )
            actual = query_df(con, f"SELECT team, points FROM team_season WHERE season = {s}")
            poisson_pred = predict_games(games, poisson_ratings, cfg)
            od_pred = predict_games(games, od_ratings, cfg)
            if cfg["match_model"].get("tie_calibration", True):
                poisson_pred = calibrate_ties(poisson_pred, ot_rate)
                od_pred = calibrate_ties(od_pred, ot_rate)
            season_data[s] = {
                "poisson": poisson_pred,
                "elo": elo_game_probs(games, elo_ratings, ot_rate=ot_rate, ot_lean=ot_lean),
                "od": od_pred,
                "actual": actual,
            }
    finally:
        con.close()

    steps = [round(i * 0.1, 1) for i in range(11)]
    rows = []
    for pw in steps:
        for ew in steps:
            ow = round(1.0 - pw - ew, 1)
            if ow < 0 or ow > 1:
                continue
            rhos = []
            for s, d in season_data.items():
                pred = d["poisson"].copy()
                for col in _PROB_COLS:
                    pred[col] = pw * d["poisson"][col] + ew * d["elo"][col] + ow * d["od"][col]
                pred["p_home_win"] = pred["p_home_reg"] + pred["p_overtime"] * pred["p_home_ot_win"]
                exp_pts = _expected_points(pred)
                actual = d["actual"].copy()
                actual = actual[actual["team"].isin(exp_pts)]
                actual["pred_points"] = actual["team"].map(exp_pts)
                rhos.append(spearmanr(actual["points"], actual["pred_points"]).statistic)
            rows.append({"poisson": pw, "elo": ew, "od": ow,
                         "mean_rho": round(float(np.mean(rhos)), 4)})
    return pd.DataFrame(rows).sort_values("mean_rho", ascending=False)


if __name__ == "__main__":
    pd.set_option("display.width", 200)
    seasons = [2023, 2024, 2025, 2026]

    print("\n===== 3-way weight sweep — mean standings ρ across 2023-2026 =====")
    sweep = _sweep_3way(seasons)
    print(sweep.head(15).to_string(index=False))

    best = sweep.iloc[0]
    pw, ew, ow = best["poisson"], best["elo"], best["od"]
    print(f"\nBest weights: Poisson={pw}  win-Elo={ew}  O/D-Elo={ow}  →  mean ρ={best['mean_rho']}")

    print(f"\n===== standings backtest — 3-way ensemble (P={pw} E={ew} OD={ow}) =====")
    print(backtest_standings_3way(seasons=seasons,
                                  poisson_weight=pw, elo_weight=ew, od_weight=ow
                                  ).to_string(index=False))
