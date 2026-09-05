# Snowflake architecture

How the 2026-27 prediction runs in Snowflake, end to end. Companion to
`docs/snowflake_ml_migration.md`, which records *why* each step was taken;
this one records *what is wired to what*.

Account `uqb62234`, database `LIIGA`, warehouse `LIIGA_WH` (X-Small,
auto-suspend 60s).

```mermaid
flowchart TB
    subgraph SRC["Source — liiga.fi API"]
        S2["/games/{season}/{game_id}<br/>primary — 1 call per due game"]
        S3["/standings?season=N<br/>fallback — 1 call, snapshotted"]
    end

    subgraph NET["Egress"]
        EA["LIIGA_FI_ACCESS<br/>network rule: www.liiga.fi:443"]
    end

    subgraph RAW["LIIGA.RAW — ingested, never derived"]
        R1["raw_games · raw_goal_events · raw_assists<br/>raw_on_ice · raw_periods · raw_standings"]
        R2["game_lineups · game_goalies<br/>game_penalties · game_referees"]
        R3["player_bio · roster_2026_27 · league_factors<br/>raw_external_player_seasons · raw_goalie_seasons"]
    end

    subgraph MOD["LIIGA.MODEL — derived"]
        T1["stg_games · team_game_log<br/>team_season · player_season_scoring"]
        T2["player_rates* · team_strength · team_goaltending"]
        T3["standings_2026_27 · position_distribution_2026_27<br/>prediction_meta · prediction_history · prediction_games"]
    end

    subgraph CODE["LIIGA.CODE — orchestration"]
        G["LIIGA_REPO<br/>git mirror of github.com/mikaheino/liiga-2026-27"]
        NB["LIIGA_DAILY<br/>notebook"]
        PS["PIPELINE_SETTINGS<br/>tournament + target schemas"]
    end

    subgraph VIS["Visualisation"]
        ST["LIIGA_ENNUSTE<br/>Streamlit"]
        SV["LIIGA_ENNUSTAJA_SV<br/>semantic view"]
        AG["LIIGA_ENNUSTAJA<br/>Snowflake Intelligence agent"]
    end

    MAC["Mac — development<br/>data/liiga.duckdb"]

    S2 --> EA --> NB
    S3 --> EA
    G --> NB
    PS --> NB
    NB --> R1 & R2
    MAC -->|"git push"| G
    MAC -->|"sync_to_snowflake.py<br/>CURATED_TABLES only"| R3
    R1 & R2 & R3 --> T1 --> T2 --> T3
    T3 --> ST
    T1 & T3 & R2 --> SV --> AG
```

## Source

Two endpoints, and the call counts are the whole reason ingest is shaped the
way it is.

| Endpoint | Gives | Calls per run |
|---|---|---|
| `/games/{season}/{id}` | everything for one game: result, goals, assists, xG, periods, lineups, goalies, penalties, referees | 1 per game the schedule says is due |
| `/standings?season=N` | cumulative table per team; snapshotted so consecutive deltas can rebuild a result | 1 |
| `/games?tournament=…&season=N` | **not used** — returns 502 for the current season from this egress | 0 |

Egress goes through `LIIGA_FI_ACCESS`, whose network rule allows exactly
`www.liiga.fi:443`. The account also has a blanket `ALLOW_ALL_INTEGRATION`
(`0.0.0.0:443`) that would have worked; it is deliberately not used.

**A 200 from liiga.fi does not mean the response has anything in it.** During a
roughly ten-minute window on 2026-09-05 the standings endpoint answered 200
with a 2-byte `{}` for *every* season, and the per-game endpoint answered 200
with the two player lists but no `game` object -- from a laptop and from
Snowflake's egress alike, minutes after both had served full payloads, and back
to normal afterwards. It is upstream flapping, not a block and not a change to
the API.

Two consequences, both already in the code. Check the body, never the status
code: `_get`'s `raise_for_status()` is not enough, so `ingest_results` refuses a
payload with no `game.id` and `snapshot_standings` reports an empty table out
loud instead of writing nothing quietly. And treat an empty answer as
temporary: retry the run rather than concluding the endpoint has been withdrawn.

## Ingest — `LIIGA.RAW`

`liiga.results.ingest_results()` is the whole ingest. It reads the fixed
fixture list out of `raw_games` — nothing re-fetches the schedule — and asks
`games_needing_update()` what is due: eight hours past a game's start, or the
calendar day rolling over where the start time is unusable. One per-game
response then fills every table, because its `game` object has the same shape
as an entry in the old season list and the season-side flatteners take it
unchanged.

`liiga.standings.snapshot_standings()` records the cumulative table each run,
and `reconstruct_games()` derives a result from the movement between two
snapshots when the per-game endpoint serves a partial payload. Both tolerate
their own table not existing yet -- a first run, or a run where the endpoint
answered empty, must not crash the pipeline behind it. It refuses
ambiguity: both teams must have gained exactly one game and agree on the
score, or the fixture is left alone. Rows recovered this way carry
`result_source = 'standings_delta'`.

Everything merges through `db.replace_rows` and is keyed on `game_id`, so a
re-run replaces its own rows rather than duplicating them and a retry after a
partial failure is safe.

`ingest_all()` survives for one job only: reloading the fixture list when the
schedule genuinely changes, which is an exception the operator reports.

`data/raw/` — the on-disk JSON cache — exists only on the Mac. Snowflake's
`/tmp` is wiped between runs, which is why nothing may depend on it.

## Transform — `LIIGA.MODEL`

`liiga.transform.run_transforms()` runs four SQL files from
`src/liiga/sql/` in dependency order:

`stg_games` → `team_game_log` → `team_season` → `player_season_scoring`

This stays a **full rebuild**. Four `CREATE OR REPLACE ... AS SELECT` over
~2900 rows is cheap, and incremental SQL would break the property that makes
this work at all: the same file runs unmodified on DuckDB and Snowflake.

The transforms write and read unqualified table names, so the session needs
both schemas resolvable — see the notebook's `SEARCH_PATH`.

## Model

`liiga.pipeline.forecast()` and `persist()`. Poisson from player rates,
MOV-Elo from results, blended 40/60, 10 000 Monte Carlo seasons, crowd prior
decayed by season progress. Writes five tables, of which `prediction_games` is
the evidence table — per-game probabilities captured *before* kick-off, the
only version worth scoring a played game against.

## Orchestration

`EXECUTE NOTEBOOK LIIGA.CODE.LIIGA_DAILY()` runs three cells:

1. **Bootstrap** — `ALTER GIT REPOSITORY … FETCH`, then pull `src/liiga`,
   `config.yaml` and the curated `data/*.csv|txt` out of the git stage onto
   `/tmp` and put them on `sys.path`. `data/raw` is deliberately not pulled:
   2800 cached per-game JSONs, none of which the run needs.
2. **Context** — read `PIPELINE_SETTINGS` for tournament and target schemas,
   rewrite `config.yaml` to `database.target: snowflake`, then `USE SCHEMA`
   and `ALTER SESSION SET SEARCH_PATH`.
3. **Run** — `refresh_results()` → `build_team_strength()` → `forecast()` →
   `persist()`.

**Nothing is scheduled.** Zero tasks exist in `LIIGA`. A `TASK` calling
`EXECUTE NOTEBOOK` is all that is missing, and it waits until the model has
been checked against real in-season results.

Redeploy after a code change:

```sql
ALTER GIT REPOSITORY LIIGA.CODE.LIIGA_REPO FETCH;
CREATE OR REPLACE NOTEBOOK LIIGA.CODE.LIIGA_DAILY
  FROM '@LIIGA.CODE.LIIGA_REPO/branches/main/snowflake/'
  MAIN_FILE = 'daily_update.ipynb' QUERY_WAREHOUSE = LIIGA_WH;
ALTER NOTEBOOK LIIGA.CODE.LIIGA_DAILY
  SET EXTERNAL_ACCESS_INTEGRATIONS = (LIIGA_FI_ACCESS);
ALTER NOTEBOOK LIIGA.CODE.LIIGA_DAILY ADD LIVE VERSION FROM LAST;
```

`CREATE OR REPLACE` is required: `ADD LIVE VERSION` refuses when one already
exists, so editing in place is not enough. The notebook pulls `src/liiga`
fresh at runtime, so a change to the *package* needs only a git push — only a
change to the *notebook* needs the redeploy above.

## Dev / prod boundary

Two independent models. The Mac is development; Snowflake computes its own
results from liiga.fi. Only the model crosses over:

| Crosses | How |
|---|---|
| Code | git push → `ALTER GIT REPOSITORY … FETCH` |
| Curated inputs the pipeline cannot derive | `scripts/sync_to_snowflake.py`, defaulting to `snowflake_sync.CURATED_TABLES` |

Everything else — `stg_games`, Elo, team strength, standings, simulations —
Snowflake recomputes daily. Pushing local copies over the top would replace
its results with the Mac's, which is the opposite of the intent.
`sync_to_snowflake.py --all` forces a full push for bootstrap or recovery.

## Visualisation

- **`LIIGA.CODE.LIIGA_ENNUSTE`** — Streamlit, reads `LIIGA.MODEL`. One file
  serves both environments by detecting a Snowpark session. **Currently held
  back on purpose** while the local version is developed; do not
  `snow streamlit deploy` without being asked.
- **`LIIGA.MODEL.LIIGA_ENNUSTAJA_SV`** — semantic view over the model tables.
- **`SNOWFLAKE_INTELLIGENCE.AGENTS.LIIGA_ENNUSTAJA`** — agent with one tool,
  `cortex_analyst_text_to_sql`, pointed at that view.

## Portability traps found the hard way

Each of these cost real debugging; none is obvious from the outside.

- **`START` is a reserved word in Snowflake** (`START WITH`) and not in
  DuckDB. `stg_games.sql` failed on `start AS start_ts`. Quoting does not help
  either, because identifier case differs between the backends — the ingest
  emits `start_time` instead.
- **A stored procedure cannot set its schema context.** Both `USE SCHEMA` and
  `ALTER SESSION SET SEARCH_PATH` fail with *Unsupported statement type*. The
  transforms create and read unqualified names, so they need that context.
  This is why the pipeline is a notebook and not a procedure.
- **`SEARCH_PATH` rejects a repeated schema**, so the notebook builds it from
  an ordered set.
- **Snowpark's `session.sql()` rejects `CREATE TABLE x AS SELECT a AS b`**
  with `SnowparkSQLUnexpectedAliasException` — the shape of every transform.
  `db.execute` runs DDL through the underlying cursor instead.
- **Streamlit in Snowflake is an older build**: no `st.column_config`, and
  `width="stretch"` is rejected because `width` is an int there.
  `streamlit_app.full_width()` measures the signature rather than guessing
  from a version number.
- **Column case.** `INFER_SCHEMA` reproduces Parquet names verbatim, so
  lower-case names become quoted, case-sensitive identifiers and unquoted SQL
  stops resolving them. `snowflake_sync` upper-cases on the way out and
  `db.query_df` lower-cases on the way back.
- **DuckDB `HUGEINT`** has no Snowflake equivalent and arrives in pandas as
  float64; counting stats are cast to `BIGINT` on export.
