"""Historiataulut vain lisääviä ja syötelatauksen joukkuediff (23.11.2026, katselmointi M4)."""
from __future__ import annotations

import duckdb
import pandas as pd
import pytest

from liiga.curated import forecast_diff, inputs_loaded
from liiga.db import append_snapshot, query_df


def _df(day, pts):
    return pd.DataFrame({"snapshot_date": [day, day], "team": ["A", "B"], "mean_points": pts})


def test_append_snapshot_keeps_other_days_and_replaces_today():
    con = duckdb.connect()
    cols = ["snapshot_date", "team", "mean_points"]
    append_snapshot(con, "h", cols, "snapshot_date", "2026-11-21", _df("2026-11-21", [1.0, 2.0]))
    append_snapshot(con, "h", cols, "snapshot_date", "2026-11-22", _df("2026-11-22", [3.0, 4.0]))
    append_snapshot(con, "h", cols, "snapshot_date", "2026-11-22", _df("2026-11-22", [5.0, 6.0]))   # uusinta
    got = query_df(con, "SELECT * FROM h ORDER BY 1, 2")
    assert got["mean_points"].tolist() == [1.0, 2.0, 5.0, 6.0]
    with pytest.raises(ValueError):
        append_snapshot(con, "h", cols, "snapshot_date", "2026-11-22' OR 1=1 --", _df("x", [0.0, 0.0]))


def test_forecast_diff_and_loaded():
    before = pd.DataFrame({"team": ["A", "B"], "mean_points": [90.0, 80.0], "p_top_playoff": [0.5, 0.2], "proj_rank": [1, 2]})
    after = before.assign(mean_points=[91.5, 80.0])
    d = forecast_diff(before, after)
    assert d["d_points"].tolist() == [1.5, 0.0] and d["d_playoff_pp"].tolist() == [0.0, 0.0]
    assert inputs_loaded({"league_factors": "loaded 24 (drift)", "roster_impact": "adopted", "player_rates": "rebuilt {}",
                          "player_bio": "+0"}) == ["league_factors", "player_rates"]
