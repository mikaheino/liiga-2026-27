"""Refresh team_strength (with goaltending) and persist the simulated standings.

Re-runs the last two pipeline stages and materialises the reporting tables:
    team_goaltending, team_strength, standings_2026_27, position_distribution_2026_27

Uses the best ensemble (40% tie-calibrated Poisson + 60% MOV-Elo) for game
probabilities.
Optionally blends the crowd-wisdom signal from Jatkoaika.com forum predictions
(controlled by crowd.crowd_weight in config.yaml, default 0.0 = disabled).

Run after editing goalie/roster/config inputs:
    python scripts/refresh_standings.py
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from liiga.config import load_config
from liiga.crowd import blend_with_model, crowd_consensus
from liiga.db import get_connection, query_df, register_df
from liiga.elo import elo_ratings_as_of, elo_game_probs, _ot_rate_before
from liiga.ensemble import ensemble_game_probs
from liiga.model import predict_games, _ratings_as_of, calibrate_ties
from liiga.simulate import simulate
from liiga.team_strength import build_team_strength

# 0.4 Poisson + 0.6 MOV-Elo: best game logloss (0.672) and points MAE (12.7)
# on the 2023-2026 backtest after tie calibration + k=16 margin-of-victory Elo.
_POISSON_WEIGHT = 0.4


def _build_ensemble_pred(con, cfg):
    """Build per-game probability DataFrame using the best ensemble."""
    target = cfg["ingestion"]["target_season"]
    schedule = query_df(
        con,
        f"SELECT game_id, home_team, away_team FROM stg_games WHERE season = {target}",
    )
    poisson_ratings = query_df(con, "SELECT * FROM team_strength")
    elo_ratings = elo_ratings_as_of(con, target)
    ot_rate = _ot_rate_before(con, target)
    ot_lean = cfg["match_model"]["ot_favourite_lean"]

    poisson_pred = predict_games(schedule, poisson_ratings, cfg)
    if cfg["match_model"].get("tie_calibration", True):
        poisson_pred = calibrate_ties(poisson_pred, ot_rate)
    elo_pred = elo_game_probs(schedule, elo_ratings, ot_rate=ot_rate, ot_lean=ot_lean)
    return ensemble_game_probs(poisson_pred, elo_pred, poisson_weight=_POISSON_WEIGHT)


def main() -> None:
    cfg = load_config()
    crowd_weight = cfg.get("crowd", {}).get("crowd_weight", 0.0)

    build_team_strength()   # rebuilds team_goaltending + team_strength

    con = get_connection()
    try:
        pred = _build_ensemble_pred(con, cfg)
        res = simulate(con=con, pred=pred)
    finally:
        con.close()

    standings = res["standings"].copy()

    if crowd_weight > 0.0:
        standings = blend_with_model(standings, crowd_weight=crowd_weight)
        # use blended final_pts as the ranking column for reporting
        standings = standings.sort_values("final_pts", ascending=False).reset_index(drop=True)
        standings["proj_rank"] = np.arange(1, len(standings) + 1)
        standings["mean_points"] = standings["final_pts"]
        standings.drop(columns=["final_pts", "final_rank"], inplace=True, errors="ignore")

    pos = res["position_distribution"].reset_index().rename(columns={"index": "team"})
    pos.columns = ["team"] + [f"rank_{c}" for c in pos.columns[1:]]

    con2 = get_connection()
    try:
        register_df(con2, "standings_2026_27", standings)
        register_df(con2, "position_distribution_2026_27", pos)
    finally:
        con2.close()

    pd.set_option("display.float_format", lambda x: f"{x:.1f}")
    pd.set_option("display.width", 120)

    model_label = f"Ensemble (Poisson {int(_POISSON_WEIGHT*100)}% + Elo {int((1-_POISSON_WEIGHT)*100)}%)"
    if crowd_weight > 0.0:
        model_label += f" + Crowd {int(crowd_weight*100)}%"
    print(f"\n=== 2026-27 Liiga standings prediction — {model_label} ===\n")
    print(standings[["proj_rank", "team", "mean_points", "p05_points", "p95_points",
                      "p_title", "p_top_playoff", "mean_rank"]].to_string(index=False))

    if crowd_weight > 0.0:
        print(f"\n--- Crowd consensus (weight={crowd_weight}) ---")
        cwd = crowd_consensus()[["crowd_rank", "team", "mean_rank", "rank_stdev"]]
        cwd.rename(columns={"mean_rank": "crowd_mean_rank", "rank_stdev": "crowd_stdev"}, inplace=True)
        print(cwd.to_string(index=False))


if __name__ == "__main__":
    main()
