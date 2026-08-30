"""One run of the daily forecast, backend-agnostic.

Both callers use this so the model math has exactly one home:

  * `scripts/daily_update.py` -- the local (dev) run against DuckDB
  * `snowflake/daily_update.ipynb` -- the in-Snowflake (prod) run

Nothing here touches the filesystem or the site; it reads tables, runs the
model, and writes tables. Everything goes through `liiga.db`, so the same code
runs on DuckDB and on a Snowpark session.
"""
from __future__ import annotations

import datetime as dt

import numpy as np
import pandas as pd

from .config import load_config
from .crowd import blend_with_model
from .db import get_connection, query_df, register_df
from .elo import elo_game_probs, elo_ratings_current, _ot_rate_before
from .ensemble import ensemble_game_probs
from .model import calibrate_ties, predict_games
from .simulate import banked_points, simulate

POISSON_WEIGHT = 0.4      # keep in sync with scripts/refresh_standings.py

HISTORY_COLUMNS = ["snapshot_date", "games_played", "proj_rank", "team",
                   "mean_points", "p_title", "p_top_playoff"]


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
    pred = ensemble_game_probs(poisson_pred, elo_pred,
                               poisson_weight=POISSON_WEIGHT)
    return pred, banked, {"n_total": n_total, "n_played": n_played}


def forecast(con=None, cfg=None) -> dict:
    """Run the model once. Returns the frames to persist, nothing written yet."""
    cfg = cfg or load_config()
    own = con is None
    con = con or get_connection()
    try:
        pred, banked, meta = build_prediction(con, cfg)
        res = simulate(con=con, pred=pred, base_points=banked)
    finally:
        if own:
            con.close()

    standings = res["standings"].copy()

    # The crowd signal decays as real results replace pre-season opinion.
    frac_played = meta["n_played"] / max(meta["n_total"], 1)
    crowd_weight = (cfg.get("crowd", {}).get("crowd_weight", 0.0)
                    * (1.0 - frac_played))
    if crowd_weight > 0.0:
        standings = blend_with_model(standings, crowd_weight=crowd_weight)
        standings = standings.sort_values("final_pts", ascending=False).reset_index(drop=True)
        standings["proj_rank"] = np.arange(1, len(standings) + 1)
        standings["mean_points"] = standings["final_pts"]
        standings.drop(columns=["final_pts", "final_rank"], inplace=True,
                       errors="ignore")

    pos = res["position_distribution"].reset_index().rename(columns={"index": "team"})
    pos.columns = ["team"] + [f"rank_{c}" for c in pos.columns[1:]]

    meta_df = pd.DataFrame([{
        "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "games_played": meta["n_played"],
        "games_total": meta["n_total"],
        "crowd_weight_eff": round(crowd_weight, 4),
    }])

    today = dt.datetime.now(dt.timezone.utc).date().isoformat()
    hist = standings[["proj_rank", "team", "mean_points",
                      "p_title", "p_top_playoff"]].copy()
    hist.insert(0, "snapshot_date", today)
    hist.insert(1, "games_played", meta["n_played"])

    return {"standings": standings, "position": pos, "meta": meta_df,
            "history": hist, "today": today, "n_played": meta["n_played"],
            "n_total": meta["n_total"], "crowd_weight": crowd_weight}


def persist(res: dict, con=None) -> None:
    """Write the forecast to the four output tables, on either backend.

    prediction_history is append-with-replace-today rather than DELETE +
    INSERT: the old version used DuckDB's own register()/execute() API, which
    does not exist on a Snowpark session. Reading the table, dropping today's
    rows in pandas and rewriting it is portable and idempotent -- re-running
    on the same day replaces that day's snapshot instead of duplicating it.
    """
    own = con is None
    con = con or get_connection()
    try:
        try:
            old = query_df(con, "SELECT * FROM prediction_history")
            old = old[[c for c in HISTORY_COLUMNS if c in old.columns]]
            old = old[old["snapshot_date"].astype(str) != res["today"]]
        except Exception:               # noqa: BLE001 -- first ever run
            old = pd.DataFrame(columns=HISTORY_COLUMNS)
        history = pd.concat([old, res["history"][HISTORY_COLUMNS]],
                            ignore_index=True)

        register_df(con, "standings_2026_27", res["standings"])
        register_df(con, "position_distribution_2026_27", res["position"])
        register_df(con, "prediction_meta", res["meta"])
        register_df(con, "prediction_history", history)
    finally:
        if own:
            con.close()
