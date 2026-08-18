"""Crowd-wisdom pre-season signal from Jatkoaika.com forum predictions.

40 forum members posted their 2026-27 Liiga standings predictions before the
season. We aggregate these into a consensus mean rank per team and convert
that to an expected-points estimate that can be blended with the model.

Since this signal is 2026-27 specific (no past seasons to backtest), it is
disabled by default (crowd_weight = 0.0 in config). Activate it manually
for the live 2026-27 prediction.
"""
from __future__ import annotations

import os
import numpy as np
import pandas as pd

_DATA_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "crowd_predictions_2026_27.txt"
)

_TEAM_ALIASES: dict[str, str] = {
    "Kiekko-Espoo": "K-Espoo",
    "K-espoo": "K-Espoo",
    "Kespoo": "K-Espoo",
}

_LIIGA_TEAMS = {
    "Ässät", "Sport", "K-Espoo", "HIFK", "HPK", "Ilves", "JYP",
    "Jokerit", "Jukurit", "KalPa", "KooKoo", "Kärpät", "Lukko",
    "Pelicans", "SaiPa", "TPS", "Tappara",
}


def parse_crowd_predictions(path: str | None = None) -> pd.DataFrame:
    """Parse the crowd predictions file.

    Returns a tidy DataFrame: (user, team, rank) where rank=1 is predicted
    champion and rank=17 is predicted last place.
    """
    path = path or _DATA_PATH
    rows = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            user, teams_str = line.split("|", 1)
            teams = [_TEAM_ALIASES.get(t.strip(), t.strip()) for t in teams_str.split(",")]
            if len(teams) != 17:
                continue  # skip incomplete predictions
            for rank, team in enumerate(teams, start=1):
                rows.append({"user": user.strip(), "team": team, "rank": rank})
    return pd.DataFrame(rows)


def crowd_consensus(
    path: str | None = None,
    pts_top: float = 105.0,
    pts_bottom: float = 60.0,
) -> pd.DataFrame:
    """Aggregate crowd picks into a consensus signal per team.

    crowd_pts uses a linear mapping from mean rank to expected season points,
    calibrated so rank 1 → pts_top and rank 17 → pts_bottom. The middle of
    the field (mean rank 9) maps to (pts_top + pts_bottom) / 2 ≈ league avg.

    Returns: team, n_predictors, mean_rank, rank_stdev, crowd_pts, crowd_rank
    """
    df = parse_crowd_predictions(path)
    agg = (
        df.groupby("team")["rank"]
        .agg(n_predictors="count", mean_rank="mean", rank_stdev="std")
        .reset_index()
    )
    pts_range = pts_top - pts_bottom
    agg["crowd_pts"] = pts_top - (agg["mean_rank"] - 1) * pts_range / 16.0
    agg["crowd_rank"] = agg["crowd_pts"].rank(ascending=False).astype(int)
    return agg.sort_values("crowd_rank").reset_index(drop=True)


def blend_with_model(
    model_standings: pd.DataFrame,
    crowd_weight: float = 0.3,
    pts_top: float = 105.0,
    pts_bottom: float = 60.0,
) -> pd.DataFrame:
    """Blend model expected points with crowd consensus.

    model_standings must have columns 'team' and 'mean_points' (or
    'pred_points' / 'exp_pts' — whichever column holds the model score).
    Detected automatically.

    Returns the standings DataFrame with crowd signal blended in:
        final_pts = (1 - crowd_weight) * model_pts + crowd_weight * crowd_pts
    and 'final_rank' added / updated.
    """
    # detect the model points column
    pts_col = None
    for candidate in ("mean_points", "pred_points", "exp_pts", "expected_points"):
        if candidate in model_standings.columns:
            pts_col = candidate
            break
    if pts_col is None:
        raise ValueError(
            "model_standings must have a 'mean_points' or 'pred_points' column. "
            f"Got: {list(model_standings.columns)}"
        )

    crowd = crowd_consensus(pts_top=pts_top, pts_bottom=pts_bottom)
    result = model_standings.copy()
    crowd_merge = crowd[["team", "mean_rank", "crowd_pts", "crowd_rank"]].rename(
        columns={"mean_rank": "crowd_mean_rank"}
    )
    result = result.merge(crowd_merge, on="team", how="left")
    # teams not in the crowd data keep model points unchanged
    result["crowd_pts"] = result["crowd_pts"].fillna(result[pts_col])
    result["final_pts"] = (
        (1 - crowd_weight) * result[pts_col]
        + crowd_weight * result["crowd_pts"]
    )
    result["final_rank"] = result["final_pts"].rank(ascending=False).astype(int)
    return result.sort_values("final_rank").reset_index(drop=True)


def compare_model_vs_crowd(
    model_standings: pd.DataFrame,
    pts_col: str = "mean_points",
) -> pd.DataFrame:
    """Side-by-side comparison of model predicted rank and crowd consensus rank.

    Returns a table sorted by crowd consensus rank.
    """
    crowd = crowd_consensus()
    result = crowd[["team", "crowd_rank", "mean_rank", "rank_stdev", "crowd_pts"]].copy()
    model_pts = model_standings.set_index("team")[pts_col].to_dict()
    result["model_pts"] = result["team"].map(model_pts)
    result["model_rank"] = result["model_pts"].rank(ascending=False).astype(int)
    result["rank_delta"] = result["model_rank"] - result["crowd_rank"]
    result.rename(columns={"mean_rank": "crowd_mean_rank", "rank_stdev": "crowd_stdev"}, inplace=True)
    return result.sort_values("crowd_rank").reset_index(drop=True)


if __name__ == "__main__":
    pd.set_option("display.width", 180)
    pd.set_option("display.float_format", "{:.1f}".format)

    print(f"\n=== Crowd consensus ({parse_crowd_predictions().user.nunique()} predictors) ===")
    con = crowd_consensus()
    print(con[["crowd_rank", "team", "mean_rank", "rank_stdev", "crowd_pts",
               "n_predictors"]].to_string(index=False))

    # compare with model
    try:
        from .config import load_config
        from .db import get_connection, query_df
        from .model import _ratings_as_of, predict_games, _expected_points
        from .elo import elo_ratings_as_of, elo_game_probs, _ot_rate_before
        from .ensemble import ensemble_game_probs

        cfg = load_config()
        con_db = get_connection()
        try:
            poisson_ratings = _ratings_as_of(con_db, 2027, cfg)
            elo_ratings = elo_ratings_as_of(con_db, 2027)
            ot_rate = _ot_rate_before(con_db, 2027)
            schedule = query_df(con_db, "SELECT home_team, away_team FROM stg_games WHERE season = 2027 AND ended = false")
            if schedule.empty:
                # full schedule not ingested yet — use 2026 schedule as proxy shape
                schedule = query_df(con_db, "SELECT home_team, away_team FROM stg_games WHERE season = 2026 AND ended")
            poisson_pred = predict_games(schedule, poisson_ratings, cfg)
            elo_pred = elo_game_probs(schedule, elo_ratings, ot_rate=ot_rate,
                                      ot_lean=cfg["match_model"]["ot_favourite_lean"])
            pred = ensemble_game_probs(poisson_pred, elo_pred, poisson_weight=0.3)
            exp_pts = _expected_points(pred)
            model_df = pd.DataFrame({"team": list(exp_pts.keys()), "mean_points": list(exp_pts.values())})
        finally:
            con_db.close()

        print("\n=== Model vs Crowd comparison ===")
        cmp = compare_model_vs_crowd(model_df)
        print(cmp.to_string(index=False))

        crowd_weight = cfg.get("crowd", {}).get("crowd_weight", 0.3)
        print(f"\n=== Blended forecast (crowd_weight={crowd_weight}) ===")
        blended = blend_with_model(model_df, crowd_weight=crowd_weight)
        print(blended[["final_rank", "team", "final_pts", "mean_points",
                        "crowd_pts", "crowd_rank"]].to_string(index=False))
    except Exception as exc:
        print(f"\n(model comparison skipped: {exc})")
