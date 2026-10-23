# Snowflake: tilit, taulut, taskit, palvelukäyttäjät

Siirretty CLAUDE.md:stä 23.10.2026 sanasta sanaan (tokenisäästö). Lue kun aihe on työn alla.

## Snowflake (migration phase 1 done, 2026-08-30)

All 21 DuckDB tables now also live in Snowflake account `uqb62234`:
`LIIGA.RAW` (source) and `LIIGA.MODEL` (derived), warehouse `LIIGA_WH`.
The repo is mirrored as a Snowflake git repository at
`LIIGA.CODE.LIIGA_REPO` (branch `main`).

**Local DuckDB is dev, Snowflake is prod.** Keep working locally exactly as
before; the publish happens on the way out. `daily_update.py` and
`refresh_standings.py` both push to Snowflake at the end of every run, so an
ordinary roster batch (step 7 below) lands in prod with no extra command.

```bash
python scripts/local/refresh_standings.py            # local run, then publishes
python scripts/local/refresh_standings.py --no-sync  # local only
python scripts/deploy/sync_to_snowflake.py --dry-run  # show routing plan
python scripts/deploy/sync_to_snowflake.py -t player_rates   # publish one table
python scripts/deploy/sync_to_snowflake.py --code     # + FETCH the git repo
```

The publish is **best-effort inside the pipeline** (`strict=False`): an
expired token, an offline warehouse or a missing `snow` CLI prints a warning
and leaves the local run — results, site, DuckDB — untouched. Run
`sync_to_snowflake.py` by hand and it fails loudly instead (exit 1), because
then the publish *is* the task. Turn it off entirely with
`snowflake_sync.enabled: false` in config.yaml.

Mechanics and the two traps (column case, HUGEINT) live in
`src/liiga/snowflake_sync.py`; don't re-derive them.

The model still runs **locally** — this was a data move, not a compute move.
`database.target` is still `duckdb`; flipping it to `snowflake` needs one
interactive browser login first (see docs/snowflake_ml_migration.md).
The site stays local-only regardless — the never-publish policy above is
unaffected by the Snowflake work.

## Snowflake ajastaa itse itsensä (2026-09-09)

Kaksi taskia `LIIGA.CODE`:ssa, DDL repossa: **`snowflake/LIIGA/CODE/tasks/`**.

| taski | ajastus | compute | tekee |
|---|---|---|---|
| `LIIGA_CHECK` | `CRON 0 5 * * * Europe/Helsinki` | serverless | laskee montako ottelua on hakematta, palauttaa luvun |
| `LIIGA_DAILY_RUN` | `AFTER LIIGA_CHECK`, `WHEN … > 0` | `LIIGA_WH` | `EXECUTE NOTEBOOK LIIGA_DAILY()` |

**Ehto ei ole "oliko eilen kierros" vaan "onko jokin ottelu alkanut yli 8 h
sitten ja yhä hakematta".** Normaalina päivänä sama asia, mutta itsekorjaava:
väliin jäänyt tai epäonnistunut ajo napataan kiinni seuraavana aamuna sen
sijaan että ottelu jäisi pysyvästi puuttumaan. Todennettu: nyt 0 → SKIPPED,
huomenna 6 → ajaa.

**05:00 on lattia, ei mieltymys (siirretty 06:00 → 05:00, 2026-09-18).**
Myöhäisimmät ottelut alkavat **17:30 UTC eli 20:30 Suomen aikaa** (16 kpl
kaudessa), ja 8 tunnin grace tekee niistä haettavia vasta **04:30**. 05:00
jättää 30 min pelivaraa. Aiempi kellonaika **ei** ole pelkkä cron-muutos:
`grace_hours` pitää laskea sekä `src/liiga/results.py`:ssä että
`snowflake/LIIGA/CODE/tasks/`:n `DATEADD(hour, -8, ...)`:ssa, ja liiga.fi on palvellut
vajaita vastauksia, joten lyhyempi grace kasvattaa sitä riskiä.

**Ajan muuttaminen: `ALTER`, ei `CREATE OR REPLACE`.** Juuri on keskeytettävä
muokkauksen ajaksi, mutta `ALTER` **säilyttää lapsen linkin** — todennettu
18.9., `predecessors` oli muutoksen jälkeen yhä
`["LIIGA.CODE.LIIGA_CHECK"]`. Tässä järjestyksessä, yhtenä `snow sql -f`
-tiedostona (tämä toimii, koska mukana ei ole Scripting-lohkoa):

```sql
ALTER TASK LIIGA.CODE.LIIGA_CHECK SUSPEND;
ALTER TASK LIIGA.CODE.LIIGA_CHECK SET SCHEDULE = 'USING CRON 0 5 * * * Europe/Helsinki';
ALTER TASK LIIGA.CODE.LIIGA_CHECK RESUME;
```

⚠️ **`SHOW TASKS` tulostuu tyhjänä `snow sql`:ssä** — sarakkeet tulevat ilman
otsikoita. Lue se `RESULT_SCAN`:illa: `SELECT "name", "state", "schedule",
"predecessors" FROM TABLE(RESULT_SCAN(LAST_QUERY_ID()))`. Ja seuraava ajoaika
on `LIIGA.INFORMATION_SCHEMA.TASK_HISTORY` — ilman tietokannan etuliitettä
tulee *Invalid identifier*. Se palauttaa ajat **tilin aikavyöhykkeessä
(Tyynenmeren)**, ei Helsingin: `19:00 -0700` on seuraavan päivän 05:00
Suomen aikaa. Älä säikähdä siitä.

Neljä asiaa jotka maksoivat oikeaa selvittelyä — älä johda näitä uudelleen:

- **`WHEN` ei tue taulukyselyä.** Vain `SYSTEM$STREAM_HAS_DATA` ja
  `SYSTEM$GET_PREDECESSOR_RETURN_VALUE` plus boolean-operaattorit. Siksi ehto
  on kaksiosainen ketju eikä yksi taski. Ehdon arviointi tapahtuu cloud
  services -kerroksessa eikä käynnistä varastoa.
- **`SYSTEM$SET_RETURN_VALUE` vaatii vakion** eikä hyväksy `:muuttujaa`, eikä
  sitä saa kutsua proseduurin sisältä (*function with side effects*). Luku
  upotetaan literaalina `EXECUTE IMMEDIATE`-lauseeseen.
- **`snow sql -f` ei kelpaa tähän.** CLI katkoo lauseet puolipisteestä, mikä
  rikkoo Scripting-lohkon, eikä taskin runko hyväksy `$$`-rajoja. Aja
  Python-konnektorilla.
- **`CREATE TASK` on tarkka lausejärjestyksestä**: `COMMENT` ennen `AFTER`:ia,
  `WHEN` viimeisenä. Ja juuren `CREATE OR REPLACE` katkaisee lasten linkin —
  lapsi on luotava uudelleen sen jälkeen. Käynnistys: **lapsi ensin, juuri
  viimeisenä.**

**Kuratoidut taulut tulevat paikallisesta ajosta.** Notebook laskee tulokset
itse liiga.fi:stä, mutta rosterit, `player_rates` ja ulkomaiset tilastot tulevat
`daily_update.py`:n synkalla. launchd-ajo ohitti synkan ennen 16.10. (`snow` ei
launchdin PATHissa) -- korjattu `_SNOW_FALLBACKS`illa ja palvelukäyttäjällä,
ks. "Snowflake-yhteydet".

## Snowflake-yhteydet: palvelukäyttäjät, ei selainkirjautumista (2026-10-16)

Käyttäjä halusi eroon jatkuvista selainkirjautumisista. Jokaisella työkuormalla
on oma palvelukäyttäjä (TYPE = SERVICE, avainpari) ja oma rajattu rooli.
Yksityiset avaimet ovat `~/.snowflake/keys/` -- **älä koskaan tulosta niitä**.

| yhteys (`~/.snowflake/connections.toml`) | käyttäjä | rooli | käyttö |
|---|---|---|---|
| `liiga_ci` (GitHubissa `ci`) | `LIIGA_CI` | `LIIGA_DEPLOYER` | näkymät, semanttiset mallit, agentti, evaluoinnit; agenttitestit (`DATA_AGENT_RUN`) |
| `liiga_sync` | `LIIGA_SYNC` | `LIIGA_LOADER` | `daily_update.py`:n synkka ja `sync_to_snowflake.py` (config.yaml) |
| `CONTAINER_SERVICES` | `MHEINO` (selain) | `ACCOUNTADMIN` | vain ylläpito: roolit, oikeudet, otteluohjelman `raw_games` |

**Käytä itse `liiga_ci`:tä kaikkiin projektin kyselyihin**, ei
`CONTAINER_SERVICES`ia: jokainen MHEINO-kutsu vanhentuneella tokenilla avaa
käyttäjälle selainikkunan. Rooli-SQL: `snowflake/_account/roles/`,
`ci_user.sql`, `loader_user.sql`.

`LIIGA_LOADER` omistaa synkattavat 9 taulua (CREATE OR REPLACE vaatii
omistajuuden). **Ei `raw_games`ia**: LIIGA_DAILY-notebook (ACCOUNTADMIN) luo sen
uudelleen, joten otteluohjelman siirto viedään ylläpitäjänä:
`snow sql -c CONTAINER_SERVICES --role ACCOUNTADMIN` + sync `-t raw_games` sillä
yhteydellä (aseta `SNOWFLAKE_CONNECTION`/config tilapäisesti) -- harvinaista.

Synkka löytää `snow`in myös launchdissa (`_SNOW_FALLBACKS`), ja testattu
`env -i` -ympäristössä: aamusynkka toimii nyt ilman PATHia ja selainta.
