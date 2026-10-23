# Snowflake Intelligence -agentti, työkalut ja julkaisuputki

Siirretty CLAUDE.md:stä 23.10.2026 sanasta sanaan (tokenisäästö). Lue kun aihe on työn alla.

## Snowflake Intelligence -agentti: kaksi semanttista mallia (2026-10-10)

`SNOWFLAKE_INTELLIGENCE.AGENTS.LIIGA_ENNUSTAJA` käytti yhtä 13 taulun
semanttista mallia (`LIIGA_ENNUSTAJA_SV`, ~1 250 riviä YAMLia). Nyt
kaksi, molemmat generoidaan **`scripts/deploy/semantic_views.py`**:stä:

| malli | työkalu | kattaa |
|---|---|---|
| `LIIGA_ENNUSTAJA_SV` | `liiga_ennuste` | lopputaulukko, vyöhykkeet, tulevat ottelut, vahvuudet, pelaajaennusteet |
| `LIIGA_KAUSI_SV` | `liiga_kausi` | sarjatilanne nyt, tulokset, mallin osuvuus, yllättäjät, pistepörssi, maalivahdit, kokoonpanot, aiemmat kaudet |

```bash
python scripts/deploy/deploy_views.py   # näkymät järjestyksessä (_order.txt)
python scripts/deploy/semantic_views.py --deploy --dev   # *_DEV-mallit, DEV-agentti
python scripts/deploy/semantic_views.py --deploy         # tuotanto
```

Tuotannossa 10.10. alkaen (DEV-mallit `*_DEV` jäävät aliaksen `DEV` käyttöön;
erillinen DEV-agentti poistettu 16.10.). Agentin spec: `snowflake/SNOWFLAKE_INTELLIGENCE/AGENTS/LIIGA_ENNUSTAJA/
versions/v20261010/`. Vanha `data/apply_sv.sql` + `semantic_view_backup.yaml`
on poistettu -- ajettuna se olisi korvannut uuden mallin vanhalla. Mittaus
optimointilokissa: input-tokenit −68 %, output −81 %, 9/9 oikein.

**Tilanne illalla 10.10. (kaikki mitattu, ks. optimointiloki):**

- Kuvaukset ja ohjeet **englanniksi** (`--lang en`, oletus; käännökset
  `scripts/deploy/semantic_views_en.py`, kaatuu jos vastine puuttuu). Synonyymit,
  VQR-kysymykset ja vastaukset suomeksi. −2,8 % tokeneita, sama osuvuus.
- `ENRICH` semantic_views.py:ssä: taulusynonyymit, kohdennetut sarakesynonyymit,
  20 metriikkaa. **Metriikka rajataan `ENDED`iin** jos sarake on pelaamattomassa
  ottelussa 0 eikä NULL: maalit/ottelu oli 0,88 oikean 5,12:n sijaan.
- Sarakekommentit `V_*`-näkymiin generoidaan samoista kuvauksista
  (`apply_comments()`, deploy ajaa sen). `kausi_views.sql` pyyhkii ne -- aja
  deploy sen jälkeen.
- **Agentti: `python scripts/deploy/deploy_agent.py [--dev] [--html]`.** Tuotanto on
  `--html`. Kierroksen esikatselu chatissa = yksi VQR `V_ROUND_PREVIEW_TEXT`:stä
  (valmiit suomenkieliset rivit; 20 nimetöntä saraketta sai mallin poimimaan
  väärän sijan). Skill `snowflake/LIIGA/CODE/stages/AGENT_SKILLS/esikatselu-html/` laukeaa vain sanalla
  **"johtoryhmävisualisointi"** (käyttäjän päätös); väärä laukeaminen ~6 %.
  Skillin tiedostot näkyvät hiekkalaatikossa polussa
  `/mnt/skills/stage/liiga_code_agent_skills/<skill>/`, tulos `/workspace`iin ja
  `present_file`.
- **Työkalun kuvaus päättää kutsutaanko työkalua lainkaan:** aihe jota ei
  mainita (ylivoima, yleisö) sai vastauksen "ei dataa" ilman kutsua.
- Budjetti on katto: 300 s. Tokenraja 20 000 ei katkaise mitään.
- **Agentti on versioitu (10.10. alkaen).** Tuotantovienti tekee uuden
  `VERSION$N`:n (`COMMIT`, kommentissa git-commit), siirtää aliaksen
  `production` ja oletusversion siihen. Skillit luetaan versiokohtaisesta
  kansiosta `@LIIGA.CODE.AGENT_SKILLS/<git-sha>/` -- älä ylikirjoita niitä
  käsin `snow stage copy`llä, se muuttaa tuotannon käytöksen ilman versiota
  (tein niin kerran 10.10.). **Älä käytä `CREATE OR REPLACE AGENT`** tuotannossa:
  se nollaa historian `VERSION$1`:een. `VERSION$1` on aamupäivän tila ennen
  versiointia, `VERSION$2` (010d045) ensimmäinen versioitu.
  Palautus: `ALTER AGENT … SET DEFAULT_VERSION = 'VERSION$N'`.

**Roolit ja CoWork (2026-10-16, `snowflake/_account/roles/`).** Agentit omistaa
`LIIGA_AGENT_OWNER` eikä ACCOUNTADMIN: koodinsuoritus (johtoryhmävisualisointi)
perii omistajaroolin oikeudet, ja ACCOUNTADMINina hiekkalaatikko olisi toiminut
tilin laajimmilla oikeuksilla. Omistajalla on vain skill-stagen luku ja Cortex.
Demon käyttäjärooli on `LIIGA_AGENT_USER` (myönnetty MHEINO:lle): agentti,
`LIIGA.MODEL`in taulut/näkymät/semanttiset mallit ja varastot -- **FUTURE-oikeuksin**,
koska notebook ja deploy luovat ne uudelleen. Testattu `USE SECONDARY ROLES NONE`
-istunnossa: agentti vastaa, `LIIGA.RAW` ei aukea.

CoWork-objekti `SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT` on nyt olemassa, joten
CoWorkissa näkyvät **vain siihen lisätyt agentit**: `LIIGA_ENNUSTAJA` ja
tilin toinen agentti `VW_AGENT` (lisätty, ettei se katoa käyttäjiltään). Uusi
agentti pitää lisätä: `ALTER SNOWFLAKE INTELLIGENCE SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT
ADD AGENT <fqn>`. DEV-agentti ei ole listalla tarkoituksella.

**Miksi kaksi ja miksi näkymät: tokenit.** Cortex Analyst lukee koko
semanttisen mallin joka kutsulla, ja agentti yritti monivaiheisia
ikkunakyselyjä (viimeisin snapshot, viimeisin kokoonpano) uudelleen. Nyt
raskas logiikka on valmiiksi `LIIGA.MODEL.V_*`-näkymissä
(`snowflake/LIIGA/MODEL/views/`), ja kun kysymys osuu vahvistettuun kyselyyn,
agentti **ei lataa semanttista mallia lainkaan** -- se näkyy vastauksen
`thinking`-osassa.

Testaa agenttia SQL:stä, ei selaimesta:
`SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN('<agentti>', $${"messages": [...], "stream": false}$$)`.
`metadata.usage.tokens_consumed` kertoo tokenit.

Viisi asiaa joita vanha malli teki väärin (korjattu uusissa):

- **`SCHEDULE` = `STG_GAMES` pääavaimella `GAME_ID`**, vaikka id ei ole
  yksilöllinen kausien yli (ks. `game_id` EI ole yksilöllinen).
  `V_GAMES_NOW` on vain kuluva kausi, jossa se on.
- **"Kokoonpano" haki `MAX(game_id)`:n** -- se on HIFK–TPS 14.10., jolla on
  jo ennakkokokoonpano (pelaamaton). `V_LATEST_LINEUPS` rajaa pelattuihin.
- **`P_TITLE` kuvattiin mestaruudeksi** ja `PROJ_RANK 1 = champion`. Se on
  runkosarjan voitto; pudotuspelejä malli ei ennusta.
- **Nykyistä sarjatilannetta ei ollut lainkaan**, eikä putoamisvyöhykettä
  (15.–17.), joka on uusi tällä kaudella.
- **Pistepörssi laski `RL0`:t maaleiksi.** `V_PLAYER_SEASON_NOW` ei.

Näkymät omistaa ACCOUNTADMIN, koska se omistaa pohjataulut eikä SYSADMIN
saa luoda näkymiä `LIIGA.MODEL`iin. `PRESEASON_PLAYER_RATES` on `LIIGA.RAW`issa
(`CURATED_TABLES`), koska yllättäjät tarvitsevat jäädytetyn esikauden odotuksen.

## Agentin "haluan tällaisen" -ominaisuudet (2026-10-16)

Kolme ominaisuutta, valittu sen mukaan mikä siirtyy demoyleisön omaan
bisnekseen ("miksi forecast laski?", skenaariosuunnittelu, tieto tulee itse).

**1. Miksi ennuste muuttui** -- näkymä `V_FORECAST_CHANGE` (kausi_views.sql),
taulu `FORECAST_CHANGE` ennustemallissa, kolme VQR:ää. Muutos = **tulokset vs.
odotus** (ikkunassa pelattujen otteluiden pisteet miinus vertailuhetken
ennusteen odotus juuri niistä) + **kokoonpanot** (`ROSTER_IMPACT`, roster_impact.py
kirjoittaa sen nyt myös DuckDB:hen ja synkka Snowflakeen) + **mallin uusi arvio**
(loput). Osat summautuvat rakenteen vuoksi. Ikkunat ESIKAUSI / VIIKKO / EDELLINEN.
Snowflakesta puuttuvat 31.8. ja 1.9. ajot, joten ESIKAUSI on siellä 30.8. --
sama julkaistu ennuste (KooKoo 107,4, Tappara 115,3), ehto on `games_played = 0`.

**2. Mitä jos -simulaattori** -- proseduuri `SIMULATE_SCENARIO_<sha>`, agentin
työkalu `liiga_skenaario` (`tool_spec` type `generic`, `tool_resources` type
`procedure` -- toimii, vaikka dokumentaation esimerkit näyttävät vain
`function`in). Lähde `snowflake/LIIGA/MODEL/procedures/SIMULATE_SCENARIO/simulate_scenario.py`, testi
`tests/test_simulate_scenario.py`. Sama Monte Carlo kuin `src/liiga/simulate.py`
uusimmista `PREDICTION_GAMES`-todennäköisyyksistä; perustaso ja skenaario
**samoilla satunnaisluvuilla**, tulos julkaistun ennusteen päälle (pisteiden ero
× (1 − yleisöpaino)). Ilman lukituksia toistaa julkaistun runkosarjan voiton
todennäköisyyden 0,5 pp:n tarkkuudella. Omistajan oikeuksin: käyttäjä tarvitsee
vain USAGEn proseduuriin.

**2b. Mitä vaaditaan** -- sama työkalu tavoitteella:
`[{"team": "KooKoo", "goal": "avoid_relegation", "rivals": ["Jokerit", "Sport"]}]`
(myös `top6`, `top10`, `win`; `rivals` valinnainen). Luetaan niistä 10 000
kaudesta, joissa tavoite toteutui: todennäköisyys, loppupisteet 50/80/95 %
varmuudella ja niiden vaatima p/ottelu, sijan pisteraja ja kilpakumppanien
loppupisteet onnistuneissa kausissa vs. odotus. Raja-arvo per pistemäärä on
pakotettu monotoniseksi (cummax), ja pistemäärä huomioidaan vain jos sillä on
≥ 40 simulaatiota. Mitattu 16.10.: kilpakumppanit jäävät onnistuneissa kausissa
yleensä vain 1-3 p odotuksestaan -- tavoite riippuu lähinnä joukkueesta itsestään.
Vain Liigan 17 joukkuetta: Mestis-joukkueen nousua ei voi simuloida.

**2c. Loukkaantuminen** -- sama työkalu:
`[{"injury": "Patrik Bartosak", "days": 61, "ramp_games": 3, "ramp_effect": 0.5}]`
(kesto `days` / `until` / `games`, puuttuu = koko loppukausi; agentti muuntaa
minkä tahansa ilmauksen päiviksi). Pelaaja poistetaan mallin omilla kaavoilla:
kenttäpelaaja 18 parhaan maalitahdin summasta (19. nousee tilalle, skaala
pysyy), maalivahti joukkueen painotetusta torjunnasta (`TEAM_GOALIE_WEIGHTS`,
goalies.py kirjoittaa sen nyt, synkattu). Muutos menee vain ensemblen
Poisson-osaan (0,4) -- Elo (0,6) ei tiedä kuka pelaa, joten arvio on varovainen ja
agentti sanoo sen. Tasapelikalibrointia ei lasketa uudelleen. Vastaus listaa
joukkueen ottelut jaksolla (voitto-% ja odotetut pisteet ennen/nyt). Tarkistettu:
pelaajadatasta laskettu `exp_gf_player` = `TEAM_STRENGTH` (ero 4e-16), ja
vakioiden yhtäsuuruus config.yaml:n kanssa on testissä. Mitattu 16.10.: Maxime
Fortier koko kausi -> Jokerit −0,36 maalia/ottelu, putoaminen 41 -> 56 %.

**Paikallisesti sama vastaus:** `.venv/bin/python scripts/tools/skenaario.py '<JSON>'`
ajaa saman `simulate_scenario.py`:n DuckDB:tä vasten.

**2d. Pelipäivän kokoonpanot** -- proseduuri `LINEUP_FORECAST_<sha>('TODAY')`,
agentin työkalu `liiga_kokoonpanot`, lähde `snowflake/LIIGA/MODEL/procedures/LINEUP_FORECAST/lineups.py`
(importtaa simulaattorin kaavat). Hakee annetun päivän ottelut liiga.fi:n
ottelukohtaisesta rajapinnasta (external access `LIIGA_FI_ACCESS`, sama kuin
notebookilla) -- yleisen selaimen sijaan, koska rakenteinen data täsmäytyy
tarkasti. Pukeutunut = `line` asetettu, aloittava maalivahti = rivi 1;
täsmäytys player_id:llä ja SUKUNIMELLÄ (etunimimuodot vaihtelevat). Tulos:
1X2 (varsinainen peliaika) ennen -> kokoonpanokorjattu, maaliodottamat,
reilut kertoimet, maalivahdit, merkittävät poissaolot. Paikallisesti:
`.venv/bin/python scripts/tools/kokoonpanot.py [YYYY-MM-DD]`. 16.10.: Tapparan 1
47,2 -> 43,9 (Blichfeld poissa), sama luku paikallisesti ja Snowflakessa.

**2e. Tietopankki `liiga_tieto` (Cortex Search, 16.10.)** -- `snowflake/LIIGA/MODEL/cortex_search/LIIGA_TIETO/*.md`
(malli, havainnot, rajoitukset, data), KIRJOITETTU agentille. CLAUDE.md:tä ei
anneta agentille: se on kehitysmuistio. Ennen tätä agentti päätteli menetelmän
sarakkeista ("miten malli toimii" sekoitti Elon ja Poisson-osan, "60 ottelua"
vaikka 64) ja arvasi merkitsevyyksiä. `scripts/deploy/deploy_knowledge.py` pilkkoo
tiedostot ##-osioiksi (33) tauluun `AGENT_KNOWLEDGE_<sha>` ja palveluun
`LIIGA_TIETO_<sha>`, upotusmalli monikielinen `snowflake-arctic-embed-l-v2.0`.
Cortex Search ei hyväksy vakiokyselyä lähteeksi ("Dynamic Tables must have at
least one base table"), siksi taulu. `max_results` 6: neljällä agentti haki
kolmesti (132 000 -> 75 600 tokenia). **Kun mallia tai havaintoja muuttuu, päivitä
`snowflake/LIIGA/MODEL/cortex_search/LIIGA_TIETO/` samassa commitissa** -- muuten agentti kertoo vanhaa.

**1X2 ja maaliodottamat näkymässä:** `V_UPCOMING_PREDICTIONS` + VQR `TODAY_1X2`.
Ennen agentti johti 1/2:n itse voittosuhteista (Pelicans 49,4 % mallin 52,3 %:n
sijaan, 172 000 tokenia); nyt VQR-osuma, 49 000 tokenia.

**Vedonlyönti: välimuoto (käyttäjän päätös 16.10.).** Agentti antaa 1X2:n,
reilut kertoimet ja annetuille kertoimille odotusarvon (kerroin x p - 1),
nimeää mallin varmimmat kohteet ja sanoo, että yhdistelmä kertoo vedonvälittäjän
katteen -- mutta ei kehota pelaamaan, ei ehdota panoksia ja kertoo, ettei
mallilla ole näytettyä etua markkinaan.

**3. Aamutiedote** -- proseduuri `SEND_MORNING_BRIEF_<sha>('PRODUCTION')`: kysyy
agentilta "Tee aamutiedote.", agentti tekee kolme kutsua (esikatselu, miksi
muuttui, mitä jos illan tasaisimmassa) ja proseduuri lähettää vastauksen HTML:nä
integraatiolla `LIIGA_EMAIL` (vain `mika.heino@recordlydata.com`). Ensimmäinen
demo lähetettiin 16.10. aliaksella DEV. **Ei vielä ajastettu** (task tekemättä).

Oikeudet: `snowflake/_account/` (ACCOUNTADMIN, ajettu 16.10.). Proseduurit:
`python scripts/deploy/deploy_tools.py [--dev]`, kiinnitys kuten semanttisilla
malleilla. Deploy-putken ehdokasvaihe ajaa sen ennen agenttia.

## Agentin julkaisuputki: oma kone → GitHub → Snowflake (2026-10-16)

Auditoitu Snowflaken oppaan "Best Practices for Building Cortex Agents" mukaan.
Agentti, semanttiset mallit, näkymät ja skill julkaistaan **GitHub Actionsista**,
ei omalta koneelta:

**Yksi agentti, iterointi aliaksilla (2026-10-16)** -- Snowflaken
versiointimalli: jokainen kierros on nimetty versio, alias kertoo mihin se
kuuluu, ja tuotantoon siirretään alias, ei koodia.

| alias | kuka tekee | versio viittaa | käyttö |
|---|---|---|---|
| `DEV` | oma kone | `*_DEV`-mallit, skillit `dev/` (muuttuvia) | `'…LIIGA_ENNUSTAJA!DEV'`, `agent_eval --version DEV` |
| `STAGING` | CI joka mainin muutoksella | `<NIMI>_<sha>`-mallit, skillit `<sha>/` | evaluointi + laatuportti |
| `PRODUCTION` + oletus | CI hyväksynnän jälkeen | sama versio joka evaluoitiin | CoWork, päätteettömät kutsut |

```
oma kone:  semantic_views --deploy --dev → deploy_agent --alias DEV --html
           → agent_eval --version DEV
main ──▶ Deploy agent (.github/workflows/deploy.yml):
    candidate: kausi_views.sql → semantic_views --deploy (kiinnitetyt)
               → deploy_agent --alias STAGING --html (ADD VERSION FROM @stage)
               → agent_eval --version STAGING --gate
    prod (environment "production", vaatii hyväksynnän):
               deploy_agent --promote VERSION$N (PRODUCTION + DEFAULT_VERSION)
               → tagi agent-vN + Release STAGING-evaluoinnin luvuilla
palautus:  deploy_agent --promote VERSION$<vanha>
```

- **Kirjautuminen:** palvelukäyttäjä `LIIGA_CI` (TYPE = SERVICE, avainpari),
  rooli `LIIGA_DEPLOYER` (`snowflake/_account/roles/LIIGA_DEPLOYER.sql`). Yksityinen avain on
  `~/.snowflake/keys/liiga_ci_rsa_key.p8` ja GitHubin salaisuutena
  `SNOWFLAKE_PRIVATE_KEY` -- **älä koskaan tulosta tai kopioi sitä**.
- **Sama rooli paikallisesti:** `scripts/deploy/snow_conn.py`:n oletus on
  `LIIGA_DEPLOYER`. ACCOUNTADMINin `CREATE OR REPLACE` siirtäisi näkymien ja
  DEV-mallien omistajuuden takaisin, ja seuraava CI-ajo kaatuisi.
- **Laatuportti** (`agent_eval.GATE`): oikeellisuus ≥ 0,90, työkalun valinta
  ≥ 0,95, suomi ≥ 0,95, johdonmukaisuus ≥ 0,80, ei virheitä. Kaatunut portti
  pysäyttää julkaisun ennen tuotantoa. Historia: `docs/agent_evals.md`.
- **Testijoukko** (`agent_eval.GOLDEN`, 25 kysymystä): odotetut vastaukset
  lasketaan SQL:llä tuoreesta datasta joka ajossa, koska "kuka johtaa
  pistepörssiä" vaihtuu päivittäin. Lisää kysymys sinne, ei kiinteänä tekstinä.
- **Agentilla ei ole live-versiota -- koskaan.** Mitattu 16.10. (optimointiloki):
  kun live-versio on olemassa, päätteetön `DATA_AGENT_RUN` **ja CoWork**
  käyttävät sitä eivätkä oletusversiota, vastoin dokumentaatiota ja myös
  eksplisiittisellä `DEFAULT_VERSION`illa. Ilman live-versiota päätteetön
  kutsu seuraa `DEFAULT_VERSION`ia. Siksi versiot luodaan stagelta
  (`ADD VERSION FROM`, joka lisäksi kieltäytyy jos live-versio on olemassa),
  ja `_retire_live()` commitoi mahdollisen Snowsight-luonnoksen pois ennen
  jokaista julkaisua. **Älä muokkaa tuotantoagenttia Snowsightin editorissa**:
  tallennus luo live-version, joka näkyy käyttäjille heti.
- **Alias on kirjainkokotarkka ja tallentuu isoilla:** `!DEV`, ei `!dev`.
- **Korvattu ehdokas poistetaan:** kun alias siirtyy, edellinen saman aliaksen
  versio pudotetaan (ellei se ole oletus). Versiohistoria = julkaisut +
  nykyiset ehdokkaat; numeroihin jää aukkoja, ja `agent-vN` = `VERSION$N`.
- **Näkymät eivät ole versioituja.** `kausi_views.sql` ajetaan ehdokasvaiheessa
  ja muuttaa tuotannon käyttämiä `V_*`-näkymiä jo ennen hyväksyntää. Pidä
  muutokset yhteensopivina (lisää sarakkeita, älä poista tai nimeä uudelleen).
- **Älä liitä `${{ }}`-lauseketta `run:`-skriptin sisään** -- välitä se `env:`illä.
  Lauseke korvataan tekstinä ennen bashia: d486dd8:n commit-viestin lainausmerkit
  rikkoivat agenttivaiheen kahdesti (ei yhtään Snowflake-kyselyä, näkyi
  `QUERY_HISTORY_BY_USER`ista), ja sama reikä olisi ajanut viestiin kirjoitetut
  komennot (skripti-injektio). `secrets`, `needs` ja `steps` -arvot `env:`issä ovat ok.
- **Evaluointiajon nimi on UTC + sekunnit** (`20261016_125433`). Minuuttitarkka
  paikallinen aika törmäsi 16.10. CI:n UTC-nimeen (`20261016_1238`), ja CI kaatui
  ACCOUNTADMINin aiemmin luomaan datasettiin. Tunnistettu `liiga_ci`:n omasta
  kyselyhistoriasta (`INFORMATION_SCHEMA.QUERY_HISTORY_BY_USER`) -- GitHubin lokit
  vaativat kirjautumisen, Snowflaken eivät.
- **Evaluoinnin tulokset luetaan vasta kun ne ovat valmiit**
  (`complete_results`): 16.10. tuotantoajo luki ne heti `COMPLETED`-tilan
  jälkeen, kaatui laatuporttiin vajailla pisteillä, ja sama ajo antoi
  myöhemmin 28/28 joka mittarille ja läpäisi portin.
- **Demon ilme (16.10., käyttäjän valinta: Liiga musta + kulta, analyytikon sävy):**
  `PROFILE` (nimi, väri `#CCA752`) asetetaan `promote()`ssa, koska profiili on
  agenttitason eikä versioitu -- ehdokkaassa se muuttuisi käyttäjille putken ohi.
  **Väri ei näy CoWorkissa lainkaan** (testattu 16.10.: `#CCA752`, `yellow`,
  `orange` -- eikä alkuperäinen `teal` ollut koskaan näkynyt); Snowflake tallentaa
  minkä tahansa merkkijonon virheittä. Pidetään `teal`. Avatar-arvoja ei ole
  dokumentoitu. Demon ilme tulee aloituskorteista, raportista ja tiedotteesta. Aloituskortit = yksi per ominaisuus. Johtoryhmäraportti mustalla
  otsikolla ja kullalla (logon sävyt, kuten sovellus ja aamutiedote).
- Erillinen `LIIGA_ENNUSTAJA_DEV`-agentti **poistettiin 16.10.**; sen roolin
  hoitaa alias `DEV`. `*_DEV`-semanttiset mallit jäävät DEV-aliaksen käyttöön.
- **Tagit:** `agent-vN` = Snowflaken `VERSION$N`. Release-muistiinpanoissa
  evaluoinnin tulos. `agent-v2` (010d045) ja `agent-v3` (0a7ce21) on merkitty jälkikäteen.
