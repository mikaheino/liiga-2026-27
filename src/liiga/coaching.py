"""Head-coach changes -> coaching_changes table.

Hand-curated (data/coaching_changes.csv): liiga.fi publishes no coaching
data, so Snowflake cannot derive this and the local sync publishes it.
Collected for a season-end test of one general rule ("after a coaching
change, reset the team's in-season evidence" or similar), NOT for per-team
manual adjustments -- see docs/model_improvements_in_season.md.

`change_date` is the day the new coach took over; `season` follows the
project's numbering (2026-27 = 2027). Team names must match stg_games.

    python -m liiga.coaching
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

from .db import get_connection, query_df, register_df

CSV = Path(__file__).resolve().parents[2] / "data" / "coaching_changes.csv"


def load_coaching_changes(con=None) -> pd.DataFrame:
    """Read the CSV, check team names against stg_games, write the table."""
    df = pd.read_csv(CSV, dtype={"season": int})
    own = con is None
    con = con or get_connection()
    try:
        seasons = ",".join(str(int(s)) for s in df["season"].unique())
        known = set(query_df(con, f"""
            SELECT DISTINCT home_team AS team FROM stg_games
            WHERE season IN ({seasons})""")["team"])
        unknown = sorted(set(df["team"]) - known)
        if unknown:
            raise ValueError(f"unknown team name(s) in {CSV.name}: {unknown}")
        register_df(con, "coaching_changes", df)
    finally:
        if own:
            con.close()
    return df


if __name__ == "__main__":
    print(load_coaching_changes().to_string(index=False))
