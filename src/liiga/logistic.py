"""Logistic regression model for Liiga game and standings prediction.

Uses the SAME leakage-free ratings as the Poisson model (off_rating, def_rating)
but learns the win-probability mapping from historical results rather than
assuming Poisson-distributed goals.

Features per game: log(off_home), log(def_home), log(off_away), log(def_away).
Log scale is the natural choice because the Poisson expected goals are
multiplicative (lambda = league_avg * off * def * home_ice), so log-ratios are
linear in the signal.

Leakage-free: weights for predicting season S are fitted on game data and
ratings from all seasons < S only. For early seasons (2023) this means only one
training season (2022, where prior-history ratings are all neutral 1.0), so
predictions are close to the home-advantage intercept; the model strengthens as
more training seasons accumulate.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

from .config import load_config
from .db import get_connection, query_df
from .model import _ratings_as_of, _log_loss, _brier, _expected_points

FEATURES = ["log_off_home", "log_def_home", "log_off_away", "log_def_away"]
_DEFAULT_OT_RATE = 0.231   # historical Liiga OT+shootout fraction


def _game_features(schedule: pd.DataFrame, ratings: pd.DataFrame) -> pd.DataFrame:
    """Attach log-scale rating features to each row of `schedule`."""
    r = ratings.set_index("team")[["off_rating", "def_rating"]].to_dict("index")
    neutral = {"off_rating": 1.0, "def_rating": 1.0}
    rows = []
    for _, g in schedule.iterrows():
        h = r.get(g["home_team"], neutral)
        a = r.get(g["away_team"], neutral)
        rows.append({
            "log_off_home": np.log(max(h["off_rating"], 1e-6)),
            "log_def_home": np.log(max(h["def_rating"], 1e-6)),
            "log_off_away": np.log(max(a["off_rating"], 1e-6)),
            "log_def_away": np.log(max(a["def_rating"], 1e-6)),
        })
    return pd.DataFrame(rows)


def _build_training_data(
    con, before_season: int, cfg
) -> tuple[pd.DataFrame, np.ndarray]:
    """Leakage-free training set: features + labels from all seasons < before_season."""
    train = sorted(cfg["ingestion"]["train_seasons"])
    feat_blocks, labels = [], []
    for s in [t for t in train if t < before_season]:
        ratings = _ratings_as_of(con, s, cfg, use_goaltending=True)
        games = query_df(
            con,
            f"""SELECT home_team, away_team, home_win
                FROM stg_games WHERE season = {s} AND ended""",
        )
        feat_blocks.append(_game_features(games, ratings))
        labels.extend(games["home_win"].tolist())
    if not feat_blocks:
        return pd.DataFrame(columns=FEATURES), np.array([])
    return pd.concat(feat_blocks, ignore_index=True), np.array(labels, dtype=float)


def fit_logistic(con, before_season: int, cfg) -> LogisticRegression | None:
    """Fit logistic regression on all seasons < before_season.
    Returns None if insufficient training data."""
    X, y = _build_training_data(con, before_season, cfg)
    if len(y) < 50:
        return None
    model = LogisticRegression(max_iter=1000, random_state=42)
    model.fit(X[FEATURES], y)
    return model


def _ot_rate_before(con, season: int) -> float:
    df = query_df(
        con,
        f"""SELECT result_category, COUNT(*) n FROM stg_games
            WHERE ended AND season < {season}
            GROUP BY result_category""",
    )
    if df.empty:
        return _DEFAULT_OT_RATE
    ot = int(df.loc[df["result_category"].isin(["overtime", "shootout"]), "n"].sum())
    return ot / int(df["n"].sum())


def lr_game_probs(
    schedule: pd.DataFrame,
    ratings: pd.DataFrame,
    model: LogisticRegression,
    ot_rate: float = _DEFAULT_OT_RATE,
    ot_lean: float = 0.55,
) -> pd.DataFrame:
    """Per-game probabilities from logistic regression.
    Same output format as model.predict_games for direct comparison and ensembling.
    """
    feats = _game_features(schedule, ratings)
    p_win = model.predict_proba(feats[FEATURES])[:, 1]
    out = []
    for i, (_, g) in enumerate(schedule.iterrows()):
        pw = float(p_win[i])
        p_h_reg = max(pw - ot_rate * ot_lean, 0.0)
        p_a_reg = max((1.0 - pw) - ot_rate * (1.0 - ot_lean), 0.0)
        p_ot = max(1.0 - p_h_reg - p_a_reg, 0.0)
        out.append({
            **g.to_dict(),
            "p_home_reg": p_h_reg,
            "p_away_reg": p_a_reg,
            "p_overtime": p_ot,
            "p_home_ot_win": float(ot_lean),
            "p_home_win": pw,
        })
    return pd.DataFrame(out)


def backtest_lr(seasons=None) -> pd.DataFrame:
    """Game-level backtest of the logistic regression model.
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
            model = fit_logistic(con, s, cfg)
            if model is None:
                continue
            n_train = int(
                query_df(con, f"SELECT COUNT(*) c FROM stg_games WHERE ended AND season < {s}")["c"][0]
            )
            ratings = _ratings_as_of(con, s, cfg, use_goaltending=True)
            ot_rate = _ot_rate_before(con, s)
            games = query_df(
                con,
                f"SELECT home_team, away_team, home_win FROM stg_games WHERE season = {s} AND ended",
            )
            pred = lr_game_probs(games, ratings, model, ot_rate=ot_rate, ot_lean=ot_lean)
            y = pred["home_win"].to_numpy()
            p_model = pred["p_home_win"].to_numpy()
            p_base = np.full_like(y, y.mean(), dtype=float)
            results.append({
                "season": s,
                "n_train": n_train,
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


def backtest_standings_lr(seasons=None) -> pd.DataFrame:
    """Standings-level backtest of the logistic regression model.
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
            model = fit_logistic(con, s, cfg)
            if model is None:
                continue
            ratings = _ratings_as_of(con, s, cfg, use_goaltending=True)
            ot_rate = _ot_rate_before(con, s)
            games = query_df(
                con,
                f"SELECT home_team, away_team FROM stg_games WHERE season = {s} AND ended",
            )
            pred = lr_game_probs(games, ratings, model, ot_rate=ot_rate, ot_lean=ot_lean)
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


def print_coefficients(before_season: int | None = None) -> None:
    """Fit on all available training data and show what the model learned."""
    cfg = load_config()
    con = get_connection()
    try:
        season = before_season or (max(cfg["ingestion"]["train_seasons"]) + 1)
        model = fit_logistic(con, season, cfg)
    finally:
        con.close()
    if model is None:
        print("Not enough data to fit.")
        return
    print(f"\nLogistic regression coefficients (trained on data before {season}):")
    print(f"  intercept (home advantage)   {model.intercept_[0]:+.4f}")
    for name, coef in zip(FEATURES, model.coef_[0]):
        print(f"  {name:<22}  {coef:+.4f}")
    print()
    print("Expected signs:")
    print("  log_off_home  +  (stronger home offense → home wins more)")
    print("  log_def_home  −  (leakier home defense  → home wins less)")
    print("  log_off_away  −  (stronger away offense → home wins less)")
    print("  log_def_away  +  (leakier away defense  → home wins more)")


if __name__ == "__main__":
    pd.set_option("display.width", 200)
    seasons = [2023, 2024, 2025, 2026]
    print_coefficients()
    print("\n===== game-level backtest — Logistic Regression =====")
    print(backtest_lr(seasons=seasons).to_string(index=False))
    print("\n===== standings backtest — Logistic Regression =====")
    print(backtest_standings_lr(seasons=seasons).to_string(index=False))
