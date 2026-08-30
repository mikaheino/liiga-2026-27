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

## Phase 2 — what the account actually supports (verified 2026-08-30)

Snowflake 10.30.102, AWS us-west-2. All checked against this account, not
assumed:

| | |
|---|---|
| `EXECUTE NOTEBOOK` | supported -- so a notebook can be driven by a TASK |
| Python packages | requests 2.34, pandas 3.0.5, numpy 2.5.1, scipy 1.9.3, scikit-learn 1.9.0, pyyaml 6.0.3, streamlit 1.52.2, snowflake-ml-python 1.9.2 |
| liiga.fi egress | works, via the narrow `LIIGA_FI_ACCESS` integration + `LIIGA.CODE.LIIGA_FI_RULE` (`www.liiga.fi:443`) |
| Preseason data | `tournament=valmistavat_ottelut&season=2027` -- 51 games, all played |

`snowflake-ml-python` is available but still not a fit, for the reason in the
original plan: this is not a trained sklearn model.

## Phase 2 — plan changed to a scheduled notebook

The original plan below proposed six Snowpark stored procedures plus a Task
DAG. **That is superseded.** The pipeline is already one Python entry point
and the repo is already mirrored into Snowflake as a git repository, so a
notebook runs it nearly as-is; decomposing into six procedures buys
per-stage retry granularity a seconds-long pipeline does not need.

There is also a hard technical reason. A stored procedure **cannot set its
schema context** -- both `USE SCHEMA` and `ALTER SESSION SET SEARCH_PATH`
fail with *Unsupported statement type*. The transforms in `src/liiga/sql`
create and read unqualified table names, so they need that context. A
notebook is a session and can do both.

### What already runs inside Snowflake (proven, not designed)

A stored procedure bootstrapping from the git repo got this far:

- pulls `src/liiga`, `config.yaml` and the curated `data/*.csv|txt` out of
  `@LIIGA.CODE.LIIGA_REPO` onto `/tmp` and imports the package
- `get_connection()` returns the `ActiveSession` wrapper, and `ingest_all()`
  fetched liiga.fi and wrote 391 games / 1116 goal events / 1699 assists
  straight into Snowflake tables via `write_pandas`

`data/raw` is deliberately never pulled: it is 2800 cached per-game JSONs,
and the season-level endpoint returns the same facts in six calls.

### Division of labour (the point of the whole thing)

Local DuckDB and Snowflake run **independent** models. Only the model itself
crosses over, and it crosses through git:

- **local -> Snowflake:** code, and the curated inputs the pipeline cannot
  derive (`player_rates`, `roster_2026_27`, `league_factors`,
  `raw_external_player_seasons`, `raw_goalie_seasons`, `player_bio`)
- **Snowflake computes daily by itself:** ingest from liiga.fi -> transforms
  -> team strength -> Elo -> Poisson -> simulation -> `LIIGA.MODEL` -> Streamlit

This means `sync_all()` must stop publishing derived MODEL tables on every
local run once the notebook is live, or the Mac will overwrite Snowflake's
own results. Not yet changed.

### Remaining work

1. Wrap the bootstrap + pipeline in a notebook (`USE SCHEMA` works there).
2. `daily_update.py`'s tail writes `prediction_history` through DuckDB-only
   calls (`con.register`, `con.execute`) -- needs a portable version.
3. Narrow the local publish to curated inputs only.
4. Schedule it. **Deliberately not done**: there are no regular-season games
   yet, so the real test happens when the season starts.

## Cost control (2026-08-30)

Credits are spent only while something runs or someone is looking:

- `LIIGA_WH` -- X-Small, `AUTO_SUSPEND = 60` (Snowflake's minimum),
  `AUTO_RESUME = TRUE`, `STATEMENT_TIMEOUT_IN_SECONDS = 1800` so a runaway
  pipeline run cannot bill indefinitely
- the Streamlit app uses that same warehouse, so closing the browser tab
  leads to suspension within a minute
- **zero tasks exist in `LIIGA`** -- nothing runs on a schedule

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

**Update 2026-08-30:** the user then made that separate, explicit decision —
`LIIGA.CODE.LIIGA_ENNUSTE`, a Streamlit app carrying the position heatmap and
the forecast-history chart, now runs in Snowflake. That is a deliberate call,
not a side effect, and it is narrower than "host the site": `site/index.html`
itself is untouched and still local-only, and the never-publish rule (which
is about the claude.ai artifact) is unaffected.

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
