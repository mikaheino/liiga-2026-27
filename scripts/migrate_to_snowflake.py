#!/usr/bin/env python3
"""Land every DuckDB table in Snowflake (migration phase 1).

Phase 1 of docs/snowflake_ml_migration.md: move the DATA, leave the model code
running locally. Nothing here changes the model -- it is a straight copy of
every table in data/liiga.duckdb into LIIGA.RAW / LIIGA.MODEL, so that
`database.target: snowflake` becomes a viable switch.

Why it shells out to `snow` instead of using liiga.db.get_connection():
the CONTAINER_SERVICES profile authenticates with OAUTH_AUTHORIZATION_CODE,
which makes snowflake-connector-python open a browser and block. The `snow`
CLI already holds a valid cached token, so it is the only non-interactive path
today. Once key-pair auth is configured on this account, the connector path in
liiga.db works directly and this script can drop the subprocess layer.

Transport is Parquet through an internal stage rather than INSERTs: it keeps
types (no CSV round-trip guessing) and loads 50k rows in one COPY.

    python scripts/migrate_to_snowflake.py            # migrate everything
    python scripts/migrate_to_snowflake.py --dry-run  # just show the plan
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
DUCKDB_PATH = ROOT / "data/liiga.duckdb"

CONNECTION = "CONTAINER_SERVICES"
ROLE = "ACCOUNTADMIN"
WAREHOUSE = "LIIGA_WH"
DATABASE = "LIIGA"
STAGE = "LIIGA.CODE.LOAD_STAGE"

# Which schema each table lands in. RAW = ingested or hand-collected source
# data; MODEL = anything the pipeline derives from it. A table missing from
# this map is a migration bug, not a default -- see _route().
RAW_TABLES = {
    "raw_games",
    "raw_goal_events",
    "raw_assists",
    "raw_external_player_seasons",
    "raw_goalie_seasons",
    "player_bio",
    "roster_2026_27",
    "league_factors",
}


def _route(table: str) -> str:
    return "RAW" if table in RAW_TABLES else "MODEL"


def snow_sql(query: str, *, fmt: str = "json") -> list[dict]:
    """Run one or more statements through the Snowflake CLI."""
    proc = subprocess.run(
        ["snow", "sql", "-c", CONNECTION, "--role", ROLE,
         "--warehouse", WAREHOUSE, "--database", DATABASE,
         "--format", fmt, "--query", query],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"snow sql failed:\n{proc.stdout}\n{proc.stderr}")
    out = proc.stdout.strip()
    if fmt != "json" or not out:
        return []
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return []


def export_parquet(con, table: str, dest: Path) -> int:
    """Write one DuckDB table to Parquet, upper-casing names and fixing HUGEINT.

    Columns are aliased to UPPER CASE on the way out. INFER_SCHEMA reproduces
    Parquet column names verbatim, so lower-case names would become quoted,
    case-sensitive Snowflake identifiers -- and the repo's portable SQL
    (`select player_id from player_bio`, unquoted) would then fail to resolve
    them. Upper case is what an unquoted identifier normalises to, so the same
    SQL runs on both backends.

    DuckDB's HUGEINT (INT128) has no Snowflake equivalent and surfaces in
    pandas as float64. Every HUGEINT here is a counting stat -- goals,
    assists, points -- so BIGINT is lossless and keeps them integers.
    """
    cols = con.execute(
        "select column_name, data_type from information_schema.columns "
        "where table_name = ? order by ordinal_position", [table]
    ).fetchall()
    select = ", ".join(
        (f'CAST("{c}" AS BIGINT)' if d == "HUGEINT" else f'"{c}"')
        + f' AS "{c.upper()}"'
        for c, d in cols
    )
    con.execute(
        f"COPY (SELECT {select} FROM \"{table}\") TO '{dest}' (FORMAT PARQUET)"
    )
    return con.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]


def load_table(table: str, parquet: Path, schema: str) -> None:
    """Stage the Parquet file and build the Snowflake table from its schema."""
    proc = subprocess.run(
        ["snow", "stage", "copy", str(parquet), f"@{STAGE}/{table}/",
         "-c", CONNECTION, "--role", ROLE, "--database", DATABASE,
         "--overwrite"],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"PUT failed for {table}:\n{proc.stdout}\n{proc.stderr}")

    fq = f"{DATABASE}.{schema}.{table.upper()}"
    # INFER_SCHEMA reproduces the Parquet types, so the Snowflake DDL follows
    # DuckDB's rather than being hand-maintained in two places.
    snow_sql(f"""
        CREATE OR REPLACE TABLE {fq}
          USING TEMPLATE (
            SELECT array_agg(object_construct(*))
            FROM TABLE(INFER_SCHEMA(
              LOCATION => '@{STAGE}/{table}/',
              FILE_FORMAT => 'LIIGA.CODE.PARQUET_FMT'))
          );
        COPY INTO {fq}
          FROM '@{STAGE}/{table}/'
          FILE_FORMAT = (FORMAT_NAME = 'LIIGA.CODE.PARQUET_FMT')
          MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;
    """)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="print the routing plan without touching Snowflake")
    args = ap.parse_args()

    con = duckdb.connect(str(DUCKDB_PATH), read_only=True)
    tables = [t for (t,) in con.execute(
        "select table_name from information_schema.tables "
        "where table_schema = 'main' order by 1").fetchall()]

    if args.dry_run:
        for t in tables:
            n = con.execute(f'select count(*) from "{t}"').fetchone()[0]
            print(f"  {t:32} {n:>8,} rows  ->  LIIGA.{_route(t)}")
        return 0

    snow_sql(f"""
        CREATE FILE FORMAT IF NOT EXISTS LIIGA.CODE.PARQUET_FMT TYPE = PARQUET;
        CREATE STAGE IF NOT EXISTS {STAGE}
          FILE_FORMAT = LIIGA.CODE.PARQUET_FMT
          COMMENT = 'Landing zone for DuckDB -> Snowflake table copies';
    """)

    failures: list[tuple[str, str]] = []
    with tempfile.TemporaryDirectory() as tmp:
        for t in tables:
            pq = Path(tmp) / f"{t}.parquet"
            n = export_parquet(con, t, pq)
            schema = _route(t)
            try:
                load_table(t, pq, schema)
                print(f"  {t:32} {n:>8,} -> LIIGA.{schema}.{t.upper()}")
            except Exception as exc:                       # noqa: BLE001
                failures.append((t, str(exc).splitlines()[0]))
                print(f"  {t:32} {'FAILED':>8}  {exc}", file=sys.stderr)

    if failures:
        print(f"\n{len(failures)} table(s) failed:", file=sys.stderr)
        for t, msg in failures:
            print(f"  {t}: {msg}", file=sys.stderr)
        return 1

    print(f"\n{len(tables)} tables migrated.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
