"""Publish the local DuckDB state to Snowflake.

The working model is **local DuckDB is dev, Snowflake is prod**: the pipeline
keeps running locally exactly as before, and this module pushes the result up
afterwards. Nothing here reads from Snowflake or feeds back into the model, so
a Snowflake outage, an expired token or a missing CLI can never break a local
run -- callers are expected to treat a failed sync as a warning (see
`sync_all(strict=False)`, the default used by the daily pipeline).

    from liiga.snowflake_sync import sync_all
    sync_all()                          # every table
    sync_all(tables=["standings_2026_27"])

Transport is Parquet through an internal stage: it preserves types (no CSV
round-trip guessing) and lands the whole database in one COPY per table.

Why it shells out to the `snow` CLI instead of liiga.db.get_connection():
the configured profile authenticates with OAUTH_AUTHORIZATION_CODE, and
snowflake-connector-python opens a browser and blocks on it, which is fatal
for an unattended launchd run. The CLI holds its own cached token and works
non-interactively. Once key-pair auth exists on the account, this can move to
the connector and drop the subprocess layer.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from .config import load_config, resolve_path

# RAW = ingested or hand-collected source data; MODEL = anything the pipeline
# derives from it. Tables not listed here land in MODEL.
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


# What the in-Snowflake pipeline CANNOT derive for itself, and therefore the
# only thing a local run should publish. Everything else -- stg_games, Elo,
# team strength, standings, simulations -- Snowflake recomputes daily from
# liiga.fi, and pushing our copies over the top would silently replace its
# results with the Mac's.
CURATED_TABLES = [
    "league_factors",                # league-equivalency factors, hand-tuned
    "raw_external_player_seasons",   # hand-researched abroad seasons
    "raw_goalie_seasons",            # hand-collected goalie records
    "roster_2026_27",                # built from the transfers article
    "player_bio",                    # 2800 per-game API calls to rebuild
    "player_rates",                  # the model itself
    "player_rates_liiga",
    "player_rates_unified",
]


class SyncError(RuntimeError):
    """Raised when the Snowflake side of a publish fails."""


def _cfg() -> dict:
    sf = load_config().get("snowflake_sync") or {}
    return {
        "enabled": sf.get("enabled", False),
        "connection": sf.get("connection", "CONTAINER_SERVICES"),
        "role": sf.get("role", "ACCOUNTADMIN"),
        "warehouse": sf.get("warehouse", "LIIGA_WH"),
        "database": sf.get("database", "LIIGA"),
        "raw_schema": sf.get("raw_schema", "RAW"),
        "model_schema": sf.get("model_schema", "MODEL"),
        "code_schema": sf.get("code_schema", "CODE"),
        "git_repo": sf.get("git_repo", "LIIGA_REPO"),
    }


def _schema_for(table: str, c: dict) -> str:
    return c["raw_schema"] if table in RAW_TABLES else c["model_schema"]


def _snow(args: list[str], c: dict) -> subprocess.CompletedProcess:
    if not shutil.which("snow"):
        raise SyncError(
            "the Snowflake CLI ('snow') is not on PATH -- install it, or set "
            "snowflake_sync.enabled: false in config.yaml to publish manually"
        )
    return subprocess.run(
        ["snow", *args, "-c", c["connection"], "--role", c["role"]],
        capture_output=True, text=True,
    )


def _sql(query: str, c: dict) -> list[dict]:
    proc = _snow(["sql", "--warehouse", c["warehouse"],
                  "--database", c["database"], "--format", "json",
                  "--query", query], c)
    if proc.returncode != 0:
        raise SyncError(f"snow sql failed:\n{proc.stdout}\n{proc.stderr}".strip())
    out = proc.stdout.strip()
    try:
        return json.loads(out) if out else []
    except json.JSONDecodeError:
        return []


def _export_parquet(con, table: str, dest: Path) -> int:
    """Write one DuckDB table to Parquet, upper-casing names and fixing HUGEINT.

    Columns are aliased to UPPER CASE on the way out. INFER_SCHEMA reproduces
    Parquet column names verbatim, so lower-case names would become quoted,
    case-sensitive Snowflake identifiers -- and the repo's portable SQL
    (`select player_id from player_bio`, unquoted) would then fail to resolve
    them. Upper case is what an unquoted identifier normalises to, so the same
    SQL runs against either backend.

    DuckDB's HUGEINT (INT128) has no Snowflake equivalent and surfaces in
    pandas as float64. Every HUGEINT here is a counting stat -- goals,
    assists, points -- so BIGINT is lossless and keeps them integers.
    """
    cols = con.execute(
        "select column_name, data_type from information_schema.columns "
        "where table_name = ? order by ordinal_position", [table]
    ).fetchall()
    select = ", ".join(
        (f'CAST("{name}" AS BIGINT)' if dtype == "HUGEINT" else f'"{name}"')
        + f' AS "{name.upper()}"'
        for name, dtype in cols
    )
    con.execute(f'COPY (SELECT {select} FROM "{table}") TO \'{dest}\' (FORMAT PARQUET)')
    return con.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]


def _load(table: str, parquet: Path, schema: str, c: dict) -> None:
    stage = f"{c['database']}.{c['code_schema']}.LOAD_STAGE"
    fmt = f"{c['database']}.{c['code_schema']}.PARQUET_FMT"

    proc = _snow(["stage", "copy", str(parquet), f"@{stage}/{table}/",
                  "--database", c["database"], "--overwrite"], c)
    if proc.returncode != 0:
        raise SyncError(f"PUT failed for {table}:\n{proc.stdout}\n{proc.stderr}".strip())

    fq = f"{c['database']}.{schema}.{table.upper()}"
    # INFER_SCHEMA derives the DDL from the Parquet file, so Snowflake's types
    # follow DuckDB's instead of being hand-maintained in two places.
    _sql(f"""
        CREATE OR REPLACE TABLE {fq}
          USING TEMPLATE (
            SELECT array_agg(object_construct(*))
            FROM TABLE(INFER_SCHEMA(LOCATION => '@{stage}/{table}/',
                                    FILE_FORMAT => '{fmt}'))
          );
        COPY INTO {fq} FROM '@{stage}/{table}/'
          FILE_FORMAT = (FORMAT_NAME = '{fmt}')
          MATCH_BY_COLUMN_NAME = CASE_INSENSITIVE;
    """, c)


def local_tables() -> list[str]:
    import duckdb

    path = resolve_path(load_config()["database"]["duckdb_path"])
    con = duckdb.connect(str(path), read_only=True)
    try:
        return [t for (t,) in con.execute(
            "select table_name from information_schema.tables "
            "where table_schema = 'main' order by 1").fetchall()]
    finally:
        con.close()


def ensure_objects(c: dict | None = None) -> None:
    """Create the file format and stage the loader needs. Idempotent."""
    c = c or _cfg()
    _sql(f"""
        CREATE SCHEMA IF NOT EXISTS {c['database']}.{c['raw_schema']};
        CREATE SCHEMA IF NOT EXISTS {c['database']}.{c['model_schema']};
        CREATE SCHEMA IF NOT EXISTS {c['database']}.{c['code_schema']};
        CREATE FILE FORMAT IF NOT EXISTS
          {c['database']}.{c['code_schema']}.PARQUET_FMT TYPE = PARQUET;
        CREATE STAGE IF NOT EXISTS
          {c['database']}.{c['code_schema']}.LOAD_STAGE
          FILE_FORMAT = {c['database']}.{c['code_schema']}.PARQUET_FMT
          COMMENT = 'Landing zone for local DuckDB -> Snowflake publishes';
    """, c)


def fetch_git_repo(c: dict | None = None) -> str:
    """Pull the latest pushed commit into the Snowflake git repository.

    Only moves code that is already on GitHub -- uncommitted local work is
    invisible to Snowflake by design.
    """
    c = c or _cfg()
    repo = f"{c['database']}.{c['code_schema']}.{c['git_repo']}"
    rows = _sql(f"ALTER GIT REPOSITORY {repo} FETCH", c)
    return rows[0].get("result", "OK") if rows else "OK"


def sync_all(tables: list[str] | None = None, *, strict: bool = False,
             quiet: bool = False) -> dict[str, int]:
    """Publish the model to Snowflake. Returns {table: rows} for successes.

    Defaults to CURATED_TABLES, not everything: Snowflake runs its own daily
    pipeline, so publishing derived tables would overwrite its results with
    the local ones. Pass tables=local_tables() to force a full push (bootstrap
    or disaster recovery).

    strict=False (default) never raises: this runs at the tail of the local
    pipeline, and a prod publish failing must not fail a dev run.

    quiet=True drops the per-table lines but still reports the outcome --
    a silent publish is indistinguishable from no publish at all.
    """
    c = _cfg()
    if not c["enabled"]:
        if not quiet:
            print("snowflake sync: disabled (snowflake_sync.enabled = false)")
        return {}

    import duckdb

    names = tables if tables is not None else CURATED_TABLES
    path = resolve_path(load_config()["database"]["duckdb_path"])
    con = duckdb.connect(str(path), read_only=True)
    done: dict[str, int] = {}
    failures: list[tuple[str, str]] = []
    try:
        ensure_objects(c)
        with tempfile.TemporaryDirectory() as tmp:
            for t in names:
                try:
                    pq = Path(tmp) / f"{t}.parquet"
                    n = _export_parquet(con, t, pq)
                    _load(t, pq, _schema_for(t, c), c)
                    done[t] = n
                    if not quiet:
                        print(f"  {t:32} {n:>8,} -> "
                              f"{c['database']}.{_schema_for(t, c)}.{t.upper()}")
                except Exception as exc:                    # noqa: BLE001
                    failures.append((t, str(exc).splitlines()[0]))
    except Exception as exc:                                # noqa: BLE001
        if strict:
            raise
        print(f"snowflake sync SKIPPED: {exc}")
        return done
    finally:
        con.close()

    if failures:
        msg = "; ".join(f"{t}: {m}" for t, m in failures)
        if strict:
            raise SyncError(f"{len(failures)} table(s) failed -- {msg}")
        print(f"snowflake sync: {len(failures)} table(s) failed -- {msg}")
    else:
        print(f"snowflake sync: {len(done)} tables, {sum(done.values()):,} rows "
              f"published to {c['database']}")
    return done
