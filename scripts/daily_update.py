"""Daily in-season update: refetch results, re-predict, rebuild the site.

Works before AND during the 2026-27 season:
  - pre-season (0 games played) it reproduces the pre-season forecast;
  - in-season it banks actual points from played games, retrains Elo through
    current results (form), simulates only the REMAINING schedule, and decays
    the pre-season crowd signal by the fraction of the season already played.

The player-model side (team_strength) deliberately stays a roster-based
pre-season prior; current form enters through Elo and the banked points.

Pipeline:
    refresh_results (results + transforms + per-game detail)
    -> build_team_strength
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
from liiga.model import predict_games, calibrate_ties
from liiga.pipeline import forecast, persist, refresh_results
from liiga.snowflake_sync import sync_all
from liiga.team_strength import build_team_strength

from build_site import main as build_site_main

_POISSON_WEIGHT = 0.4   # keep in sync with scripts/refresh_standings.py


def main(sync: bool = True) -> None:
    cfg = load_config()
    target = cfg["ingestion"]["target_season"]

    # Results, transforms and per-game detail -- the same call the
    # in-Snowflake notebook makes, so the two cannot drift apart.
    got = refresh_results(target)
    print(f"season {target}: {got['games_played']}/{got['games_total']} played, "
          f"detail fetched for {got['detail_games']} new game(s)")
    build_team_strength()     # roster-based prior (also rebuilds team_goaltending)

    # Same forecast + persist the in-Snowflake notebook runs, so the two
    # backends cannot drift apart in the model math.
    res = forecast(cfg=cfg)
    persist(res)

    print(f"updated: {res['n_played']}/{res['n_total']} games played, "
          f"crowd weight {res['crowd_weight']:.2f}")
    build_site_main()

    # Publish local (dev) state to Snowflake (prod). Best-effort by design:
    # strict=False means an expired token or an offline warehouse leaves the
    # local run -- results, site, DuckDB -- completely intact.
    if sync:
        sync_all(quiet=True)


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--no-sync", action="store_true",
                    help="skip the Snowflake publish (local-only run)")
    main(sync=not ap.parse_args().no_sync)
