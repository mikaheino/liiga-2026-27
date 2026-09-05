# Optimization Log - Liiga Ennustaja

## Agent details
- Fully qualified agent name: `SNOWFLAKE_INTELLIGENCE.AGENTS.LIIGA_ENNUSTAJA`
- Clone FQN (development/staging): `SNOWFLAKE_INTELLIGENCE.AGENTS.LIIGA_ENNUSTAJA_DEV`
- Owner / stakeholders: Mika Heino (Recordly)
- Purpose / domain: Finnish ice hockey league (Liiga) 2026-27 season standings and match predictions
- Current status: staging / optimizing

## Evaluation dataset
- Location: Verified queries in `LIIGA.MODEL.LIIGA_ENNUSTAJA_SV`
- Coverage: Standings, championship probabilities, top scorers, team strengths, head-to-head match predictions, daily games

## Agent versions
- `v20260904-0320`: Baseline configuration snapshot, setup dev clone, fixing match predictions for "tämän päivän pelit"

## Optimization details
### Entry: 2026-09-04 03:20
- Version: `v20260904-0320`
- Goal: Enable agent to accurately answer "miten tämän päivän pelit päättyvät" (and upcoming game predictions) using Cortex Analyst (`liiga_analyst`) without falling back to Web Search.
- Changes planned:
  1. Add `GAME_DATE` and `START_TS` dimensions to `SCHEDULE` in semantic view `LIIGA_ENNUSTAJA_SV`.
  2. Add relationship `GAME_PREDICTIONS(GAME_ID) -> SCHEDULE(GAME_ID)` in `LIIGA_ENNUSTAJA_SV`.
  3. Add verified query (VQR) and AI instruction for "miten tämän päivän pelit päättyvät" (querying latest snapshot and matching game date).
  4. Explicitly instruct agent to use `liiga_analyst` for game predictions and avoid Web Search.
- Eval: Test Cortex Analyst text-to-SQL for "Miten tämän päivän pelit päättyvät?"
- Result: In progress
