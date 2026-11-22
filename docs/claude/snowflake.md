# Snowflake: tilit, taulut, taskit, palvelukäyttäjät

Siirretty CLAUDE.md:stä 23.10.2026 sanasta sanaan (tokenisäästö). Lue kun aihe on työn alla.

## Siirto Futuricen tilille control planen alle (21.11.2026)

Uusi koti: `FUTURICEPARTNER-FUTURICEPARTNER` (Azure West Europe), sovellus control planen alla
(`/Users/mika.heino/prod/control_plane`): `SYSADMIN -> CP_ADMIN -> LIIGA_ADMIN -> LIIGA_*`-roolit.
Taulujen ylläpitäjäomistus (ennen ACCOUNTADMIN) on nyt `LIIGA_ADMIN`, samoin taskit. Ylläpitoyhteys `futurice`
(avainpari, ei selainta). Palvelukäyttäjät `LIIGA_CI` ja `LIIGA_SYNC` käyttävät samoja avainpareja.
Ei siirretty: vanhat `<sha>`-versiot, `_DEV`-objektit, notebook ja `LIIGA_REPO`, `DOCKER_WH`. Siirto:
`control_plane/scripts/migrate/liiga.py` (account | tables | tasks | finish). Vanha tili `uqb62234` on pysäytetty
(ei taskeja, hakuja, pooleja eikä automaattisesti heräävää warehousea; kulukatto OLD_ACCOUNT_STOP) ja odottaa purkua.
Sovellus: https://iqazf-futuricepartner-futuricepartner.snowflakecomputing.app (STAGING `eqazf-...`).

**Todennettu 22.11.2026:** vanhalla tilillä kaikki taskit, warehouset, 5 sovelluspalvelua ja poolit SUSPENDED,
OLD_ACCOUNT_STOP 0,00 krediittiä (ainoa käynnissä oleva taski on Snowflaken oma `SNOWFLAKE.MODELS.CORTEX_BASE_MODELS_REFRESH_TASK`).
⚠️ Siirrosta puuttui **`LIIGA.CODE.PIPELINE_SETTINGS`** (luotu aikanaan käsin, ei DDL:ää repossa), joten
`LIIGA_DAILY_RUN` kaatui 21.–22.11. ja Snowflake jäi paikallisesta jälkeen (194 vs 200 ottelua). DDL nyt
`snowflake/LIIGA/CODE/tables/PIPELINE_SETTINGS.sql`; siirron jälkeen tarkista aina `LIIGA_DAILY_RUN`in ensimmäinen ajo.

### Miten data päivittyy (FUTURICEPARTNER)

| klo (Helsinki) | mikä | tekee |
|---|---|---|
| 04:00 | `cp-syke` | alustan tila (jono, hyväksynnät, virheet) |
| 04:30 | `liiga-mediat` | `LIIGA.MEDIA.COLLECT_MEDIA()` |
| 05:00 | `liiga-daily` | sensori (ottelu pelattu > 8 h sitten ja hakematta) -> `EXECUTE TASK LIIGA.CODE.LIIGA_DAILY_RUN` (LIIGA_WH): tulokset, vahvuudet, ennuste |
| 07–23, 2 h välein | `liiga-daily-varmistus` | sama sensori; ajaa uudelleen vain jos ottelu yhä hakematta (pelipäivän jälkeen tai 05:00-ajo kaatui) |
| 06:00 / 06:30 | `liiga-taskivirhe` / `liiga-rosteri` | LLM-diagnoosi epäonnistuneista taskeista / rosterijono (ihminen hyväksyy) |
| ~~08:30~~ | ~~`liiga-paivitys` (Mac)~~ | pois päältä 22.11.2026: kuratoidut taulut ja pelaajamalli `LIIGA_DAILY_RUN`issa (`src/liiga/curated.py`), uutistaulut `recompute.yml`:stä (`publish_news.py`). Mac tarvitaan vain `liiga-rosteri`in |
| 30 min välein | `liiga-otteluvahti` | ajaa vain ottelun aikana |

**Ei Macia (22.11.2026).** `LIIGA_DAILY_RUN` lataa bundlen `data/`-tiedostoista (gitistä) kuratoidut taulut
ja laskee rosterin ja pelaajamallin uudelleen vain, kun rosterin syötteet muuttuvat (sormenjälki
`LIIGA.CODE.PIPELINE_STATE`); muuten ennusteen luvut pysyvät samoina. Vertailu ilman kirjoituksia:
`EXECUTE CODE BUNDLE LIIGA.CODE.LIIGA_DAILY_BUNDLE ENTRYPOINT = 'rates_check.py'`. Taulujen omistaja LIIGA_ADMIN.
Rosterimuutos Snowflakeen = rosterityön commit mainiin -> deploy-bundle.yml -> seuraava päivän ajo.

**Kertaluonteinen siirtymä (päätös 22.11.2026, korjaus, ei viritys).** `players.assemble_player_seasons` valitsi kahden
saman kauden ulkomaanjakson (esim. AHL + NCAA) välillä numpyn quicksortin mukaan, joten Mac ja Snowflake laskivat eri
luvut. Nyt vakaa järjestys (`kind="stable"`). Ensimmäinen rosterimuutos mainissa laskee pelaajamallin uudelleen, ja
silloin 13 pelaajan ennuste muuttuu kerran enintään 0,043 p/ott (joukkueiden summat enintään 0,043): Sampo Ranta,
Gabriel Nitz, Miks Tumanovs, Andrew Lucas, Andrej Sustr, Linus Sjödin, Arvid Costmar, Kyle Crnkovic, Kasper Kotkansalo,
Oula Palve, Brett Harrison, Markus Niemeläinen, Ethan Prow. Hyväksytty; jaksojen yhdistäminen ei kuulu tähän (mallimuutos).
Rosterimuutokset tulevat PR:nä (control planen liiga-rosteri, kierros 4).

Ajastukset harvennettu 22.11.2026 (ennen 5–60 min välein). Politiikka: `control_plane/policies/snowflake/liiga.toml`
ja `platform.toml`. Sovellus tarkistaa `PREDICTION_META`n 10 min välein. Minimipalvelut: `CP_TICK` (serverless)
ja yllä olevat ajastukset; sovellukset sammuvat itse (auto-suspend) ja heräävät avattaessa, demoa varten
`ALTER APPLICATION SERVICE LIIGA.APP.LIIGA_ENNUSTE RESUME` ~5 min etukäteen. Suurin CP_WH-kuluttaja on
avoinna oleva CP_DEMO-sovellus (pollaa) -- sammuta demojen välillä.

## Tila hyväksynnässä (22.11.2026 illalla, kierros 7)

- Ajot ilman Macia: LIIGA_DAILY_RUN (koodibundle, task) ja uutiset ajetaan Snowflakessa control planen kautta;
  median ontologia `liiga-media-ontologia` (EXTRACT_MEDIA_EVENTS) ajettu control planesta (ajo 151, 2 uutta tapahtumaa).
  Viimeisin Macin kirjoitus: LIIGA_SYNC 22.11. klo 8.32-8.33 (Helsinki, aamusynkka ennen siirtoa); launchd-synkkaa ei ole.
  Mac (`com.controlplane.worker`) tarvitaan enää vain liiga-rosteriin. LIIGA_SYNC poistetaan aikaisintaan 29.11.2026.
- Media julkaistaan CI:stä: `snowflake/LIIGA/MEDIA/deploy_media.sql` (deploy-bundle.yml, rooli LIIGA_DEPLOYER, omistaa
  vain V_TEAM_PATTERNS:n ja LIIGA_MEDIA_SEARCH:n). Taulut ja AI-proseduurit: `_schema.sql` (LIIGA_ADMIN).
- Joukkueet otsikoista: nimen vartalo + yksiselitteinen kotikaupunki (Oulu, Rauma, Pori, Kuopio, Jyväskylä,
  Hämeenlinna, Lappeenranta, Kouvola, Mikkeli, Vaasa, Turku, Espoo; ei Tamperetta eikä Helsinkiä). Ilman joukkuetta
  40/517 (ennen 42/515). Agentin haku ei sisällä event_type `other` eikä `off-ice` -rivejä.
- Agentin markdown: ei tunnuksia osoitteessa, ei kenoviivaa sisäisessä polussa, suunnanvaihtomerkit poistetaan.
- Historiataulut vain lisääviä; syötteen latauksesta joukkuediff PIPELINE_CHECKSiin (`forecast_input_diff`).

## Ennusteen syötteet siirron jälkeen (M4, tarkistettu 23.11.2026)

Katselmoinnin huoli: 22.11. kuratoitujen taulujen drift-lataus (league_factors, raw_external_player_seasons,
raw_goalie_seasons gitistä) muutti päivän ennustetta ilman uusia otteluita.

Tarkistus (Macin data/liiga.duckdb vs. LIIGA.MODEL):
- Macin viimeinen ennuste ennen siirtoa: PREDICTION_META updated_at 2026-11-22T06:32Z, 200 ottelua.
- Snowflaken ajo drift-latauksen jälkeen: 2026-11-22T16:09Z, 200 ottelua.
- standings_2026_27 joka sarakkeessa (mean_points, p05/p95, p_title, p_top_playoff, mean_rank, crowd_*): max |Δ| = 0,
  kaikki 17 joukkuetta. PREDICTION_HISTORY 20.–22.11.: max |Δ| = 0.
- Syy: ennuste lukee data/goalies_raw.txt, external_players.csv ja league_factors.csv suoraan tiedostoista
  (goalies.parse_goalie_seasons, external.py, players.py), ei näitä tauluja. Macin työhakemiston data/ = git
  (viimeisin muutos df05ad0 7.11., ei paikallisia muutoksia). Drift-lataus korjasi vain taulut vastaamaan gittiä.
- Päätös: syötteitä ei palauteta (git = Macin käyttämä); tämän päivän muutos ennusteeseen = 0.

Suojaukset jatkossa:
- Historiataulut (prediction_history, prediction_games, position_distribution_history, line_history,
  prediction_games_challenger) ovat vain lisääviä: db.append_snapshot vaihtaa vain ajon oman päivän rivit
  (DELETE päivä + INSERT samassa transaktiossa), taulua ei luoda uudelleen.
- Kun ajo lataa syötteitä (curated.sync: loaded / rebuilt), LIIGA_DAILY_RUN kirjaa joka joukkueen ennen/jälkeen
  PIPELINE_CHECKSiin (check_name forecast_input_diff, status CHANGED / UNCHANGED, ottelumäärä ennen ja jälkeen).

## Muut mediat ja mobiilisovellus (21.11.2026)

- `LIIGA.MEDIA.MEDIA_LINKS`: Ilta-Sanomien, Iltalehden ja MTV:n Liiga-otsikot ja linkit, sovelluksen Mediat-sivu.
  **Tekoälykäyttö sallittu 22.11.2026** (Mika Heinon ilmoittama lupa, laajuus otsikot ja linkit; robots.txt kieltää
  yhä AI-robotit, joten keräys ei hae artikkelitekstiä). Ennen tätä skeema oli vain LIIGA_APPille.
- **Median ontologia (22.11.2026):** `EXTRACT_MEDIA_EVENTS()` poimii uusista otsikoista pelaajat ja valmentajat
  (`AI_EXTRACT`) ja tapahtumatyypin (`AI_CLASSIFY`: suspension, injury, transfer, coaching, game result, crisis,
  off-ice, other) tauluun `MEDIA_EVENTS`; pelaajat liitetään `ROSTER_2026_27.player_id`:hen ja valmentajiksi
  korjataan nimet, jotka ovat valmentajia muualla tai `COACHING_CHANGES`issa. Haku `LIIGA_MEDIA_SEARCH`
  (TARGET_LAG 1 day) on agentin työkalu `liiga_media`. Control plane `liiga-media-ontologia` 04:45, sensori =
  poimimattomat otsikot (0 -> ei tekoälykulua). Ontologiakäsite `MediaEvent` (`control_plane/catalog/liiga.toml`).
  Agentilla **analytical search** päällä (22.11.2026, `orchestration.capabilities`): laskenta- ja trendikysymykset
  otsikoiden yli (AI_FILTER/AI_EXTRACT/AI_AGG + SQL, 2-6 min, lisäkulu vain silloin); budjetti 600 s.
  Rajoite: otsikoissa on harvoin nimiä; pelaajia vain muutamassa ja rosteriin täsmää harva.
  Keräys `LIIGA.MEDIA.COLLECT_MEDIA()` (oma verkkosääntö `LIIGA_MEDIA_RULE`), control plane `liiga-mediat` kerran yössä 04:30.
  Jatkoaika puuttuu: sivu renderöidään JavaScriptillä eikä syötettä ole.
- Mobiili vähin krediitein: `public/sw.js` (välimuisti heräämisen ajaksi), `WakeBanner`, sammutus 900 s,
  aikaleiman tarkistus 10 min välein.

## Snowflake (migration phase 1 done, 2026-08-30)

> Historiaa: tili `uqb62234` on 21.11.2026 alkaen FUTURICEPARTNER (ks. yllä). Mekaniikka pätee yhä.

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

> Historiaa: 21.11.2026 alkaen ajastus on control planessa ja `LIIGA_CHECK` on poistettu
> (`snowflake/LIIGA/CODE/tasks/README.md`). Sensorin ehto ja 05:00-lattia pätevät yhä.

Kaksi taskia `LIIGA.CODE`:ssa, DDL repossa: **`snowflake/LIIGA/CODE/tasks/`**.

| taski | ajastus | compute | tekee |
|---|---|---|---|
| `LIIGA_CHECK` | `CRON 0 5 * * * Europe/Helsinki` | serverless | laskee montako ottelua on hakematta, palauttaa luvun |
| `LIIGA_DAILY_RUN` | `AFTER LIIGA_CHECK`, `WHEN … > 0` | `LIIGA_WH` | `EXECUTE CODE BUNDLE LIIGA_DAILY_BUNDLE` (8.11.2026, ennen notebook LIIGA_DAILY; deploy-bundle.yml, tarkistus check.py) |

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
| `liiga_sync` | `LIIGA_SYNC` | `LIIGA_LOADER` | vain `sync_to_snowflake.py` (palautus); poistetaan aikaisintaan 29.11.2026, kun ajot ovat olleet viikon puhtaita |
| `futurice` | `MHEINO` (avainpari) | `ACCOUNTADMIN` / `LIIGA_ADMIN` | ylläpito: roolit, oikeudet, otteluohjelman `raw_games` |
| `CONTAINER_SERVICES` | `MHEINO` (selain) | `ACCOUNTADMIN` | **vain vanha tili `uqb62234`** (pysäytetty, odottaa purkua) |

**Ylläpitoon `futurice`**, kyselyihin `liiga_ci`. Cortex Codessa älä vaihda aktiivista yhteyttä
`liiga_ci`:hin kesken session (katkaisee mallitokenit); käytä `futurice`a ja täysiä nimiä.
`CONTAINER_SERVICES` avaa selainikkunan. Rooli-SQL: `snowflake/_account/roles/`,
`ci_user.sql`, `loader_user.sql`.

`LIIGA_LOADER` omistaa synkattavat 9 taulua (CREATE OR REPLACE vaatii
omistajuuden). **Ei `raw_games`ia**: LIIGA_DAILY-notebook (ACCOUNTADMIN) luo sen
uudelleen, joten otteluohjelman siirto viedään ylläpitäjänä:
`snow sql -c futurice --role LIIGA_ADMIN` + sync `-t raw_games` sillä
yhteydellä (aseta `SNOWFLAKE_CONNECTION`/config tilapäisesti) -- harvinaista.

Synkka löytää `snow`in myös launchdissa (`_SNOW_FALLBACKS`), ja testattu
`env -i` -ympäristössä: aamusynkka toimii nyt ilman PATHia ja selainta.
