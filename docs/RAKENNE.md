# Repon rakenne ja mitä mikin vastaa

Periaate (16.10.2026): **`snowflake/` peilaa Snowflakea** -- tili -> tietokanta ->
skeema -> objektityyppi -> objekti, tiedoston tai kansion nimi = objektin nimi.
Paikalliset osat on jaettu tehtävän mukaan, ja jokaiselle on kerrottu sen
Snowflake-vastine.

## snowflake/ = Snowflake-tili

| repo | Snowflake-objekti | julkaisu |
|---|---|---|
| `_account/roles/<ROOLI>.sql` | roolit ja niille annetut oikeudet | ACCOUNTADMIN käsin (`_account/README.md`) |
| `_account/users/<KÄYTTÄJÄ>.sql` | palvelukäyttäjät `LIIGA_CI`, `LIIGA_SYNC` | ACCOUNTADMIN käsin |
| `_account/integrations/<NIMI>.sql` | `LIIGA_EMAIL`, `LIIGA_FI_ACCESS` | ACCOUNTADMIN käsin |
| `_account/cowork/SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT.sql` | CoWork-agenttilista | ACCOUNTADMIN käsin |
| `LIIGA/CODE/network_rules/LIIGA_FI_RULE.sql` | `LIIGA.CODE.LIIGA_FI_RULE` | ACCOUNTADMIN käsin |
| `LIIGA/CODE/notebooks/LIIGA_DAILY/` | notebook `LIIGA.CODE.LIIGA_DAILY` | `CREATE OR REPLACE NOTEBOOK ... FROM` git-reposta (docs/snowflake_architecture.md) |
| `LIIGA/CODE/tasks/<TASKI>.sql` | `LIIGA_CHECK`, `LIIGA_DAILY_RUN` | Python-konnektorilla (`tasks/README.md`) |
| `LIIGA/CODE/stages/AGENT_SKILLS/<skill>/` | `@LIIGA.CODE.AGENT_SKILLS/<sha>/<skill>/` | `deploy_agent.py` (CI) |
| `LIIGA/MODEL/views/<NÄKYMÄ>.sql` + `_order.txt` | `LIIGA.MODEL.V_*` | `deploy_views.py` (CI) |
| `LIIGA/MODEL/semantic_views/<MALLI>.yaml` | `LIIGA_ENNUSTAJA_SV_<sha>`, `LIIGA_KAUSI_SV_<sha>` | generoitu `semantic_views.py`:stä, julkaisu CI |
| `LIIGA/MODEL/procedures/<PROSEDUURI>/` | `SIMULATE_SCENARIO_<sha>`, `LINEUP_FORECAST_<sha>`, `SEND_MORNING_BRIEF_<sha>` | `deploy_tools.py` (CI) |
| `LIIGA/MODEL/cortex_search/LIIGA_TIETO/*.md` | `LIIGA_TIETO_<sha>` + taulu `AGENT_KNOWLEDGE_<sha>` | `deploy_knowledge.py` (CI) |
| `LIIGA/EVALS/_schema.sql`, `results/` | `LIIGA.EVALS` (testijoukot, evaluointiajot); `results/` ei gitissä | `agent_eval.py` (CI) |
| `SNOWFLAKE_INTELLIGENCE/AGENTS/LIIGA_ENNUSTAJA/` | agentti `SNOWFLAKE_INTELLIGENCE.AGENTS.LIIGA_ENNUSTAJA`: viimeisin spec, optimointiloki, vanhat versiot | `deploy_agent.py` (CI) |

`<sha>` = viimeisin commit, joka muutti objektin lähdettä. Kiinnitetty nimi ei
muutu koskaan; DEV-versiot ovat `_DEV`.

## scripts/ = tehtävän mukaan

| kansio | mitä | ajaa |
|---|---|---|
| `scripts/deploy/` | Snowflake-julkaisu: `deploy_views.py`, `semantic_views.py` (+ `_en`), `deploy_tools.py`, `deploy_knowledge.py`, `deploy_agent.py`, `agent_eval.py`, `sync_to_snowflake.py`, `snow_conn.py` | GitHub Actions (`deploy.yml`) ja kehittäjä DEV-aliakselle |
| `scripts/local/` | paikallinen putki ja tuotokset: `daily_update.py/.sh` (launchd 08:30), `build_site.py`, `build_instagram.py`, `refresh_standings.py` (vain esikausi), rosterityökalut, `hockeydb.py`, launchd-plist | launchd ja kehittäjä |
| `scripts/tools/` | Snowflake-työkalujen paikalliset vastineet: `skenaario.py` = `SIMULATE_SCENARIO`, `kokoonpanot.py` = `LINEUP_FORECAST` (sama lähdekoodi) | kehittäjä |
| `scripts/dev/` | koodin laatu: `quality.py` (ruff + monimutkaisuus + testit/kattavuus, lähtötaso `quality_baseline.json`), `claude_ruff_hook.py` | CI (`ci.yml`), git pre-push, Claude Code -hook |
| `scripts/experiments/` | kertaluonteiset kokeet | kehittäjä |

## Muut paikalliset

| repo | Snowflake-vastine |
|---|---|
| `src/liiga/` (malli) | sama koodi; notebook lukee sen git-reposta `LIIGA.CODE.LIIGA_REPO` |
| `data/liiga.duckdb` | `LIIGA.RAW` + `LIIGA.MODEL` samoina tauluina, yhdessä skeemassa (skeemajako vasta kauden jälkeen) |
| `data/transfers_2026_27.txt`, `external_players.csv`, `goalies_raw.txt`, `league_factors.csv`, `preseason_player_rates.csv` | kuratoidut `LIIGA.RAW`-taulut (`sync_to_snowflake.py`, rooli `LIIGA_LOADER`) |
| `data/roster_impact.csv` | `LIIGA.MODEL.ROSTER_IMPACT` |
| `data/raw/` | ei vastinetta: liiga.fi-välimuisti paikallista ajoa varten |
| `config.yaml` | mallin asetukset; simulaattorin vakiot testataan niitä vasten |
| `streamlit_app/` | Streamlit (paikallinen; Snowflake-kopiota ei päivitetä) |
| `site/`, `site_instagram/`, `logs/` | paikalliset tuotokset |
| `tests/` | pytest (CI ja pre-push, `scripts/dev/quality.py`) |
| `.githooks/pre-push` | sama laatuportti ennen pushia (`git config core.hooksPath .githooks`) |
| `.claude/settings.json` | Claude Code -hook: ruff jokaiselle muokatulle .py-tiedostolle |
| `pyproject.toml` | riippuvuudet ja ruffin asetukset (sama CI:ssä ja paikallisesti) |
| `docs/` | kehittäjän dokumentaatio; agentin tietopankki on `snowflake/LIIGA/MODEL/cortex_search/` |

## Repon ulkopuolella (tällä koneella)

| sijainti | mitä |
|---|---|
| `~/.snowflake/connections.toml` | yhteydet `liiga_ci` (julkaisu), `liiga_sync` (synkka), `CONTAINER_SERVICES` (ylläpito, selain) |
| `~/.snowflake/keys/*.p8` | palvelukäyttäjien yksityiset avaimet -- **ei koskaan repoon eikä tulosteisiin** |
| `~/Library/LaunchAgents/com.liiga.daily-update.plist` | asennettu kopio `scripts/local/com.liiga.daily-update.plist`:stä |
| `.venv/` | Python-ympäristö (`pip install -e .`) |
| GitHub: salaisuus `SNOWFLAKE_PRIVATE_KEY`, ympäristö `production`, muuttuja `PRODUCTION_PROTECTED` | CI:n kirjautuminen ja hyväksyntä |
