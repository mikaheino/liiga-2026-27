# Datan haku liiga.fi:stä ja datan ansat

Siirretty CLAUDE.md:stä 23.10.2026 sanasta sanaan (tokenisäästö). Lue kun aihe on työn alla.

## ⚠️ `game_id` EI ole yksilöllinen — avain on `(season, game_id)`

Kaudet 2022–26 numeroivat ottelunsa samoilla luvuilla: **1 055 eri `game_id`:tä
2 852 ottelulle**. Kausi 2027 käyttää uutta numerointia (2 701 274 →), joten
kaikki kuluvan kauden koodi toimii — ja juuri siksi virhe ei näy.

Pelkällä `game_id`:llä liitetty historiallinen kysely yhdistää **viiden eri
ottelun** rivit yhdeksi. Se tapahtui 15.–26.9. kahdesti:

- viimeistelyonnen pysyvyydeksi tuli r = +0,39 (oikea +0,08) ja pelin
  hallinnan +0,66 (oikea +0,53); rivejä 22 208 oikean 4 616:n sijaan
- 40 minuutin johtajan historialliseksi voittoprosentiksi tuli 61 %
  (oikea 86 %)

**Mallin oma SQL on turvassa** — tarkistettu 26.9.: `player_season_scoring`
ryhmittelee `(player_id, season, team)` eikä liitä otteluihin, `team_season`
liittää `(team, season)`. Vaara on uusissa ad hoc -kyselyissä ja uudessa
koodissa.

Tunnistat sen: historiallinen luku on jääkiekoksi outo, tai rivimäärä on
moninkertainen. Liitä aina `ON a.season = b.season AND a.game_id = b.game_id`
ja ikkunoi `PARTITION BY season, game_id`.

## ⚠️ Maalitapahtuma ei ole aina maali

`raw_goal_events` sisältää tapahtumia joissa tilanne ei muutu. Todennettu
`(season, game_id)`-ikkunalla vertaamalla `home_score_after`-arvoa edelliseen:

| `goal_types` | kpl | tilanne nousi | mitä on |
|---|---|---|---|
| `RL` | 78 | 78 | onnistunut rangaistuslaukaus |
| `RL0` | 176 | **0** | **epäonnistunut rangaistuslaukaus** |
| `VT` | 232 | 232 | maali videotarkistuksen jälkeen |
| `VT0` | 299 | 1 | hylätty videotarkistuksessa |

Siksi tilanne otetaan tapahtuman omasta tilanneluvusta
(`MAX(home_score_after)`) eikä laskemalla rivejä — laskettuna 8/57 ottelun
40 minuutin tilanne meni väärin. Validoitu: 57/57 eräaineistoa vasten,
2 087/2 088 historian lopputulosta vasten.

⚠️ **AVOIN BUGI: `player_season_scoring` laskee `RL0`:t maaleiksi.** `VT0`:lla
ei ole pelaajaa, joten se putoaa pois `player_id <> 0` -ehdolla — mutta
jokainen `RL0` on kirjattu laukojalle ja `goals`-CTE laskee `COUNT(*)`. 172
haamumaalia kausilla 2022–26 (1,4 % kaikista), 127 pelaajaa, enintään 3 per
pelaaja per kausi; nykyrosterissa 55 pelaajaa ja 76 maalia. Kasvattaa juuri
rangaistuslaukauksia laukovien kärkihyökkääjien tahtia. **Ei korjattu**, koska
korjaus muuttaa mallin syötettä ja siten julkaistua ennustetta — odottaa
käyttäjän päätöstä.

## Three doors into liiga.fi, and which one is used

| Endpoint | Used for | Health |
|---|---|---|
| `/games/{season}/{id}` | **primary** — result, goals, assists, xG, periods, lineups, goalies, penalties, referees | has served partial payloads (player lists only, no `game` object) |
| `/standings?season=N` | **fallback** — cumulative table, snapshotted every run | reachable from both, but has answered 200 with an empty `{}` |
| `/games?tournament=…&season=N` | **not used** | 502 for the current season from Snowflake's egress; fine for historical seasons |

The season endpoint is not called at all. The fixture list is fixed and lives
in `raw_games`; `results.games_needing_update()` decides what is due — eight
hours past a game's start, or the calendar day rolling over when the start
time is unusable.

⚠️ **Otteluohjelman muutokset: `ingest.refresh_schedule()`, EI `ingest_all`.**
Ohje sanoi aiemmin että `ingest_all(seasons=[...])` lataa ohjelman uudelleen —
**ei lataa**: `fetch_season()` palauttaa levyvälimuistin (`data/raw/games_2027.json`,
tallennettu 5.9.) ellei `force=True`, ja `force`:lla se kirjoittaisi kaikki
kauden raakataulut uudelleen kauden päätepisteestä tuloksineen. 9.10. ohjelmassa
oli **8 siirrettyä ottelua**, pahimpana Sport–Jukurit 7.3. → 20.10.

`refresh_schedule()` hakee kauden tuoreena ja päivittää **vain pelaamattomien
otteluiden `start_time`:n**. Pelattuihin se ei koske (per-game-päätepiste on
niiden auktoriteetti), ja se **kieltäytyy** jos ottelujoukko tai joukkuepari
eroaa, koska se ei ole siirto vaan jotain mikä vaatii ihmisen. Idempotentti:
toinen ajo palauttaa 0 muutosta. `apply=False` näyttää muutokset kirjoittamatta.

```python
from liiga.ingest import refresh_schedule
refresh_schedule()            # tämän jälkeen daily_update.py
```

⚠️ **Vie ohjelma myös Snowflakeen:** `python scripts/deploy/sync_to_snowflake.py -t raw_games`
ja `EXECUTE NOTEBOOK LIIGA.CODE.LIIGA_DAILY()`. `raw_games` ei ole
`CURATED_TABLES`issa, joten `daily_update.py`:n synkka ei vie sitä, eikä
notebook hae kauden ohjelmaa (se päivittää vain pelatut ottelut
ottelukohtaisesta päätepisteestä). 9.10. siirrot jäivät Snowflakesta puuttumaan
16.10. asti: kuusi pelaamatonta ottelua väärällä ajalla, pahimmat Ilves–Jukurit
(20.10. → 24.10.) ja Sport–Jukurit (7.3. → 20.10.). Pelatut olivat oikein.

**Peruttu ottelu ilman uutta päivää** (TPS–Sport 2701370, peruttu 9.10.):
liiga.fi pitää sen vanhalla päivällä tilassa `ACTIVE_OR_NOT_STARTED` kunnes uusi
ajankohta julkaistaan, joten `refresh_schedule()` ei löydä muutettavaa. Ennuste on
silti oikein — ottelu on yhä jäljellä olevissa ja simuloidaan. Sivuvaikutukset:
paikallinen ajo hakee sen joka aamu (yksi kutsu), ja Snowflaken `LIIGA_CHECK`
laskee sen hakemattomaksi, joten `LIIGA_DAILY_RUN` ajaa joka aamu myös
otteluttomina päivinä. Molemmat loppuvat kun uusi päivä tulee ja
`refresh_schedule()` siirtää ottelun. Tarkista se kun uusi päivä on julkaistu.

Ottelu voi saada kokoonpanon ennen kuin se pelataan: HIFK–TPS (2701360, 14.10.)
on haettu siirron jälkeen, ja `game_lineups`:ssa on sille 63 riviä. Se korjaantuu
itsestään kun ottelu haetaan pelattuna (korvaus on `game_id`-kohtainen), mutta
siihen asti kaikki kokoonpanoihin perustuva pitää rajata `stg_games.ended`:llä.

When the per-game endpoint serves a partial payload, `standings.
reconstruct_games()` derives the result from the movement between two
consecutive snapshots: a team whose `games` rose by one played exactly one
game, the fixture list says against whom, and the `goals`/`goals_against`
deltas are the score. `ties` rising means it went past regulation. That
recovers the margin too, which is what keeps Elo learning.

**A 200 from liiga.fi is not proof the response has anything in it.** On
2026-09-05, for about ten minutes, `/standings` returned a 2-byte `{}` for
*every* season and the per-game endpoint returned the two player lists with no
`game` object — from the laptop and from Snowflake's egress alike, minutes
after both had served full payloads, and normal again afterwards. Upstream
flapping, not a block and not an API change. So check the body:
`ingest_results` refuses a payload with no `game.id`, `snapshot_standings`
reports an empty table out loud rather than writing nothing quietly, and both
`_latest_two` and `replace_rows` tolerate their table not existing yet. Retry
the run; do not conclude the endpoint has been withdrawn.

⚠️ **Kaksi suojausta estävät deltan käyttämisen kahdesti (korjattu 2026-09-06).**
Ilman niitä `reconstruct_games` kirjoitti viisi jo haettua tulosta toiseen
kertaan **paluuotteluun kuukausia myöhemmin**: Jukurit 4-0 Sport 5.9. ilmestyi
uudelleen muodossa Sport 0-4 Jukurit 11.12., koska syyskuun ottelu oli jo
`ended` ja seuraava pelaamaton pari oli vierasottelu. Sama viidellä ottelulla.

- **Vain kirjaamattomat ottelut ovat rekonstruoitavissa.** Jos standings
  sanoo joukkueen pelanneen yhtä monta ottelua kuin meillä on tuloksia,
  mitään ei puutu ja delta selittää ottelun joka on jo tallessa.
- **Tulevaisuuden ottelua ei ole pelattu.** `start_time <= now`, riippumaton
  ensimmäisestä ja halvempi.

Oire jonka tästä tunnistaa: joukkueella on sarjataulukossa enemmän otteluita
kuin muilla, ja `raw_games`:ssa on `ended`-rivi jonka `start_time` on
tulevaisuudessa. Tarkistus:
`SELECT * FROM raw_games WHERE ended AND start_time > <tänään>` pitää olla tyhjä.

It refuses to guess: both teams must have gained exactly one game and the two
sides must agree on the score, otherwise the fixture is left alone and
counted in `skipped`. Overtime and shootout are indistinguishable this way
(both score 2-1 and raise `ties`), so reconstructed rows are tagged
`result_source = 'standings_delta'` — exclude them from tie-rate calibration.

## Incremental ingest (since 2026-09-05)

`ingest_all()` reads only the seasons the database is missing plus the target
season (`ingest.seasons_to_ingest`). Historical seasons never change, and in
Snowflake re-reading them is not free — there is no disk cache there, so each
one was an HTTP call. Six per run became one; a cold database still self-heals
by fetching all six.

Pass an explicit list to re-read specific seasons — that is how a historical
backfill from the on-disk cache is done, **with no API calls**:
`ingest_all(seasons=[2022, 2023, 2024, 2025, 2026, 2027])`.

`run_transforms()` stays a full rebuild on purpose: four
`CREATE OR REPLACE ... AS SELECT` over ~2900 rows is cheap, and incremental
SQL would break the "same portable SQL on both backends" property.
Incrementality is about **fetching**, which is what loads the API.

All three writers now merge through `db.replace_rows` — read the table, drop
the rows this run owns, append the fresh ones. There is no portable UPDATE, so
the merge has to happen in pandas.

## In-season: per-game detail (since 2026-09-02)

`liiga.results.ingest_results()` fetches what the season endpoint cannot see —
**lineups, goalies and penalties** — from `/games/{season}/{game_id}`, into
`game_lineups` / `game_goalies` / `game_penalties` (all in `LIIGA.RAW`).

`pipeline.refresh_results()` is the single scheduled entry point: season
results → SQL transforms → per-game detail. Both `scripts/local/daily_update.py` and
the Snowflake notebook call it, so they cannot drift.

It is built for unattended runs: **no disk cache** (ingest's `data/raw/` is
right on a laptop, useless in Snowflake), **incremental** (only games not
already stored — a seven-game day costs seven calls, not 544), and
**idempotent** (a re-run replaces those games' rows).

Two API traps, both handled in `results.py` — don't re-derive them:

- `goalKeeperEvents` is a *timeline of who is in the net*, not a substitution
  list, and appears only when the state changes (a goalie who plays sixty
  minutes is absent from it). `playerId` 0 + `emptyNet` 1 is the empty net; a
  named playerId is that goalie in the net over that window, **including
  coming back after a pull**. A real substitution is a named goalie who is
  not the starter.
- Goals-against nets off empty-net goals (`goalTypes` contains `TM`),
  otherwise every trailing team's goalie looks worse than he was.
- **A penalty is filed under the OPPONENT's team object.** An event in
  `homeTeam.penaltyEvents` was committed by an away player and gave the home
  team its power play — verified 265/265 with a resolvable offender. Hence
  `penalised_team` and `drew_team`; do not reintroduce a bare `team`.
- **`suffererPlayerId` is not the fouled player.** It equals `playerId` in
  92% of cases and where it differs the named player is on the offender's own
  team. It is who serves the penalty → `server_player_id`. Who was fouled is
  not in the API, and cannot be derived.

## In-season: prediction_games is the evidence table

`persist()` writes **`prediction_games`** — one row per unplayed game per
daily run, carrying the per-game probabilities and a `snapshot_date`. It
exists because those probabilities are unrecoverable after kick-off: every
in-season measurement of the model (log-loss, Brier, calibration) depends on
having captured them beforehand. Do not "clean it up" — it is append-only
history, ~50k rows over a season.

Score a game against the last snapshot before puck drop; the join is written
out in `docs/model_improvements_in_season.md`, which also holds the ordered
list of what to improve and when. Measure after ~20 games, tune only after
the season is complete (AGENTS.md §10: log-loss and MAE, never ρ).

## ⚠️ Kaksi raakataulua ajautuu erilleen tiedostoistaan

`raw_external_player_seasons` ja `raw_goalie_seasons` ovat **kopioita**
`data/external_players.csv`:stä ja `data/goalies_raw.txt`:stä, eikä mikään
päivittäisen ajon vaihe kirjoita niitä: `load_goalie_seasons()` ei ole
missään ajopolussa, eikä `raw_external_player_seasons`:lle löydy kirjoittajaa
lainkaan.

15.9. tiedostossa oli 466 riviä ja taulussa 366, eli **taulu oli 87 riviä
jäljessä jo ennen tämän päivän muokkauksia**. Maalivahdeissa 192 vs. 175.

**Malli ei kärsi tästä**: `players.py:165` ja `external.py:_read_csv` lukevat
CSV:n suoraan, joten ennuste on aina tiedostojen mukainen. Jäljessä ovat vain
Snowflaken raportointi ja semanttinen näkymä. Päivitys käsin:

```python
register_df(con, "raw_external_player_seasons",
            pd.read_csv(resolve_path(cfg["paths"]["external_players_csv"]), comment="#"))
register_df(con, "raw_goalie_seasons", parse_goalie_seasons())
```

⚠️ **Tuntematon sarjanimi saa kertoimen 1.0.** `external.py` tekee
`ext["league"].map(fmap).fillna(1.0)`, joten kirjoitusvirhe sarjan nimessä
kohtelee kautta **Liiga-tasoisena** eikä kaadu mihinkään. Tarkista lisäysten
jälkeen: `set(ext.league) - set(league_factors.league)` pitää olla tyhjä.

## ⚠️ Kesken kauden: `refresh_standings.py` on VÄÄRÄ skripti

`refresh_standings.py` simuloi **koko kauden alusta** — se lukee
`stg_games WHERE season = target`, kaikki 544 ottelua, eikä tunne
pankitettuja pisteitä eikä vaimennettua crowd-painoa. Se on esikauden polku.

**Ero on kahdessa kohdassa, ja Elo on niistä isompi:**

| | `refresh_standings.py` | `forecast()` |
|---|---|---|
| Elo | `elo_ratings_as_of(target)` — jäädytetty kauden **alkuun** | `elo_ratings_current(target)` — sisältää pelatut |
| ottelut | kaikki 544 nollasta | pelatut pankitetaan, loput simuloidaan |
| crowd | `crowd_weight` täytenä | `× (1 − frac_played)` |

Crowd ei selitä mitään (0,200 vs. 0,1915). Elo selittää: 15.9. nykyisen ja
esikauden Elon ero oli **JYP +32,5, Pelicans +29,4, KooKoo −34,0** — 66
pistettä JYP:n ja KooKoon välillä pelkästä hetken valinnasta.

Ajoin sen 15.9. roster-muutoksen jälkeen ja se ylikirjoitti sarjataulukon
esikausityylisellä ennusteella: JYP 3. → 8., Pelicans 8. → 11., KooKoo
4. → 2. Näytti siltä että viiden laitapelaajan ja kolmen varamaalivahdin
lisäys mullisti kauden.

⚠️ **Se ei ollut data, vaan menetelmä.** Sama skripti olisi tuottanut saman
tuloksen koskemattomalla datalla. Hyvin alkaneet joukkueet menettävät sekä
Elo-nousunsa että pankitut pisteensä; huonosti alkaneet saavat esikauden
luokituksensa takaisin eikä tappioita kirjata. KooKoolla oli **0 pistettä
pankissa ja silti +6,6** — se ei voi tulla sen omista peleistä.

Oikea vertailu on sama skripti ennen ja jälkeen: yksikään joukkue ei
vaihtanut sijaa ja suurin liike oli KooKoo −0,4.

Tunnistat sen tästä: **`prediction_meta.updated_at` ei päivity**, koska
`refresh_standings.py` ei kirjoita sitä. Taulut jäävät keskenään eri ajoista.

Kauden aikana aja aina **`python scripts/local/daily_update.py`**. CLAUDE.md:n
kohta "Adding new players" askel 7 neuvoo yhä `refresh_standings.py`:tä —
se neuvo pätee vain ennen kauden avausta.

## `grace_hours`: milloin ottelua aletaan kysyä (31.10.2026)

`results.games_needing_update()` ei kysy ottelua ennen kuin **`grace_hours`
tuntia** sen alkamisesta. Lopputulos ei silti tule kellosta vaan liiga.fi:n
omasta `ended`-lipusta (`ingest._flatten_games`), joten lyhyempi odotus **ei
voi keksiä tulosta** — se voi korkeintaan käyttää yhden kutsun otteluun joka
on yhä kesken.

Oletus **8** oli syy siihen, ettei illan tulos koskaan ehtinyt sivulle samana
iltana: klo 18.30 alkanut ottelu tuli haettavaksi vasta klo 02.30. Ilta-ajo
(klo 22) ei voinut nähdä sitä rakenteellisesti, ja 30.10. myöhästynytkin
01.31 ajettu ilta-ajo jäi 59 minuuttia liian aikaiseksi — sivulla luki
"seuraava pelipäivä perjantaina 30.10." vielä lauantaiaamuna.

- **Pages: 2** (`daily_update.py --grace 2`, `pages.yml`). Tulos sivulle n.
  15 min loppusireenin jälkeen.
- **Snowflake ja Mac: 8** (oletus `pipeline.refresh_results`). Käyttäjä
  31.10.: "on myös järkevää erottaa Snowflake ajastukset tästä
  applikaatiosta" — sovelluksen tuoreus ei saa muuttaa `LIIGA_DAILY`:ä.

Kesken olevan ottelun hakeminen on turvallista: `raw_games` saa tilanteen
mutta `winner` jää tyhjäksi, `team_game_log` suodattaa `WHERE ended`, ja
tapahtumat, kokoonpanot ja maalivahdit kirjoitetaan vain päättyneille
otteluille (`ingest.py:120,163,200,233`). Sovellus vartioi `ended`-lippua
(`lib/fixtures.ts:17,29`), joten kesken oleva ottelu ei näytä tulosta.

⚠️ **Pages-runner aloittaa aina repoon kirjatusta `data/liiga.duckdb`:stä** ja
hakee kaiken sen jälkeen pelatun joka ajossa. 31.10. kirjattu kanta oli
24.10:stä, joten jokainen ajo haki 15 ottelua uudelleen. Kustannus kasvaa
joka päivä — kirjaa kanta ajoittain, muuten kevään ajot hakevat satoja
otteluita kerrallaan. (Tämä on myös selitys lokirivin "detail fetched for N
new game(s)" kasvaville luvuille; ne eivät ole jumittuneita otteluita.)

## Liveveikkauksen kentät vastauksessa (31.10.2026)

`game`-objekti sisältää valmiina sen mitä kesken olevan ottelun ennuste
tarvitsee — todettu koettimella (`scripts/live/probe.py`):

| kenttä | esimerkki | merkitys |
|---|---|---|
| `gameTime` | `3600` | kulunut peliaika sekunteina |
| `currentPeriod` | `3` | menossa oleva erä |
| `stale` | `False` | liiga.fi:n oma tuoreuslippu |
| `periods[]` | `{index, homeTeamGoals, awayTeamGoals, category, startTime, endTime}` | eräkohtainen tilanne sekunteina |

Maalitapahtumat ovat `game.homeTeam.goalEvents` / `game.awayTeam.goalEvents`,
**eivät** `game`-objektin juuressa. Avoin kysymys: päivittyvätkö `gameTime` ja
`currentPeriod` ottelun aikana vai vasta lopuksi. `live-probe.yml` vastaa
siihen seuraavan ottelun aikana.
