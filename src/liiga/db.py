"""Database connection seam: DuckDB locally, Snowflake in production.

This is the ONLY place that knows which backend we are on. Everything else in
the pipeline talks to a connection object and runs portable SQL, so moving from
local DuckDB to production Snowflake is a one-line change in config.yaml.

    from liiga.db import get_connection, query_df
    con = get_connection()
    df = query_df(con, "SELECT * FROM stg_games LIMIT 5")
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any

import pandas as pd

from .config import load_config, resolve_path


def get_connection(target: str | None = None):
    """Return a live DB connection for the configured (or given) target.

    target: "duckdb" or "snowflake". Defaults to config database.target.
    """
    cfg = load_config()
    db = cfg["database"]
    target = target or db["target"]

    if target == "duckdb":
        import duckdb

        path = resolve_path(db["duckdb_path"])
        path.parent.mkdir(parents=True, exist_ok=True)
        return duckdb.connect(str(path))

    if target == "snowflake":
        import snowflake.connector

        sf = db["snowflake"]

        # Preferred path: a named profile in ~/.snowflake/connections.toml.
        # It keeps credentials (and the OAuth token cache) out of this repo
        # and out of the environment entirely. Explicit database/schema/
        # warehouse/role overrides win, because the shared profile may point
        # somewhere else -- CONTAINER_SERVICES, for one, sets no database.
        name = os.environ.get(sf.get("connection_name_env", ""), "") or \
            sf.get("connection_name")
        if name:
            overrides = {k: sf[k] for k in
                         ("database", "schema", "warehouse", "role")
                         if sf.get(k)}
            return snowflake.connector.connect(connection_name=name, **overrides)

        def env(key: str) -> str:
            name = sf[key]
            val = os.environ.get(name)
            if not val:
                raise RuntimeError(
                    f"Snowflake target requires env var {name!r} (config key {key})."
                )
            return val

        return snowflake.connector.connect(
            account=env("account_env"),
            user=env("user_env"),
            password=env("password_env"),
            warehouse=env("warehouse_env"),
            database=env("database_env"),
            schema=env("schema_env"),
        )

    raise ValueError(f"Unknown database target: {target!r}")


def query_df(con, sql: str, params: list | None = None) -> pd.DataFrame:
    """Run a query and return a pandas DataFrame, backend-agnostic.

    DuckDB's Python API has .df(); the Snowflake connector cursor exposes
    .fetch_pandas_all(). This helper hides that difference.
    """
    if _is_duckdb(con):
        rel = con.execute(sql, params) if params else con.execute(sql)
        return rel.df()
    cur = con.cursor()
    try:
        cur.execute(sql, params) if params else cur.execute(sql)
        df = cur.fetch_pandas_all()
    finally:
        cur.close()
    # Snowflake returns UPPER CASE column names; DuckDB returns them as
    # written. Downstream pandas code indexes lower-case ("goals",
    # "player_id"), so normalise here rather than in every caller -- this is
    # the seam that makes the two backends interchangeable.
    df.columns = [c.lower() for c in df.columns]
    return df


def execute(con, sql: str, params: list | None = None) -> None:
    """Run a statement that returns no rows (DDL / INSERT)."""
    if _is_duckdb(con):
        con.execute(sql, params) if params else con.execute(sql)
        return
    cur = con.cursor()
    try:
        cur.execute(sql, params) if params else cur.execute(sql)
    finally:
        cur.close()


def register_df(con, name: str, df: pd.DataFrame) -> None:
    """Materialise a pandas DataFrame as a table named `name`.

    On DuckDB we register the frame and CREATE TABLE AS (fast, zero-copy-ish).
    On Snowflake we use write_pandas.
    """
    if _is_duckdb(con):
        con.register(f"_tmp_{name}", df)
        con.execute(f'CREATE OR REPLACE TABLE "{name}" AS SELECT * FROM _tmp_{name}')
        con.unregister(f"_tmp_{name}")
        return
    from snowflake.connector.pandas_tools import write_pandas

    # write_pandas creates the table from the DataFrame schema and replaces it.
    write_pandas(con, df, name.upper(), auto_create_table=True, overwrite=True)


def _is_duckdb(con) -> bool:
    # DuckDB's connection class lives in the "_duckdb" module.
    return "duckdb" in con.__class__.__module__


@contextmanager
def connection(target: str | None = None):
    con = get_connection(target)
    try:
        yield con
    finally:
        con.close()
