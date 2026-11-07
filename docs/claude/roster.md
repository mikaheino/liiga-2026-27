# Rosterit, uudet pelaajat ja ulkoiset tilastot

Siirretty CLAUDE.md:stä 23.10.2026 sanasta sanaan (tokenisäästö). Lue kun aihe on työn alla.

## Kauden alettua: kokoonpanot ovat rosterin totuus (2026-09-15)

`game_lineups` kertoo ketkä oikeasti pukeutuivat. Se on parempi lähde kuin
mikään siirtosivusto, ja se on jo kannassa. Täsmäytys:

⚠️ **`line IS NULL` ei ole pukeutuminen vaan joukkuelistaus (3.11.2026).**
Kaudella 2027 tällaisia rivejä on 2126 eikä yhdessäkään ole maalitapahtumaa,
kun taas `line IS NOT NULL` antaa siistit 20–22 pelaajaa per joukkue per
ottelu. Laske pukeutumiset **aina** `count(*) filter (where line is not null)`,
ei `count(distinct game_id)` — jälkimmäinen laskee listaukset mukaan.

Kaksi seurausta, molemmat koettu samana päivänä:

- **Listaus jää päälle pelaajan lähdön jälkeen.** Sebastian Soini oli Jukurien
  listalla vielä 31.10. vaikka hänet lainattiin Ruotsiin 19.10. Sama rivi
  paljasti virheen: 3.10. hän oli *yhtä aikaa* Jukurien ja Ässien listalla.
  Kaksi joukkuetta samana päivänä = ainakin toinen on pelkkä listaus.
- **Pukeutumattomuus ei silti ole peruste poistolle.** 68 rosteroitua ei ole
  pukeutunut kertaakaan, ja heistä 13 on listattu 20 kertaa — varavahteja ja
  ylimääräisiä, täysin aitoja rosteripelaajia. Poistoon tarvitaan ulkoinen
  tieto lähdöstä, ei pelkkä nollarivi. (Poistin Sunin ja Suoniemen tällä
  perusteella ja jouduin palauttamaan heidät.)

Rosterista poistetaan siis vain se jonka lähdöstä on **uutinen**; lisätään se
joka on **pukeutunut** tai jonka hankinnasta on uutinen.

```sql
-- pelannut mutta ei rosterissa  (pitää olla tyhjä)
-- vertaa SUKUNIMI + joukkue + pelipaikka, ei koko nimeä (ks. ansa alla)
```

Ensimmäinen ajo 15.9. löysi **21 pelaajaa jotka olivat pelanneet muttei olleet
rosterissa**, mikä on paljon enemmän kuin siirtosivuston 9 siirtoa. Rosteri on
esikausiartikkelin diff eikä pysy perässä.

Neljä ansaa, kaikki koettu:

- **Roster tulee SOPIMUSLISTOISTA, ei `+`/`–`-riveistä.** `parse_article`
  lukee rivit `Maalivahdit (3): Nimi (2027), ...`; `+`-rivit menevät vain
  `incoming_rows`:iin ulkoisten tilastojen lähdeklubia varten. Pelaajan
  lisääminen `+`-rivinä **ei tee mitään** rosterille. Päivitä myös suluissa
  oleva lukumäärä.
- **Lähtijät on merkitty ajatusviivalla `–` (U+2013), ei tavuviivalla.**
  `grep "^-"` löytää nolla riviä.
- **liiga.fi:n kokoonpanot käyttävät eri etunimimuotoa kuin sopimuslista**:
  Jakob/Jacob Crespin, Matthew/Matt Caito, Jussi/Juho Olkinuora,
  Nicholas/Nick Zabaneh. Koko nimellä täsmäytys luo **duplikaatteja** —
  lisäsin neljä ennen kuin huomasin. Tarkista aina saman joukkueen saman
  sukunimen parit. Aidot parit ovat olemassa (Erholtzin veljekset Kärpissä,
  Aleksi ja Antti Saarela Lukossa, Verner ja Veeti Miettinen KooKoossa).
- **`player_season_scoring` tallentaa nimet VERSAALEINA.** `last_name =
  'Lindbohm'` löytää nolla riviä, `ilike` löytää pelaajan täydellisine
  historioineen. Älä päättele tästä että historiaa ei ole.

Hyökkääjien `kh`/`lh` ei merkitse mallille mitään — molemmat ovat `F`.
Kokoonpanon `role` kertoo todellisen paikan (STRIKER, RIGHT_WING, …).

## Siirtolähde: huhuareena.com (2026-11-03)

Kauden aikana uudet siirrot katsotaan **huhuareena.com**in etusivulta,
osiosta *Uusimmat pelaajasiirrot* — rivit joissa lukee **VARMISTUNUT SIIRTO**.
*Uusimmat huhut* on eri osio eikä kelpaa rosteriin.

Se ei silti korvaa kokoanpanotäsmäytystä vaan täydentää sitä, ja ero on iso:
3.11. huhuareenalla oli 6 varmistunutta siirtoa, joista 4 puuttui rosterista,
kun taas `game_lineups` löysi **23** pelannutta jotka eivät olleet rosterissa.
Siirtosivusto näkee kaupat, kokoonpanot näkevät myös nostot ja lainat. Aja
molemmat; siirtosivusto kertoo lisäksi ne hankinnat jotka eivät ole vielä
pelanneet (3.11. Lucas ja Stephens).

⚠️ **Kahdessa joukkueessa pelannut ei ole puuttuva pelaaja.** Täsmäytys
ryhmittelee joukkueittain, joten lainalla tai kesken kauden siirtynyt näkyy
"puuttuvana" siinä joukkueessa jossa hän ei enää ole. Tarkista aina
viimeisimmän ottelun päivä per joukkue ennen kuin siirrät ketään: 3.11.
Tammela (Tappara 1.9.–21.10., KalPa 23.10. alkaen) ja Soini (Ässät-laina
2.–7.10., muuten Jukurit) olivat molemmat jo oikeassa joukkueessa.

## Ulkoiset tilastot: hockeydb, ei EliteProspects (2026-09-15)

**`r.jina.ai` + EliteProspects on kuollut.** Proxy vastaa, EliteProspects
torjuu sen: 403 sekä proxyn kautta että suoraan, myös täysillä
selainotsikoilla. eurohockey 403, liiga.fi:n pelaajatilastot 403.
`gql.eliteprospects.com` vastaa 400 eikä 403 — palvelin on pystyssä mutta
introspektio on kiinni, joten skeemaa ei voi arvata.

**Toimiva reitti on hockeydb.com, suoralla curlilla.** CLAUDE.md väitti sen
Cloudflare-estävän elokuusta 2026 — ei estä enää.

```
haku:    https://www.hockeydb.com/ihdb/stats/find_player.php?full_name=<sukunimi>
pelaaja: https://www.hockeydb.com/ihdb/stats/pdisplay.php?pid=<pid>
```

Viisi ansaa, kaikki koettu:

- **Hakuun vain sukunimi.** `full_name=Osipov+Aleksandr` antaa **HTTP 404**,
  pelkkä `Osipov` toimii. 404 ei siis tarkoita estoa.
- **Otsikkorivi on eri kohdassa kenttäpelaajalla ja maalivahdilla.**
  Maalivahtisivulla ryhmäotsikot ja sarakenimet ovat samalla rivillä,
  kenttäpelaajalla kahdella. Etsi se rivi jolla lukee `Season`.
- **Sivu lainaa `class`-attribuutin kaksoislainausmerkein**, hakusivu
  yksinkertaisin. Yhdelle viritetty regex löytää nolla riviä toiselta.
- **Torjunta-% on sarakkeessa `Pct`, ei `SV%`.** Se on siellä, vaikka
  merkkijonohaku `SV%` ei löydä mitään — tämän takia luulin ensin ettei
  torjuntaprosentteja ole.
- **Osalla riveistä `Pct` on tyhjä** (vanhat tai vähäiset kaudet). Jätä rivi
  pois, älä oleta nollaa.

Kausinumerointi: hockeydb `2024-25` = meidän `season = 2025`.

Skripti johon nämä on jo koodattu: istunnon `hdb.py` / `extract.py`. Jos
teet siitä pysyvän, muista `time.sleep` — sivusto on ilmainen.

## Näkymätön Liiga-historia: pisteetön pelaaja ei ole kannassa

`player_season_scoring` rakentuu maali- ja syöttötapahtumista, joten
**pelaaja joka ei tehnyt pistettäkään ei ole siellä lainkaan** — ei myöskään
`player_bio`:ssa. Ossi Sippola pelasi 14 Liiga-ottelua 2025-26 ja Ilari
Mäkinen 5, ja kanta sanoi molemmista `has_liiga_history = False`.

Tämä on eri asia kuin 5.9. korjattu nimibugi (joka koski pelaajia joilla oli
syöttöjä muttei maaleja). Tätä ei voi korjata nimikorjauksella: rivi
puuttuu kokonaan. Ennen kautta 2026-27 ainoa korjaus on ulkoinen lähde;
`game_lineups` kattaa vasta kuluvan kauden.

⚠️ **Nollatuotoksen lisääminen NOSTI arviota.** Mäkinen oli replacement
0,128 p/ottelu ja on 5 pisteettömän Liiga-ottelun jälkeen 0,219. Syy:
`regression_strength: 20` vetää pienen otoksen kohti **pelipaikan
keskiarvoa** (~0,27 hyökkääjällä), joka on paljon korkeampi kuin
replacement-vakio. Pelaaja jolla on vähän huonoa dataa arvottuu siis
korkeammalle kuin pelaaja jolla ei ole dataa lainkaan. Se on aito
epäjohdonmukaisuus mallissa — **älä korjaa kesken kauden** (AGENTS.md §10),
mutta muista se kun viritys on ajankohtainen.

## ⚠️ EliteProspects-reitti on kuollut (2026-09-15)

CLAUDE.md:n dokumentoima menetelmä **ei enää toimi**:

| reitti | tulos |
|---|---|
| `r.jina.ai` mihin tahansa | **HTTP 000** — proxy ei vastaa lainkaan |
| eliteprospects.com suoraan | 403, Cloudflare-haaste |
| eurohockey.com | 403 |
| liiga.fi `/players/stats/...` | 403, *Missing Authentication Token* |

Mikä toimi: **Wikipedia** (`en.wikipedia.org/wiki/<Nimi>`) antoi Petteri
Lindbohmin kausikohtaiset tilastot oikein — mutta vain tunnetuille pelaajille.

Seuraus: **maalivahtien torjunta-%:a ei saa mistään.** 13 rosterin
maalivahdilla ei ole riviä `goalies_raw.txt`:ssä. Malli sietää sen
(regressio priorii kohti), mutta uutta maalivahtia ei voi arvottaa oikein
ennen kuin joku syöttää torjuntaprosentit käsin.

## ⚠️ Debytantti menetti ulkomaantilastonsa (korjattu 2026-09-15)

`players.py`:n `assemble_player_seasons` yhdistää Liiga-rivit ja
`external_players.csv`:n rivit avaimella joka on **player_id jos se on
tiedossa, muuten normalisoitu nimi**. Ulkomaanrivit tulevat ilman id:tä,
joten ne tarvitsevat sillan nimestä id:hen.

Silta rakennettiin **vain kausista `< target`**. Tuontipelaajalla ei ole
yhtään sellaista: hän saa id:n vasta ensimmäisestä Liiga-pisteestään. Sinä
päivänä rosterin avain muuttuu nimestä numeroksi, ulkomaanrivit jäävät nimen
taakse, osuma jää saamatta — eikä kuluva kausi kelpaa tilalle, koska tahdin
ikkuna on sekin `season < target`.

**Pelaaja siis putosi replacement-lattialle juuri sinä päivänä kun hän
aloitti Liigassa.** George Diaco 0,275 → 0,050, Kalle Östman 0,249 → 0,050.
15.9. tällaisia oli **31 pelaajaa 14 joukkueessa**; Sportilla ja K-Espoolla
kuusi kummallakin, eli kokonainen maali per ottelu. Ennusteessa se oli
molemmilla noin −6 pistettä.

Korjaus: silta rakennetaan kaikista kausista, **`ORDER BY season`** ja
`setdefault`. Kuluvan kauden rivi voi silloin vallata vain nimen jolla ei ole
aiempaa kautta — eli täsmälleen debytantit — eikä yksikään olemassa oleva
osuma voi siirtyä.

Kaksi asiaa jotka tämä opetti:

- **`player_rates` rakentuu uudelleen vain roster-muutoksesta**, joten bugi
  oli piilossa koko syyskuun ja purkautui kerralla ensimmäisessä
  uudelleenrakennuksessa. Harvoin ajettava rebuild ei ole halpa vaan
  kerryttävä.
- **Pelaajan identiteetti vaihtuu kesken kauden.** Jokainen uusi
  pelaajia yhdistävä koodi pitää testata debytantilla, ei vain
  vakiintuneella pelaajalla.

Avoin päätös siitä miten loukkaantumisiin ja rosterimuutoksiin suhtaudutaan
jatkossa: `docs/model_improvements_in_season.md`, "TODO — decide the
in-season roster policy".

## Rosterijono sovelluksesta (7.11.2026)

Käyttäjä: "jos uusi pelaaja niin polku jolla pelaaja rosteriin standardin mukaisesti". Etusivun haku
tunnistaa pelaajan, jota `roster_2026_27`:ssä ei ole (sukunimi), vastaa silti (vaikutus joukkueen
muutoksena, xg_share +0,005…+0,03, oletus kerrotaan) ja kirjaa hänet `data/roster_requests.csv`:hen
(`lib/rosterQueue.ts`, vain paikallisesti). **Sovellus ei koskaan lisää pelaajaa malliin.** Jono:

    .venv/bin/python scripts/local/roster_queue.py            # jono + onko jo rosterissa + vaiheet 1-9
    .venv/bin/python scripts/local/roster_queue.py --done "Rasmus Kumpulainen"
    .venv/bin/python scripts/local/roster_queue.py --dismiss "<ei oikea pelaaja>"

Käsittele jono alla olevilla vaiheilla 1–9 ja commitoi `roster_requests.csv` rosterierän mukana.
Lisäyksen jälkeen ennuste päivittyy, ja tallennettu haku ajetaan avattaessa uudelleen, jolloin pelaaja
lasketaan omilla tilastoillaan. Ensimmäinen kirjaus 7.11.: Rasmus Kumpulainen (Lukko, laina 6.11.).

## Adding new players — required steps

When the user says to add a new player (new signing, transfer update):

1. **Update `data/transfers_2026_27.txt`** with the new player in the correct team section.
2. **Check for existing stats** — query `player_rates` and `raw_goal_events`/`player_season_scoring` by last name to see if the player already has Liiga history in the DB.
3. **Check that history is actually CURRENT — do this for every player, not just brand-new ones.** "Has Liiga history" only means they've played in Liiga *at some point*; it is not proof their record is up to date. A player can have five Liiga seasons on file and still be missing last season because they spent it abroad before returning. Compare the player's most recent season on file against the most recently completed season (`config.yaml → ingestion.target_season - 1`). If it's older, that's a real gap — treat it exactly like a player with no Liiga history at all (go to step 4) for the missing season(s), even though older Liiga seasons stay in the DB. **Never skip this check just because the player already showed up in step 2.** Run `python scripts/local/check_roster_coverage.py` after any roster batch to catch this systematically (flags "STALE" players — have history, but nothing in the latest completed season).
4. **Fetch external stats for any gap** — whether the player has zero Liiga history or a stale/missing recent season, look up the missing seasons (aim for the last 5, regular season only: GP, G, A, league, club).
   **Working fetch method (confirmed 2026-08-04): EliteProspects.com via the `r.jina.ai` reader proxy** — `curl -s "https://r.jina.ai/https://www.eliteprospects.com/player/<id>/<slug>/print" -A "Mozilla/5.0"` (the `/print` path is more reliably server-rendered than the main profile, which sometimes snapshots mid-JS-load and returns "No Data Found"). This bypasses EliteProspects' normal Cloudflare/scraping block and returns the verbatim season-by-season markdown table — parse it directly with regex, don't trust an AI summarizer's numeric tables. hockeydb.com used to work the same way (direct curl, or via the same jina proxy) but started hard Cloudflare-challenging both plain curl *and* the jina proxy in Aug 2026 — try it, but don't burn time on it if it 403s. For Finnish Mestis players, `mestis.fi/fi/pelaajat/<player_id>/<slug>` (same `<player_id>` as our own Liiga player_id) is directly curlable, server-rendered, and a great independent cross-check against the EliteProspects table. Note any season gaps rather than guessing.
5. **Add to `data/external_players.csv`** — format: `player_id,name,birth_year,season,league,games,goals,assists,position` (player_id and birth_year can be blank — a blank player_id resolves to the existing Liiga player automatically by name, which is exactly what lets a returnee's abroad season merge with their old Liiga rows into a `blended` rate). Combine mid-season splits into one row per season (per league if they switched leagues). League names must match `data/league_factors.csv` exactly (e.g. `AHL`, `SHL`, `Allsvenskan`, `Switzerland`).
6. **Re-run the pipeline from step 5:**
   ```python
   from liiga.transfers import build_rosters_from_article
   from liiga.players import build_player_rates
   build_rosters_from_article()
   build_player_rates()
   ```
7. **Re-run standings + rebuild site:**
   ```bash
   python scripts/local/daily_update.py        # in season -- NOT refresh_standings.py
   ```
   Before the season opens `refresh_standings.py` + `build_site.py` is the
   path; once games are played it throws away banked points and current Elo
   (see "Kesken kauden: refresh_standings.py on VÄÄRÄ skripti").
8. **Verify:** `python scripts/local/check_roster_coverage.py` — confirm the players you just touched are no longer flagged STALE (or, if they legitimately didn't play a full season anywhere last year — injury, juniors — confirm that's genuinely the case rather than a missed lookup).

9. **Commit the roster, then log its effect:**
   ```bash
   python scripts/local/roster_impact.py
   ```
   Rewrites `docs/roster_impact.md` and `data/roster_impact.csv`, and writes
   `data/roster_changes.csv` + appends to `data/roster_impact_runs.csv` --
   every committed roster version run through the pre-season forecast with
   everything else held fixed, so the delta is the roster alone. The user
   asked for this record to be kept (2026-10-09); commit the four files with
   the batch. It reads versions from git, so an uncommitted roster is not in it.

   ⚠️ **roster_impact.csv:n luvut liikkuvat takautuvasti.** Jokainen ajo
   laskee myös vanhat versiot nykyisellä tilastodatalla, joten lähtötasonkin
   pisteet muuttuvat ilman että rosteri muuttui (Tappara v0: 115,26 lokakuussa,
   115,55 marraskuussa). Se on vertailun kannalta oikein -- kaikki versiot
   samalla mittatikulla -- mutta tarkoittaa ettei tiedosto kerro mitä silloin
   laskettiin. Jäädytetyt luvut ovat `roster_impact_runs.csv`:ssä (append-only,
   `run_at` per ajo; gitistä backfillattu 9.10. alkaen) ja pelaajatason
   muutokset `roster_changes.csv`:ssä (johdettu pelkästään gitistä, ei voi
   driftata). **Vertaa rostereita aina yhden `run_at`:n sisällä** -- eri ajot
   on laskettu eri datalla.

   Adding a goalie can LOWER a team: `team_goaltending` weights rostered
   goalies by recent games, so a weaker veteran with many games pulls the
   average down (Jokerit −0,7 with Karhunen, 9.10.). That is the model's
   goalie-starts assumption, already an open item in
   docs/model_improvements_in_season.md -- not a bug in this script.

Players with prior Liiga history (e.g. returning from abroad) skip straight to step 3's coverage check instead of assuming they're covered — only skip step 4/5 (external stats) if that check confirms their most recent season is already in the DB.
