# Liiga 2026-27 standings predictor

Predicts the **final regular-season standings** of the Finnish hockey league
(Liiga) for **2026-27**, built **bottom-up from player goal production** so that
scoring follows players to their new teams — important in a season with heavy
roster churn and a brand-new club (Jokerit, promoted from Mestis).

> New to ML? Read the notebooks in order — each one explains a stage.

## How it works

```
liiga.fi v2 API ─▶ DuckDB ─▶ player goal rates ─▶ team expected goals
                                                        │
              2026-27 schedule ◀── Poisson match model ◀┘
                      │
                      ▼
        Monte Carlo (×10k seasons) ─▶ predicted standings table
```

1. **Ingest** 5 past seasons + the 2026-27 schedule from the public
   `https://www.liiga.fi/api/v2/games` endpoint (no scraping).
2. **Player rates** — each player's Liiga-equivalent goals/points per game from
   the games' `goalEvents`, with recency weighting, small-sample regression, and
   an optional age curve. New/import players come from `data/external_players.csv`
   translated via `data/league_factors.csv`.
3. **Rosters** — official 2026-27 rosters overlaid with your edits in
   `data/rosters_2026_27.csv` (Jokerit, transfers).
4. **Team strength** — aggregate each roster's player rates into expected goals
   for offense, blended with a small amount of team history (`team_weight`).
   Defense is driven by **goaltending**: each rostered goalie's projected save%
   (recency-weighted, regressed) is rolled up into a per-team multiplier, blended
   70/30 with shot-suppression history (`goalie_weight`). Jokerit and other teams
   with no shot-suppression history fall back to league-neutral on that component.
5. **Match model** — a Poisson goals model turns expected goals into win / OT
   probabilities and Liiga points (3/2/1/0). Backtested against naive baselines.
6. **Simulate** the full schedule 10,000 times for the predicted final table.

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e .            # add ".[snowflake]" for the production backend
```

## Run

For a quick end-to-end refresh after editing rosters, goalie data, or config:

```bash
python scripts/refresh_standings.py   # rebuilds team_strength + runs 10k simulations
```

Or walk through the stages with notebooks:

| Notebook | Does |
|----------|------|
| `01_ingest.ipynb` | Download seasons → DuckDB |
| `02_explore.ipynb` | Sanity-check the data |
| `03_player_rates.ipynb` | Compute player production rates |
| `04_team_strength.ipynb` | Roster → team expected goals |
| `05_model_backtest.ipynb` | Train + validate the match model |
| `06_simulate_standings.ipynb` | **Predicted 2026-27 table** |

## Tuning

Everything adjustable lives in **`config.yaml`** and three editable CSVs in
`data/`. Change a value, re-run from the relevant notebook, and the standings
update. Key knob: `team_strength.team_weight` (player model ↔ team history).

## Local vs production

`config.yaml → database.target` switches between **DuckDB** (local file) and
**Snowflake** (credentials from env vars). Pipeline code is identical for both.
