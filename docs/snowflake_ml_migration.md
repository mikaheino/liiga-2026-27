# Snowflake ML migration

**Status: phase 1 done (2026-08-30).** All data now lives in Snowflake;
the model still runs locally. Phases 2-4 below are not started.

## Phase 1 as built

Account `uqb62234`, connection profile `CONTAINER_SERVICES`.

| Object | Purpose |
|---|---|
| `LIIGA_WH` | X-Small, auto-suspend 60s |
| `LIIGA.RAW` | ingested + hand-collected source tables (8) |
| `LIIGA.MODEL` | everything the pipeline derives (13) |
| `LIIGA.CODE.LIIGA_REPO` | git repo, `main`, public HTTPS origin -- no secret |
| `LIIGA.CODE.LOAD_STAGE` | Parquet landing zone used by the migration script |
| `LIIGA_GITHUB_API` | API integration, prefix `https://github.com/mikaheino` |

`src/liiga/snowflake_sync.py` copies all 21 DuckDB tables (52,571 rows) via
Parquet through an internal stage. It is idempotent (`CREATE OR REPLACE`), so
re-running it re-lands the current local state.

**This is an ongoing dev -> prod publish, not a one-time migration.** Local
DuckDB is development; Snowflake is production. `daily_update.py` and
`refresh_standings.py` call `sync_all()` as their last step, and
`scripts/sync_to_snowflake.py` is the manual entry point. Inside the pipeline
the publish is best-effort (`strict=False`) so a prod failure cannot fail a
dev run; run by hand it is strict and exits non-zero.

Two things that are easy to get wrong and are handled in that script:

- **Column case.** `INFER_SCHEMA` reproduces Parquet names verbatim, so
  lower-case names become quoted, case-sensitive Snowflake identifiers and the
  repo's unquoted SQL stops resolving. The export aliases every column to
  UPPER CASE; `db.query_df` lower-cases them again on the way back so pandas
  code is unchanged.
- **HUGEINT.** DuckDB's INT128 has no Snowflake equivalent and arrives in
  pandas as float64. Every HUGEINT here is a counting stat, so the export
  casts to BIGINT.

**Auth caveat.** `CONTAINER_SERVICES` uses `OAUTH_AUTHORIZATION_CODE`.
The `snow` CLI holds a cached token and works non-interactively -- which is
why `snowflake_sync` shells out to it rather than using `liiga.db`;
snowflake-connector-python needs `keyring` (now in the `snowflake` extra) plus
**one** interactive browser login before it caches its own token. Until that
login happens, `database.target: snowflake` blocks waiting on a browser. A
key-pair credential on this account would remove the interactive step
entirely and is the right fix for scheduled runs.

## Original plan (July 2026)

The rest of this document is the original deferred plan, kept because phases
2-4 still describe the intended shape of the work. Its "deferred" framing is
now historical -- phase 1 has been done.

Revisit once the
2026-27 season actually begins and the daily-update loop (`daily_update.py` +
launchd, see AGENTS.md §3) is running against real in-season results — that's
the point where a laptop-dependent cron job becomes the least attractive part
of the current setup and migration pressure is highest. This document exists
so that decision doesn't have to be re-derived from scratch when the time
comes.

## Why (inferred, not confirmed with the user)

Two independent reasons converge:

1. **Operational**: the whole pipeline currently depends on one Mac being
   awake at 08:30 local time every day during the season
   (`~/Library/LaunchAgents/com.liiga.daily-update.plist`). That's fine
   pre-season when a missed run is a no-op refresh, but once real standings
   are being banked mid-season, a missed morning because the laptop was
   asleep or offline is a real gap. A warehouse-native scheduled task doesn't
   have that failure mode.
2. **Platform fit**: the backend is already abstracted for Snowflake
   (`src/liiga/db.py`, `database.target: snowflake` in `config.yaml`,
   SQL transforms written portably per AGENTS.md §8) — someone already
   anticipated this move. Pairing that with Snowflake ML/Snowpark specifically
   (rather than "just point the existing scripts at a Snowflake table") is
   the natural next step if the goal is to stop depending on local Python
   execution entirely, not just local storage.

Neither of these is urgent pre-season. Both get more compelling once the
model is making decisions against live results.

## What's already in place (low migration cost)

- Backend-agnostic query layer (`src/liiga/db.py`) — swapping `database.target`
  already works today for the SQL/table layer.
- SQL transforms (`stg_games`, `team_season`, `player_season_scoring`, etc.)
  are portable DuckDB ↔ Snowflake SQL already (AGENTS.md §8).
- Config-driven tuning (`config.yaml`) — no hardcoded paths/knobs to untangle
  in the modeling code itself.
- The daily pipeline is already staged and resumable (`daily_update.py`
  re-runs discrete steps, each persisting a table) — this maps naturally onto
  a Snowflake Task DAG (one task per stage) rather than needing a rewrite.

## What does NOT move (scope boundary)

The standings site (`site/index.html`, built by `scripts/build_site.py`) stays
**local-only**, per the standing policy in CLAUDE.md/AGENTS.md — this
migration is about the data/model/scheduling layer, not the front end.
Hosting the site as a Snowsight dashboard or Streamlit-in-Snowflake app would
be a separate, explicit decision (it would also mean revisiting the
never-publish policy), not a side effect of this migration. Don't fold that
in silently if/when this work actually starts.

## Target architecture (per pipeline stage)

| Stage | Today | Snowflake ML target | Notes |
|---|---|---|---|
| Ingest (`liiga.ingest`) | Python → liiga.fi API → cached JSON → DuckDB | Same fetch logic, load target becomes Snowflake table; consider an external stage + `COPY INTO` for the raw JSON cache instead of local `data/raw/` | Ingestion is I/O-bound, not compute-bound — least benefit from moving into Snowpark, but needs to land in Snowflake either way |
| Transforms (SQL models) | DuckDB SQL | Snowflake SQL (near copy-paste per AGENTS.md §8) | Already portable |
| Player rates (recency weighting, regression, age curve, league conversion) | pandas in `liiga.players` | Snowpark Python (DataFrame API mirrors pandas closely) or a Snowpark Python stored procedure running the existing pandas code server-side | Good first migration candidate — mostly vectorized aggregation, no sequential state |
| Team strength / goaltending | pandas in `liiga.team_strength`, `liiga.goalies` | Same as above | |
| Poisson match model | pandas/numpy in `liiga.model` | Snowpark Python UDF/stored procedure | Deterministic formula, portable as-is |
| Elo ratings | Python, **sequential** game-by-game state update in `liiga.elo` | Snowpark Python stored procedure (keep the sequential loop — this is the one stage that resists vectorized SQL) | Don't try to force this into pure SQL; a stored proc running the existing Python loop is the pragmatic choice |
| Monte Carlo simulation (10k trials) | numpy in `liiga.simulate` | Snowpark Python stored procedure (numpy is supported in the Snowpark sandbox) | Compute-heavy, biggest latency/cost lever if run per-request vs. once daily |
| Crowd blend | pandas in `liiga.crowd` | Snowpark Python or plain SQL (it's a simple weighted join) | Low priority, trivial either way |
| Scheduling | launchd, local Mac, 08:30 daily | Snowflake Tasks (one task per pipeline stage, chained via `AFTER`) + Streams if incremental ingestion is worth it | Removes the "laptop must be awake" dependency entirely |
| Model registry / versioning | None — config.yaml is the only versioned artifact | Snowflake ML Model Registry, if it's worth formally versioning Elo/Poisson parameter sets across the season | Optional — this isn't a trained ML model in the sklearn sense, so the registry's main value here is audit trail, not model serving |
| Feature Store | None — `player_rates`/`team_strength` are just tables | Snowflake Feature Store, if point-in-time-correct backtesting becomes a priority | Optional, mainly useful if backtesting methodology (AGENTS.md §10) gets more rigorous about leakage across a longer history |

**Cortex (Snowflake's built-in ML functions)**: evaluated conceptually, likely
not a fit. Cortex's forecasting/anomaly-detection/classification primitives
target generic tabular/time-series problems; this project's value is in the
domain-specific model structure (goaltending-driven defense, MOV-Elo,
tie-calibration, crowd blend) that a generic Cortex function wouldn't
reproduce. Worth a second look only if Snowflake ships something specifically
suited to sports win-probability modeling.

## Suggested phasing (once work actually starts)

1. **Land data in Snowflake** — ingestion + transforms only, model code still
   runs locally reading from Snowflake (`database.target: snowflake`, no
   Snowpark yet). Cheapest step, validates the backend switch alone.
2. **Move the daily-update pipeline stages into Snowpark stored procedures**,
   one stage at a time, in dependency order (player rates → team strength →
   Poisson → Elo → simulation → crowd blend) — each stage is independently
   testable against the current local output before cutting over, since the
   underlying math doesn't change, only where it executes.
3. **Replace launchd with a Snowflake Task DAG** once all stages run
   server-side.
4. **Only then** consider Model Registry / Feature Store formalization —
   these are audit/rigor upgrades, not blockers for a working migration.

## Open questions to resolve when this actually starts

- Snowflake account/warehouse sizing and cost — a 10k-trial Monte Carlo run
  is cheap locally (seconds); confirm it stays cheap on a small warehouse
  before assuming this is a wash.
- Whether `data/raw/` JSON caching (offline-safe re-runs, per AGENTS.md) has
  a Snowflake-native equivalent worth building, or whether re-fetching from
  liiga.fi on each scheduled run is acceptable.
- Credential management for the liiga.fi API fetch step running inside
  Snowflake (currently a local `requests` call) — likely an External Access
  Integration if ingestion itself moves server-side.
