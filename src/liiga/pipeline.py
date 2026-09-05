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
from .db import get_connection, query_df, register_df, replace_rows
from .elo import elo_game_probs, elo_ratings_current, _ot_rate_before
from .ensemble import ensemble_game_probs
from .model import calibrate_ties, predict_games
from .simulate import banked_points, simulate

POISSON_WEIGHT = 0.4      # keep in sync with scripts/refresh_standings.py

HISTORY_COLUMNS = ["snapshot_date", "games_played", "proj_rank", "team",
                   "mean_points", "p_title", "p_top_playoff"]

# What the model said about each individual game, before it was played.
# Only recoverable ahead of time: once a game is over there is no way back to
# the probabilities that were on offer for it, so every in-season measurement
# of the model -- log-loss, Brier, calibration -- depends on capturing this
# now. The season standings in prediction_history are the output; this is the
# evidence.
GAME_COLUMNS = ["snapshot_date", "game_id", "home_team", "away_team",
                "p_home_reg", "p_away_reg", "p_overtime", "p_home_ot_win",
                "p_home_win"]


def refresh_results(season: int | None = None, con=None) -> dict:
    """Pull in what has happened since the last run. The in-season step.

    Three layers, in order, because each feeds the next:

    1. the season endpoint -> results, goals, assists (`ingest_all`)
    2. the SQL transforms   -> stg_games, team_game_log, ... which the model
       and the Elo ratings read
    3. the per-game endpoint -> lineups, goalies, penalties for games that
       have just been played (`results.ingest_results`)

    Step 3 is incremental and step 1 is not: the season endpoint is one call
    per season and gives every result at once, while per-game detail costs a
    call per game and is therefore fetched only for games we do not have yet.

    Called by both the local daily run and the in-Snowflake notebook, so this
    must stay free of anything laptop-specific.
    """
    from .ingest import fetch_season, ingest_all
    from .results import ingest_results
    from .transform import run_transforms

    cfg = load_config()
    season = season or cfg["ingestion"]["target_season"]

    games = fetch_season(season, force=True)
    n_played = sum(1 for g in games if g.get("ended"))
    ingest_all()
    run_transforms()
    detail = ingest_results(season, con=con)

    return {"season": season, "games_total": len(games),
            "games_played": n_played,
            "detail_games": detail["games_fetched"],
            "detail_rows": detail["rows"], "detail_failed": detail["failed"]}


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

    if remaining.empty:
        # Every game played: nothing left to simulate, so the standings are
        # simply the banked points. Without this the ensemble would index an
        # empty frame and raise KeyError on p_home_reg. Reached at the end of
        # a season -- and by any dry run against a completed tournament.
        empty = pd.DataFrame(columns=["game_id", "home_team", "away_team",
                                      "p_home_reg", "p_away_reg", "p_overtime",
                                      "p_home_ot_win", "p_home_win"])
        return empty, banked, {"n_total": n_total, "n_played": n_played}

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

    games = pred.copy()
    if not games.empty:
        games.insert(0, "snapshot_date", today)
    games = games.reindex(columns=GAME_COLUMNS)

    return {"standings": standings, "position": pos, "meta": meta_df,
            "history": hist, "games": games, "today": today,
            "n_played": meta["n_played"], "n_total": meta["n_total"],
            "crowd_weight": crowd_weight}


def _replace_today(con, table: str, columns: list[str], today: str,
                   fresh: pd.DataFrame) -> pd.DataFrame:
    """Existing rows minus today's, plus today's -- idempotent per day."""
    return replace_rows(con, table, columns, "snapshot_date", [today], fresh)


def persist(res: dict, con=None) -> None:
    """Write the forecast to the five output tables, on either backend.

    prediction_history is append-with-replace-today rather than DELETE +
    INSERT: the old version used DuckDB's own register()/execute() API, which
    does not exist on a Snowpark session. Reading the table, dropping today's
    rows in pandas and rewriting it is portable and idempotent -- re-running
    on the same day replaces that day's snapshot instead of duplicating it.
    """
    own = con is None
    con = con or get_connection()
    try:
        history = _replace_today(con, "prediction_history", HISTORY_COLUMNS,
                                 res["today"], res["history"])
        games = _replace_today(con, "prediction_games", GAME_COLUMNS,
                               res["today"], res["games"])

        register_df(con, "standings_2026_27", res["standings"])
        register_df(con, "position_distribution_2026_27", res["position"])
        register_df(con, "prediction_meta", res["meta"])
        register_df(con, "prediction_history", history)
        register_df(con, "prediction_games", games)
    finally:
        if own:
            con.close()
