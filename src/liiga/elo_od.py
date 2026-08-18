"""Offensive/Defensive Elo: per-team attack and defense ratings updated from goals.

Instead of a single win/loss signal, each game produces four updates:
  attack[home] and defense[away]  from goals scored by the home team
  attack[away] and defense[home]  from goals scored by the away team

The update rule is the gradient of the Poisson log-likelihood — if a team
scored more goals than expected, their attack rating rises and their opponent's
defense rating rises (leakier). This uses strictly more information than
win-based Elo (goals rather than just the outcome).

Ratings live in log space (0 = league average). Converting to multiplicative:
  off_rating = exp(a),  def_rating = exp(d)

These feed directly into model.predict_games, so game probabilities still use
the same Poisson matchup math — only the ratings are learned differently.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import load_config
from .db import get_connection, query_df
from .model import predict_games, _log_loss, _brier, _expected_points

_DEFAULT_K = 0.005
_DEFAULT_SEASON_REG = 0.5


def _regress_od(ratings: dict, factor: float) -> dict:
    """Pull all log-space ratings toward 0 (league average) by `factor`."""
    return {t: {"a": (1.0 - factor) * v["a"], "d": (1.0 - factor) * v["d"]}
            for t, v in ratings.items()}


def train_od_elo(
    games: pd.DataFrame,
    k: float = _DEFAULT_K,
    home_ice: float = 1.08,
    league_avg: float = 2.9,
    season_regression: float = _DEFAULT_SEASON_REG,
) -> dict:
    """Update O/D ratings through a chronologically sorted game log with goals.

    games must have: home_team, away_team, home_goals, away_goals, season.
    Returns {team: {"a": attack_log, "d": defense_log}} at the end of the last game.
    """
    ratings: dict = {}
    prev_season: int | None = None

    for _, g in games.iterrows():
        if prev_season is not None and int(g["season"]) != prev_season:
            ratings = _regress_od(ratings, season_regression)
        prev_season = int(g["season"])

        h, a = g["home_team"], g["away_team"]
        rh = ratings.get(h, {"a": 0.0, "d": 0.0})
        ra = ratings.get(a, {"a": 0.0, "d": 0.0})

        lam_h = league_avg * np.exp(rh["a"] + ra["d"]) * home_ice
        lam_a = league_avg * np.exp(ra["a"] + rh["d"])

        gh, ga = float(g["home_goals"]), float(g["away_goals"])

        # gradient ascent on Poisson log-likelihood for both scorelines
        ratings[h] = {"a": rh["a"] + k * (gh - lam_h),
                      "d": rh["d"] + k * (ga - lam_a)}
        ratings[a] = {"a": ra["a"] + k * (ga - lam_a),
                      "d": ra["d"] + k * (gh - lam_h)}

    return ratings


def od_ratings_to_df(ratings: dict) -> pd.DataFrame:
    """Convert log-space O/D ratings to the off_rating/def_rating DataFrame
    that model.predict_games expects."""
    if not ratings:
        return pd.DataFrame(columns=["team", "off_rating", "def_rating"])
    return pd.DataFrame([
        {"team": t, "off_rating": float(np.exp(v["a"])), "def_rating": float(np.exp(v["d"]))}
        for t, v in ratings.items()
    ])


def od_ratings_as_of(
    con,
    season: int,
    k: float = _DEFAULT_K,
    season_regression: float = _DEFAULT_SEASON_REG,
) -> dict:
    """Leakage-free O/D ratings for the START of `season`.

    Trains on all completed games (with goals) before `season`, then applies
    one more inter-season regression step.
    """
    cfg = load_config()
    home_ice = cfg["match_model"]["home_ice"]
    league_avg = cfg["team_strength"]["league_avg_goals_per_game"]

    games = query_df(
        con,
        f"""SELECT home_team, away_team, home_goals, away_goals, season, game_id
            FROM stg_games WHERE ended AND season < {season}
            ORDER BY season, game_id""",
    )
    if games.empty:
        return {}
    ratings = train_od_elo(games, k=k, home_ice=home_ice, league_avg=league_avg,
                           season_regression=season_regression)
    return _regress_od(ratings, season_regression)


def backtest_od_elo(
    seasons=None,
    k: float = _DEFAULT_K,
    season_regression: float = _DEFAULT_SEASON_REG,
) -> pd.DataFrame:
    """Game-level backtest of the O/D Elo model.
    Output format matches model.backtest() for direct comparison.
    """
    cfg = load_config()
    con = get_connection()
    try:
        if seasons is None:
            train = sorted(cfg["ingestion"]["train_seasons"])
            seasons = train[2:]
        results = []
        for s in seasons:
            ratings = od_ratings_to_df(od_ratings_as_of(con, s, k=k,
                                                        season_regression=season_regression))
            games = query_df(
                con,
                f"SELECT home_team, away_team, home_win FROM stg_games WHERE season = {s} AND ended",
            )
            pred = predict_games(games, ratings, cfg)
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


def backtest_standings_od_elo(
    seasons=None,
    k: float = _DEFAULT_K,
    season_regression: float = _DEFAULT_SEASON_REG,
) -> pd.DataFrame:
    """Standings-level backtest of the O/D Elo model.
    Output format matches model.backtest_standings() for direct comparison.
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
            ratings = od_ratings_to_df(od_ratings_as_of(con, s, k=k,
                                                        season_regression=season_regression))
            games = query_df(
                con,
                f"SELECT home_team, away_team FROM stg_games WHERE season = {s} AND ended",
            )
            pred = predict_games(games, ratings, cfg)
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


if __name__ == "__main__":
    pd.set_option("display.width", 200)
    seasons = [2023, 2024, 2025, 2026]

    print("\n===== k sweep — mean standings metrics across 2023-2026 =====")
    rows = []
    for k_val in [0.001, 0.002, 0.005, 0.01, 0.02, 0.05]:
        df = backtest_standings_od_elo(seasons=seasons, k=k_val)
        rows.append({
            "k": k_val,
            "mean_rho": round(df["spearman_rho"].mean(), 4),
            "mean_pts_mae": round(df["points_mae"].mean(), 2),
            "mean_rank_mae": round(df["rank_mae"].mean(), 3),
        })
    sweep = pd.DataFrame(rows)
    print(sweep.to_string(index=False))

    best_k = float(sweep.loc[sweep["mean_rho"].idxmax(), "k"])
    print(f"\nBest k: {best_k}")

    print(f"\n===== game-level backtest — O/D Elo (k={best_k}) =====")
    print(backtest_od_elo(seasons=seasons, k=best_k).to_string(index=False))
    print(f"\n===== standings backtest — O/D Elo (k={best_k}) =====")
    print(backtest_standings_od_elo(seasons=seasons, k=best_k).to_string(index=False))
