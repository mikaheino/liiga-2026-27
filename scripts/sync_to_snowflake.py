#!/usr/bin/env python3
"""Publish the local DuckDB state to Snowflake (dev -> prod).

Local DuckDB is development; Snowflake is production. The pipeline runs
locally as it always has, and this publishes the result. `daily_update.py`
calls it automatically at the end of every run, so this script is for manual
publishes -- after an ad-hoc roster batch, or to re-land a single table.

    python scripts/sync_to_snowflake.py                      # everything
    python scripts/sync_to_snowflake.py --dry-run            # show the plan
    python scripts/sync_to_snowflake.py -t player_rates -t roster_2026_27
    python scripts/sync_to_snowflake.py --code               # + git repo FETCH

The mechanics (Parquet through an internal stage, the column-case and
HUGEINT traps) live in liiga.snowflake_sync; see docs/snowflake_ml_migration.md.
"""
from __future__ import annotations

import argparse

from liiga.snowflake_sync import (CURATED_TABLES, _cfg, _schema_for,
                                  fetch_git_repo, local_tables, sync_all)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("-t", "--table", action="append", dest="tables",
                    help="publish only this table (repeatable)")
    ap.add_argument("--dry-run", action="store_true",
                    help="print the routing plan without touching Snowflake")
    ap.add_argument("--code", action="store_true",
                    help="also FETCH the Snowflake git repo (pushed commits only)")
    ap.add_argument("--all", action="store_true",
                    help="push EVERY table, not just the curated model inputs. "
                         "Overwrites what Snowflake's own pipeline computed -- "
                         "bootstrap and disaster recovery only.")
    args = ap.parse_args()

    c = _cfg()
    names = args.tables or (local_tables() if args.all else CURATED_TABLES)

    if args.dry_run:
        print(f"target: {c['database']} on connection {c['connection']}"
              f"{'' if c['enabled'] else '   (SYNC DISABLED in config.yaml)'}")
        for t in names:
            print(f"  {t:32} -> {c['database']}.{_schema_for(t, c)}.{t.upper()}")
        return 0

    # strict: a manual publish should fail loudly, unlike the daily run's
    # best-effort tail step.
    done = sync_all(tables=names, strict=True)
    if args.code:
        print(f"git repo fetch: {fetch_git_repo(c)}")
    return 0 if done or not names else 1


if __name__ == "__main__":
    raise SystemExit(main())
