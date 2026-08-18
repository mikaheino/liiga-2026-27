"""Run the portable SQL transforms in dependency order.

Each file in sql/ creates one table. We run them against the active connection
(DuckDB or Snowflake), so the same SQL builds the local and production models.
"""
from __future__ import annotations

from pathlib import Path

from .config import load_config
from .db import execute, get_connection, query_df

# Dependency order matters: later models read earlier ones.
TRANSFORMS = [
    "stg_games",
    "team_game_log",
    "team_season",
    "player_season_scoring",
]


def _sql_dir() -> Path:
    return Path(__file__).resolve().parent / "sql"


def run_transforms(con=None) -> dict[str, int]:
    """Execute every transform; return row counts per table."""
    own = con is None
    con = con or get_connection()
    counts = {}
    try:
        for name in TRANSFORMS:
            sql = (_sql_dir() / f"{name}.sql").read_text(encoding="utf-8")
            execute(con, sql)
            counts[name] = int(query_df(con, f"SELECT COUNT(*) c FROM {name}")["c"][0])
    finally:
        if own:
            con.close()
    return counts


if __name__ == "__main__":
    print(run_transforms())
