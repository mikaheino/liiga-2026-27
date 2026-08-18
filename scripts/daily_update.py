"""Daily in-season update: refetch results, re-predict, rebuild the site.

Works before AND during the 2026-27 season:
  - pre-season (0 games played) it reproduces the pre-season forecast;
  - in-season it banks actual points from played games, retrains Elo through
    current results (form), simulates only the REMAINING schedule, and decays
    the pre-season crowd signal by the fraction of the season already played.

The player-model side (team_strength) deliberately stays a roster-based
pre-season prior; current form enters through Elo and the banked points.

Pipeline:
    refetch season 2027 games -> run_transforms -> build_team_strength
    -> banked points + remaining-games ensemble prediction -> simulate
    -> crowd blend (decayed) -> persist standings tables + prediction_meta
    -> rebuild site/

Run manually or from the scheduled launchd job (see scripts/daily_update.sh):
    python scripts/daily_update.py
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))   # for build_site import

from liiga.config import load_config
from liiga.crowd import blend_with_model
from liiga.db import get_connection, query_df, register_df
from liiga.elo import elo_ratings_current, elo_game_probs, _ot_rate_before
from liiga.ensemble import ensemble_game_probs
from liiga.ingest import fetch_season, ingest_all
from liiga.model import predict_games, calibrate_ties
from liiga.simulate import simulate, banked_points
from liiga.team_strength import build_team_strength
from liiga.transform import run_transforms

from build_site import main as build_site_main

_POISSON_WEIGHT = 0.4   # keep in sync with scripts/refresh_standings.py


def refresh_results(target: int) -> None:
    """Force-refetch the target season from liiga.fi and reload raw tables.
    Training seasons stay cached (they don't change)."""
    games = fetch_season(target, force=True)
    n_played = sum(1 for g in games if g.get("ended"))
    print(f"fetched season {target}: {len(games)} games, {n_played} played")
    ingest_all()          # re-flattens all seasons (cache for past, fresh for target)
    run_transforms()


def build_prediction(con, cfg) -> tuple[pd.DataFrame, dict, dict]:
    """Ensemble probabilities for the REMAINING schedule + banked points."""
    target = cfg["ingestion"]["target_season"]
    remaining = query_df(
        con,
        f"""SELECT game_id, home_team, away_team FROM stg_games
            WHERE season = {target} AND NOT ended""",
    )
    banked = banked_points(con, target)
    n_total = int(query_df(
        con, f"SELECT COUNT(*) AS n FROM stg_games WHERE season = {target}")["n"].iloc[0])
    n_played = n_total - len(remaining)

    poisson_ratings = query_df(con, "SELECT * FROM team_strength")
    ot_rate = _ot_rate_before(con, target)
    poisson_pred = predict_games(remaining, poisson_ratings, cfg)
    if cfg["match_model"].get("tie_calibration", True) and not remaining.empty:
        poisson_pred = calibrate_ties(poisson_pred, ot_rate)
    elo_pred = elo_game_probs(remaining, elo_ratings_current(con, target),
                              ot_rate=ot_rate,
                              ot_lean=cfg["match_model"]["ot_favourite_lean"])
    pred = ensemble_game_probs(poisson_pred, elo_pred, poisson_weight=_POISSON_WEIGHT)
    meta = {"n_total": n_total, "n_played": n_played}
    return pred, banked, meta


def main() -> None:
    cfg = load_config()
    target = cfg["ingestion"]["target_season"]

    refresh_results(target)
    build_team_strength()     # roster-based prior (also rebuilds team_goaltending)

    con = get_connection()
    try:
        pred, banked, meta = build_prediction(con, cfg)
        res = simulate(con=con, pred=pred, base_points=banked)
    finally:
        con.close()

    standings = res["standings"].copy()

    # crowd signal decays as real results replace pre-season opinion
    frac_played = meta["n_played"] / max(meta["n_total"], 1)
    crowd_weight = cfg.get("crowd", {}).get("crowd_weight", 0.0) * (1.0 - frac_played)
    if crowd_weight > 0.0:
        standings = blend_with_model(standings, crowd_weight=crowd_weight)
        standings = standings.sort_values("final_pts", ascending=False).reset_index(drop=True)
        standings["proj_rank"] = np.arange(1, len(standings) + 1)
        standings["mean_points"] = standings["final_pts"]
        standings.drop(columns=["final_pts", "final_rank"], inplace=True, errors="ignore")

    pos = res["position_distribution"].reset_index().rename(columns={"index": "team"})
    pos.columns = ["team"] + [f"rank_{c}" for c in pos.columns[1:]]

    meta_df = pd.DataFrame([{
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "games_played": meta["n_played"],
        "games_total": meta["n_total"],
        "crowd_weight_eff": round(crowd_weight, 4),
    }])

    # daily snapshot for the prediction-history view (idempotent per day:
    # re-running replaces today's rows, so history has one snapshot per date)
    today = datetime.now(timezone.utc).date().isoformat()
    hist = standings[["proj_rank", "team", "mean_points",
                      "p_title", "p_top_playoff"]].copy()
    hist.insert(0, "snapshot_date", today)
    hist.insert(1, "games_played", meta["n_played"])

    con2 = get_connection()
    try:
        register_df(con2, "standings_2026_27", standings)
        register_df(con2, "position_distribution_2026_27", pos)
        register_df(con2, "prediction_meta", meta_df)
        con2.execute("""CREATE TABLE IF NOT EXISTS prediction_history (
            snapshot_date VARCHAR, games_played BIGINT, proj_rank BIGINT,
            team VARCHAR, mean_points DOUBLE, p_title DOUBLE, p_top_playoff DOUBLE)""")
        con2.execute(f"DELETE FROM prediction_history WHERE snapshot_date = '{today}'")
        con2.register("hist_df", hist)
        con2.execute("INSERT INTO prediction_history SELECT * FROM hist_df")
        con2.unregister("hist_df")
    finally:
        con2.close()

    print(f"updated: {meta['n_played']}/{meta['n_total']} games played, "
          f"crowd weight {crowd_weight:.2f}")
    build_site_main()


if __name__ == "__main__":
    main()
