# Liiga 2026-27 standings predictor

Predicts the **final regular-season standings** of the Finnish hockey league
(Liiga) for **2026-27** — 17 teams, 544 games — and keeps re-predicting the
remaining fixtures every day once the season is under way.

The starting point is **player goal production, not team history**: scoring
follows players to their new clubs, which matters in a season with heavy roster
churn and a promoted club (Jokerit, up from Mestis). Team history still gets a
vote, but it arrives through a second, independent model.

> New to the codebase? `AGENTS.md` is the working manual — conventions,
> tuning knobs, backtesting rules. The notebooks walk the same ground stage by
> stage.

## How it works

Two models are built from different evidence and blended at the level of a
**single game's probabilities**, not at the level of ratings:

```
                 rosters + 5 seasons of player scoring
                              │
                              ▼
   liiga.fi API ──▶  player goal rates ──▶ team expected goals
        │                                        │
        │                                        ▼
        │                                 Poisson match model ──┐  40%
        │                                                       ├──▶ per-game
        └──▶ results ──────────▶ MOV-Elo ratings ───────────────┘  60%   probs
                                                                        │
                                                                        ▼
                              crowd prior ◀── Monte Carlo (×10 000 seasons)
                                    │                     │
                                    └────────▶ predicted final table
```

1. **Ingest** — five past seasons plus the 2026-27 fixture list. The schedule is
   fixed and already stored, so in-season runs fetch only the games that are
   due: one call per game, not per season.
2. **Player rates** — each player's Liiga-equivalent goals and points per game,
   recency-weighted, regressed for small samples, and adjusted along an age
   curve. Players arriving from abroad come from `data/external_players.csv`,
   converted with `data/league_factors.csv`.
3. **Rosters** — the official 2026-27 rosters overlaid with the edits in
   `data/transfers_2026_27.txt` (`data/rosters_2026_27.csv` is the built result).
4. **Team strength** — each roster's player rates aggregated into expected goals
   for, blended with a little team history (`team_weight`). Defence is driven by
   **goaltending**: every rostered goalie's projected save percentage rolled up
   into a per-team multiplier, blended 70/30 with shot-suppression history.
5. **Poisson match model** — expected goals become win / overtime probabilities
   and Liiga points (3/2/1/0), with a Dixon-Coles diagonal correction calibrated
   to Liiga's observed 23% overtime rate.
6. **MOV-Elo** — ratings trained on actual results, scaled by goal margin. This
   is the half of the model that learns during the season.
7. **Blend** — 40% Poisson, 60% Elo, applied to the four probabilities of each
   game. `p_home_win` is then recomputed from the blend rather than blended.
8. **Simulate** the remaining schedule 10 000 times, banking the points already
   won, then fold in a **crowd prior** whose weight decays as the season
   progresses (`crowd_weight × (1 − fraction played)`).

Backtested on 2023–26: points MAE **12.7**, log-loss **0.672** against a 0.686
base rate. That edge is thin, which is why tuning is judged on log-loss and MAE
and never on rank correlation (`AGENTS.md` §10).

## Data sources

Everything comes from the public `https://www.liiga.fi/api/v2` endpoints — no
scraping, no login.

| Endpoint | Used for |
|---|---|
| `/games/{season}/{id}` | **primary** — result, goals, assists, expected goals, periods, lineups, goalies, penalties, referees |
| `/standings?season=N` | **fallback** — snapshotted each run; the movement between two snapshots can rebuild a result the primary endpoint missed |
| `/games?tournament=…&season=N` | **not used in-season** — one bulk call per season, kept only for reloading the fixture list |

A 200 from liiga.fi does not guarantee a populated body; both readers check the
payload, not the status code. See `docs/snowflake_architecture.md`.

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e .            # add ".[snowflake]" for the Snowflake backend
```

## Run

```bash
python scripts/daily_update.py       # in-season: fetch results, re-predict, rebuild the site
python scripts/refresh_standings.py  # pre-season / after a roster edit: re-simulate only
python -m pytest tests/ -q
```

`daily_update.py` also runs from launchd at 08:30 (`scripts/com.liiga.daily-update.plist`).

Or walk through the stages:

| Notebook | Does |
|----------|------|
| `01_ingest.ipynb` | Download seasons → DuckDB |
| `02_explore.ipynb` | Sanity-check the data |
| `03_player_rates.ipynb` | Compute player production rates |
| `04_team_strength.ipynb` | Roster → team expected goals |
| `05_model_backtest.ipynb` | Train + validate the match model |
| `06_simulate_standings.ipynb` | **Predicted 2026-27 table** |

## What it produces

- **`site/index.html`** — a self-contained infographic: the projected table with
  percentile ranges, title and playoff probabilities, a position-distribution
  heatmap, where the model disagrees with the crowd, who carries each team's
  rating, and a ten-step plain-language explanation. Built by
  `scripts/build_site.py`; serve it with
  `python -m http.server 8765 --directory site`.
- **`streamlit_app/streamlit_app.py`** — the heatmap, the forecast history and a
  month-by-month fixture list with the probabilities the model gave beforehand.
  One file, two backends: it detects a Snowpark session and otherwise reads the
  local DuckDB file.
- **`prediction_games`** — one row per unplayed game per run, holding the
  probabilities as they stood. Append-only, and the only way to score the model
  honestly after the fact.

## Local vs production

**DuckDB is development, Snowflake is production**, and they are two independent
runs of the same code rather than a copy of one another. The Mac computes into
`data/liiga.duckdb`; Snowflake account `uqb62234` recomputes everything from
liiga.fi itself through the notebook `LIIGA.CODE.LIIGA_DAILY`, driven by a git
mirror of this repository. Only two things cross over: the code, via `git push`,
and the curated inputs the pipeline cannot derive, via
`scripts/sync_to_snowflake.py`.

Nothing is scheduled in Snowflake yet — the notebook is run on demand until the
model has been checked against real in-season results.

`docs/snowflake_architecture.md` has the full picture, including the portability
traps that cost real debugging.

## Tuning

Everything adjustable lives in **`config.yaml`** and the editable CSVs in
`data/`. The key knob is `team_strength.team_weight` (player model ↔ team
history). Read `AGENTS.md` §10 before changing anything: measure during the
season, tune only once it is complete.
