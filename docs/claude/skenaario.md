# Skenaariotyökalu ja uutiset kolmeen ympäristöön (suunnitelma 6.11.2026)

Suunnittelija–tutkija–kriitikko-workflow, 5 kierrosta. Periaatteet (käyttäjä):
**mobiili (Pages) agentiton**, **paikallinen = Claude mutta identtinen Snowflaken kanssa**,
**Snowflake = Cortex-agentti**, julkaisu vain CI/CD:llä. Toteutus aina ensin paikallisesti.

Ydin: yksi moottori (`SIMULATE_SCENARIO/simulate_scenario.py`), luvut ankkuroitu julkaistuun
ennusteeseen (`p_pub + p_scn − p_base`); agentti hoitaa vain kielen. Agentti ei koskaan näe
uutistekstiä; uutisista kulkee vain id/enum/luku/päivä-kenttiä.

## Käyttäjän päätökset 6.11.

1. Kolme julkaisua hyväksytty: **J1 demo** (~11,5 pv), **J2 data tuo syitä** (~8,5 pv), **J3 uutisdata Snowflakeen** (~5 pv).
2. **Vaihe B tehdään** (paikallinen VQR-työkalu): paikallinen ja Snowflake identtiset myös `liiga_ennuste`/`liiga_kausi`-työkaluissa.
3. **LIIGA_APP-rooli tehdään** (kapea omistajarooli; kertaluontoinen ACCOUNTADMIN-muutos käyttäjältä) ennen kuin uusia näkymiä liitetään agentin malliin.
4. **J3 tehdään**: rakenteinen uutisdata (ei otsikoita, ei notes-tekstiä, nimet → player_id) Snowflakeen omalla latausroolilla GitHubista.
5. Puuttuva vakiopelaaja saa näkyä poissaolona (voi olla lepuutus; kortti kertoo sen).
6. Kauden kysymykset: Jokerien putoaminen, K-Espoon top 6, Pelicans top 6 / putoamisraja, "HPK putoaa, jos häviää joulun yli".
7. **Ottelua edeltävää kokoonpanohakua ei ajeta Snowflakessa** (ei LINEUP_PREGAME-taskia eikä EAI-hakua).
   Kokoonpanodata kulkee Snowflakeen samaa GitHub-latausreittiä kuin J3:n uutisdata.

## V0-tarkistukset (6.11.)

- **Cortexin tool_result sisältää proseduurin palautusarvon kokonaan**: `content[0].json.result`
  (+ `execution_type: procedure`, `query_id`, `truncated: false`). V5 käyttää tätä ensisijaista
  polkua; SCENARIO_RUNS-varapolkua ei tarvita.
- Agentin versiot: `PRODUCTION` (VERSION$31) ja `DEV`; nimettyä `STAGING`- tai `LIVE`-versiota ei
  ole `DATA_AGENT_RUN`ille. Huom: Snowflaken ennuste oli 6.11. päivältä 2.11. (notebook ajastamaton).
- **Paikallinen MCP**: `claude -p --tools "" --allowedTools mcp__liiga__* --strict-mcp-config
  --mcp-config <cfg>` = vain MCP-työkalut, ei Bashia/Readia (testattu). `--tools ""` ilman
  `--allowedTools`ia estää MCP-kutsun (permission denial). `--disallowedTools`-lista EI riitä:
  jättää muita sisäänrakennettuja työkaluja (Skill, Workflow, ToolSearch…) näkyviin.
- `LIIGA_CI` ei näe taskeja eikä palveluita (`SHOW TASKS/SERVICES` tyhjä): omistajat tarkistaa
  ylläpitäjä ennen SCENARIO_DAILY-taskia.
- `RAW.GAME_LINEUPS`: id-, rooli- ja lippukentät + nimet (FIRST_NAME, LAST_NAME).

## Tiekartta

| vaihe | sisältö | tila |
|---|---|---|
| J1/V0 | tarkistukset | ✅ 6.11. |
| J1/V1 | moottori: k-matriisi, stakes, ankkuroitu requirement, p_top10, game_id, from/until, player_id, tyhjä skenaario json-tilassa, MODE, kanoninen JSON + sha | ✅ paikallisesti 6.11. (Snowflake CI:llä) |
| J1/V2 | skenaariopaneeli identtiseksi (Snowflake CALL, Pages JSON) | ✅ paikallisesti + Pages-käännös 6.11. (Snowflake CI:llä) |
| J1/V3 | paikallinen agentti A: `scripts/local/liiga_mcp.py` | ✅ paikallisesti 6.11. |
| J1/V4 | panokset + napautuslukitus | ✅ paikallisesti 6.11. |
| J1/V5 | "kuvaile skenaario omin sanoin" | ✅ paikallisesti 6.11. |
| J1 | demokäsikirjoitus | ✅ `docs/demo_skenaario.md` + `scripts/dev/demo_numbers.py` |
| J2/V6–V10 | poissaolot, kauden kysymykset, uutiset paikalliseen (`data/news.duckdb`), kokoonpanot, vaihe B | V6 ✅, V7 ✅, V8 ✅ 6.11. |
| J3/V11–V12 | tulkinta yhteen paikkaan (recompute.yml), latausrooli + NEWS_*-taulut | |

Koko suunnitelma (ominaisuudet, turvallisuus, hylätyt ideat): workflow `wf_4fedff4b-b60`.

## Toteutuksen muistiinpanot

**V1 moottori (6.11.).** `simulate_scenario.py`: `simulate()` tallentaa `_k` (kausi × ottelu, int8,
tulos CANON-koodina) → `stakes()` ehdollistaa samoista kausista. Kaikki p:t ankkuroitu
(`_anchor`): myös `requirement.p` (raaka `p_sim`). Uudet syötteet: `game_id` (+ `home_win`…),
`from`/`until` (until mukaan lukien), `injury`/`player_id` tunnisteena, `{"stakes": {...}}`.
Tulos: `scenario_canonical` (kelpaa syötteeksi, `label` sirulle), `scenario_sha`,
`plausibility` (lukittujen tulosten mallitodennäköisyyksien tulo). Tekstitila ennallaan
paitsi "mitä vaaditaan" -p (nyt = 1 − julkaistu putoaminen; esim. KooKoo 10,1 → 9,5 %).
Proseduuri: `SIMULATE_SCENARIO_<sha>(SCENARIO, MODE DEFAULT 'text')`, MODE `text|json|panel`.
Paikallisesti `skenaario.py --json|--panel|--batch [--today]`.

**V2 paneeli (6.11.).** Vastauksen muoto tulee moottorista (`panel()`), ei TypeScriptistä:
paikallinen reitti `--panel`, Snowflake `CALL LIIGA.MODEL.$LIIGA_SCENARIO_PROC(?, 'panel')`
(deploy-app.yml laskee nimen `deploy_tools.suffix()`:lla, fetch-depth 0, kaatuu jos proseduuria
ei ole → aja deploy.yml ensin), Pages `scenario_static.py` → `public/skenaario/<joukkue>.json`
(17 tiedostoa, ~15 s, 724 kt). Pagesissa ei "Kysy agentilta" -nappia. Avoinna: sovelluspalvelun
oikeus CALLiin todennetaan STAGINGissa; Cortex-agentin työkalun toimivuus DEFAULT-parametrin
kanssa todennetaan DEV-agentilla CI:ssä.

**V3 paikallinen agentti (6.11.).** `scripts/local/liiga_mcp.py`: MCP stdio ilman riippuvuuksia,
työkalut `liiga_skenaario` (skenaario.py, tekstitila), `liiga_kokoonpanot` (kokoonpanot.py),
`liiga_tieto` (deploy_knowledge.chunks(), haku 6 merkin sananalkujen osumilla, otsikko ×3).
Nimet, kuvaukset ja syöteskeemat suoraan `deploy_agent.spec(dev=True)`:stä (testi vertaa).
`lib/localClaude.ts`: `--tools "" --strict-mcp-config --mcp-config <json> --allowedTools
mcp__liiga__…`; työkalukutsu → sama tilarivi (`lib/agentTools.ts`) ja `done.tools` Jälkeen.
Todennettu: "KooKoo voittaa 5" → liiga_skenaario, sama luku kuin moottori; tiedosto- ja
komentopyyntö → "ei työkaluja". liiga_ennuste/liiga_kausi tilannekuvasta vaiheeseen B asti.

**LIIGA_APP (6.11.).** Sovelluspalvelut (LIIGA_ENNUSTE, _STAGING, _DEV) omisti LIIGA_DEPLOYER
→ sovelluksen agenttikutsut ajettiin julkaisuroolin oikeuksin. `snowflake/_account/roles/LIIGA_APP.sql`
= kapea rooli (MODEL luku, KORTTI_VASTAUS INSERT/UPDATE, proseduurit, agentti, LIIGA_WH) +
luontioikeudet vain omaan skeemaan `LIIGA.APP`. Omistuksen siirto EI onnistu ("Unsupported
feature 'TRANSFER OWNERSHIP ON APPLICATION SERVICE'"), joten käyttäjän päätös 6.11.: palvelut
luodaan uudelleen skeemaan LIIGA.APP roolilla LIIGA_APP (`snow app deploy --role LIIGA_APP`,
app.yml `schema: APP`). Osoite vaihtuu; vanhat LIIGA.CODE-palvelut poistetaan vasta, kun uusi
tuotanto toimii. Rooli ja LIIGA.APP luotu 6.11. (Snowsight). ✅ Tuotannossa 6.11.: `LIIGA.APP.LIIGA_ENNUSTE` (LIIGA_APP), https://exduovc-zueemdq-container-services.snowflakecomputing.app; todennettu LIIGA_APP-roolilla: MODEL-luku, KORTTI_VASTAUS, moottori (CALL json), agentti (DATA_AGENT_RUN). Vanhat LIIGA.CODE-palvelut odottavat poistoa (käyttäjä).
⚠️ ACCOUNTADMIN `snow sql -c CONTAINER_SERVICES` ei toimi Claude Coden kautta (OAuth-paluu
aikakatkaistaan) -> Snowsight.

**V4 panokset ja lukitus (6.11.).** Ei uutta taulua: sovellus pyytää panokset moottorilta
(`lib/scenarioEngine.ts` → paikallisesti/Pages-käännöksessä `skenaario.py --json`, Snowflakessa
`CALL <proc>(?, 'json')`; `loadStakes()` = `[{"stakes": {"days": 14}}]`, memo per ennuste).
Kierroskortti: rivi "Panos · KalPa pudotuspeleihin 48 % ↔ 61 %" (koti ↔ vieras voittaa), kun
ero ≥ 2 %-yks.; ottelukortti: kolme tulosta + sivulliset. Sovelluksessa (ei Pages) ottelukortin
"Lukitse omaan skenaarioon" → `lib/lockBus.ts` (sessionStorage, vain game_id + tulosenum,
enintään 10) → etusivun `ScenarioBoard` (POST /api/skenaario {scenario}) : sirut, uskottavuus,
liikkuneet joukkueet (putoaa/top 10/top 6/voitto), "Kysy agentilta tästä". 390 px: ei
sivuttaisvieritystä (mitattu iframe-luotaimella).

**V5 kuvaile omin sanoin (6.11.).** Etusivun "Oma skenaario" -laatikossa tekstikenttä (vain
sovellus). `POST /api/skenaario/kuvaile {text}` → `askOnce` ohjeella (tämä päivä, joukkueiden
nimet, muodot, ilmausten tulkinnat: "joulun yli" = 20.12.–6.1.; monitulkintainen → yksi
tarkentava kysymys) → agentin `liiga_skenaario`-kutsun syöte (`Answer.inputs`; Cortex:
`tool_use.input`, paikallinen: stream-jsonin tool_use) → moottori json-tilassa → kanoniset rivit
siruiksi (`lib/lockBus.ts` yleistetty: ottelu / poissaolo / tavoite). Poikkeus suunnitelmaan:
EI KORTTI_VASTAUS-riviä eikä SubjectType `scenario`ia, koska käyttäjän lausetta ei tallenneta
(periaate); vain kanoniset rivit selaimen sessioon. Palvelin hyväksyy vain kanonisia rivejä
(`lib/scenarioItems.ts`). Todennettu paikallisesti: "HPK häviää kaikki ottelunsa joulun yli ja
Jokerit voittaa seuraavat kolme" → 8 sirua, työkalu liiga_skenaario. Agentin työkalukuvaukseen
lisätty from/until. Evaluointi `scripts/dev/scenario_eval.py` (17 tavallista + 7 vihamielistä, rivit eikä sanamuoto, vuototarkistus): **24/24 paikallisesti 6.11.** (Claude, ~10 s/lause). Yli 10 riviä → virhe "rajaa jaksoa" (ei hiljaista katkaisua).

**V8 uutiset paikalliseen (N0 + 7a, 6.11.).** Uutis- ja haastajataulut omaan kantaan
`data/news.duckdb` (gitignore; `scripts/news/newsdb.py`: kirjoitus vaatii
`LIIGA_NEWS_DUCKDB`, mallikanta kielletty). `load_news.py` lukee rosterin mallikannasta
lukutilassa, `challenger_season.py` liittää uutiskannan lukutilassa ja kirjoittaa sinne.
Sovelluksen silta (`duckdb_query.py`) liittää uutiskannan READ_ONLY + search_path, joten
kyselyt ovat ennallaan. Pages: `pages.yml` asettaa `LIIGA_NEWS_DUCKDB: data/news.duckdb`
samassa muutoksessa. Paikallisesti `scripts/news/news_pull.py` (julkinen news-data-haara
välimuistiin, ei tokenia) → samat vaiheet; `daily_update.py` ajaa sen lopuksi (ei CI:ssä).
Välimuisti tyhjenee myös uutiskannan muuttuessa (`lib/data.ts` newsStamp). Tietoturva:
**uutissivun tilannekuva agentille ei enää sisällä otsikoita** (`lib/pageContext.ts`; ennen
Pagesissa ei ollut agenttia, nyt uutiset ovat paikallisessa versiossa). MCP ei avaa
uutiskantaa. Testit: `tests/test_news_db.py` (mallikannassa ei uutistauluja = CI-vartija).
Todennettu: paikallinen /uutiset 80 juttua, haastajan kausiennuste ja poissaolot kuten Pagesissa.

**V6 poissaolot (6.11.).** Moottoriin `missing_regulars()` (vakio = 7/10 edellisestä, puuttuu
viimeisimmästä pelatusta; perustaso samalla säännöllä 10 edellisestä) ja `absence()` (vaikutus
joukkueen elävimpään tavoitteeseen kestoilla 1 vko / 4 vko / loppukausi; `show` vain kun
puuttuvia > perustaso JA loppukauden vaikutus ≥ 1 %-yks.). Data: kokoonpanot mallikannasta
(paikallisesti `game_lineups`, Snowflakessa `RAW.GAME_LINEUPS`) → toimii kaikissa kolmessa
ilman uutisia. MODE `absence` / `skenaario.py --absence`. Joukkuesivun `AbsenceCard` + agentin
siru "Mitä poissaolot tarkoittavat?" (vain kun kortti näkyy). 6.11.: kortti Lukko (3 puuttuu,
perustaso 1,7; voitto 58 → 51 % loppukausi), Tappara, HPK; ei KooKoo, Jokerit. Hyväksytyt
uutispoissaolot (news_absences) yhdistetään korttiin J3:n jälkeen (Snowflakessa ei vielä uutisdataa).

**V7 kauden kysymykset (6.11.).** Lista `LIIGA_ENNUSTE/lib/seasonQuestions.json` (muutos vain
PR:llä): Jokerien putoaminen, K-Espoon ja Pelicansin top 6 sekä lukituskysymys "HPK putoaa, jos
häviää joulun yli" (20.12.–6.1., viisi ottelua). Etusivun `SeasonQuestions` (myös Pages): luku,
viikon muutos, kausikäyrä ja Uutiskorjattu-katkoviiva (haastajan `challenger_history`, ei top 10:lle
eikä lukituskysymykselle). Tavallisen kysymyksen käyrä summataan sijajakaumahistoriasta
(ei omaa laskentaa; tarkistettu: K-Espoo 17,5 → 45,5 % 30.10.–6.11. = +28 kortissa). Lukituskysymys:
tämä päivä moottorilta (`requirements[0].p`, ankkuroitu; 6.11. HPK 55 %, ilman ehtoa 32 %),
aiemmat päivät taulusta `scenario_history` (`scripts/tools/season_questions.py record`, jota
`daily_update.py` kutsuu Macilla ja Pagesissa; Pages tallentaa sen pages-dataan vain aamuajossa,
`pages_history.py`). Takautuva täyttö kerran git-historian mallitiloista (`backfill`, 16 päivää;
käyrä seuraa ehdotonta putoamisuhkaa ~20 %-yks. ylempänä). Lukituksen tila pelatuista otteluista:
open / held (kaikki hävitty → ehdoton luku) / failed (piste jaksolla → "ehto ei toteutunut").
Kuollut raja: alle 3 % tai yli 97 % seitsemän päivää → kortti himmenee. Joukkuesivun siru
"Miksi <kysymys> nousi/laski viikossa?", kun muutos ≥ 5 %-yks. Paikallisesti `news_pull.py` hakee
myös pages-data-haaran (challenger_history). **Snowflake:** käyrät sijajakaumahistoriasta ja
lukituskysymyksen tämä päivä proseduurilta; lukituskysymyksen historia ja Uutiskorjattu-käyrä
tulevat J3:n latausreittiä (`sync_all` ei sovi: selainkirjautuminen ja Macin ennuste).

## Etusivun hakukenttä: tekoäly rakentaa skenaarion livenä (7.11.2026)

Käyttäjä: "Enemmän google liittymä, haluan että AI rakentaa livenä skenaarion, mutta hyödyntää
SQL dataa ja koneoppimismalleja. Tiputa valmiit skenaariot pois."
- `components/ScenarioBoard.tsx`: "Entä jos?" -sanamerkki, pyöreä hakukenttä ja yksi nappi
  (Rakenna skenaario). Esimerkkinappi ja etusivun Kauden kysymykset (valmiit skenaariot) poistettu
  (`SeasonQuestions` elää yhä joukkuesivulla).
- `app/api/skenaario/rakenna` striimaa NDJSONina vaiheet (`step`), yhteenvedon (`text`),
  agentin SQL-lauseet (`sql`, vain Snowflake) ja lopuksi kanoniset rivit (`done`). Selain lukitsee
  rivit siruiksi, ja `/api/skenaario` laskee vaikutukset moottorilla (10 000 kautta).
- Logiikka on `lib/scenarioDescribe.ts`:ssä (sama kuin `/api/skenaario/kuvaile`). Ohje kehottaa
  hakemaan datan (liiga_kausi/liiga_ennuste = SQL) ennen skenaariota eikä arvaamaan.
- Mitattu paikallisesti 7.11.: "KooKoo voittaa seuraavat viisi ottelua" valmis ~14 s:ssa, ja
  "HPK häviää kolme seuraavaa" palautti kolme oikeaa ottelua (13.11., 14.11., 18.11.).

## Skenaariohaut tallentuvat (7.11.2026)

Käyttäjä: "Haluan että skenaariot tallentuvat ja niiden vastaukset."
- `app/api/skenaario/rakenna` laskee nyt myös vaikutukset (moottori, json-tila) ja tallentaa
  haun kerran valmistuttuaan: kysymys, tarkennusvastaus, tekoälyn teksti, kanoniset rivit,
  moottorin luvut tiivistettynä (`summarize()`: vain ≥1 %-yks. liikkuneet joukkueet), työkalut,
  SQL, `forecast_ts`, kesto ja tila (`done | clarify | error`).
- Tallennus `lib/skenaarioHaut.ts`: Snowflakessa `LIIGA.MODEL.SKENAARIO_HAKU`
  (`snowflake/LIIGA/MODEL/tables/SKENAARIO_HAKU.sql`, deploy-app.yml luo; `LIIGA_APP` saa
  INSERTin, ks. `_account/roles/LIIGA_APP.sql` -- ylläpitäjä ajaa GRANTin taulun luonnin jälkeen),
  paikallisesti `~/.cache/liiga-ennuste/skenaariot.json`.
- `GET /api/skenaario/haut` = 20 uusinta; hakukentän alla "Aiemmat skenaariot". Avaus palauttaa
  tekstin ja sirut; luvut tallennetuista, jos ennuste on sama, muuten moottori laskee uudelleen ja
  paneeli sanoo "Vanha perusta".
- Selain ei enää laske vaikutuksia uudestaan haun jälkeen (luvut tulevat haun mukana, `preset`).
- ⚠️ Snowflake-polku (INSERT ... SELECT PARSE_JSON) ajetaan ensimmäisen kerran julkaisun jälkeen.

## Skenaario skenaarion päälle (7.11.2026)

Käyttäjä: "skenaario skenaarion päälle tarvitaan" ja heti perään "Ei mitään nappeja, vaan
tietoisuus". Ei lisää/uusi-nappeja eikä edes Rakenna-nappia: Enter tai suurennuslasi lähettää.
Selain lähettää nykyisen skenaarion aina `base`-kenttänä ([{item, label}], palvelin tarkistaa
`validItem`illä, ≤ 64), ja `BASE_RULE` käskee agentin päättämään itse: JATKA (viittaus nykyiseen tai
luonteva täydennys -> nykyiset rivit sellaisinaan + uudet) tai ALOITA UUSI (itsenäinen kysymys), ja
sanomaan valintansa yhteenvedon alussa. Agentin palauttama skenaario korvaa sirut; tarkennus käyttää
samaa pohjaa. Testattu samalla pohjalla (3 Tapparan voittoa): "Bartosak loukkaantuu myös 10 ottelua"
-> jatkoi (4 riviä), "Mitä jos Kärpät voittaa loppukauden kaikki kotiottelunsa?" -> uusi (21 riviä).

## Agentti valitsee kuvaajan (7.11.2026)

Käyttäjä: "agentti vois piirtää myös automaattisesti odotetua pelimallia" -> "Agentti valitsee itse".
- Moottori (`simulate_scenario.py charts()`, json-tila, vain kun skenaariossa on lukituksia tai
  poissaoloja): kohdejoukkueet = suurin odotettujen pisteiden muutos (≤ 3); `dist` = sijajakauma nyt
  vs. skenaario (samat simuloidut kaudet), `points` = odotettu pistekertymä ottelu kerrallaan,
  ankkuroitu kuten `_team_rows` (loppupiste = taulukon luku; testi `test_charts_match_table…`).
  `locked_games` (mallin p) oli jo ennestään. Tekstitila (agentin työkalu) ei muutu.
- Agentti kirjoittaa viimeiseksi riviksi `KUVAAJA: pisteet|jakauma|ottelut|ei <joukkue>`;
  `splitChart()` poistaa sen tekstistä (myös striimistä). Ilman riviä `fallbackPick()`.
- `components/ScenarioChart.tsx` piirtää SVG:nä: nyt = harmaa katkoviiva / haalea pylväs, skenaario =
  kulta #ebca68 (dataviz-validaattori: CVD ΔE 23,5, kontrasti OK; harmaa tarkoituksella väritön,
  sarja kerrotaan myös viivatyylillä, selitteellä ja suorilla arvoilla). Hover = title-vihjeet.
- Tallennettu haku säilyttää kuvaajadatan ja valinnan (`result.charts`, `result.chart`).
- Testattu: "Pelsut häviää joka toisen pelin loppukauden" -> pisteet, "Pääseekö HPK top 6:een jos se
  voittaa kolme seuraavaa?" -> jakauma, "Mitä jos Ilves voittaa Pelicansin 11.11.?" -> ottelut.
- ⚠️ Snowflakessa kuvaajat näkyvät vasta, kun deploy.yml on julkaissut uuden proseduuriversion.

Samana iltana etusivulta poistettiin myös Päivän tarina (käyttäjä: "tarpeeton"); etusivulla on nyt
vain "Entä jos?" ja puhelimessa osiolinkit.

## Oikeat kysymykset ja "idioottivarmuus" (7.11.2026)

Käyttäjä: "Kärpät vaihtavat valmentajaa" -> agentti kysyi tarkennusta; "mieti näihin oikeisiin
kysymyksiin vastata" ja "Haluan siis että tätä voi käyttää idiottikin".
- **Joukkueen muutos** moottorissa (`apply_strength`): `{"team", "xg_share": d, "from"?, "until"?,
  "games"?}`, |d| ≤ 0,15. Osuus s0 = off/(off+def) mallin vahvuuksista, s0 + d jaetaan hyökkäykseen ja
  puolustukseen maalimäärä säilyttäen; paino 1 (koko ennuste), toisin kuin pelaajan poissaolo (0,4).
  Kanoninen rivi + label, `validItem` hyväksyy, `itemKey` = `s:<joukkue>`. Testi lisätty.
- **Valmentajanvaihtojen näyttö** (`coachingEvidence()`): kun kuvaus mainitsee valmentajan, agentti saa
  tämän kauden vaihdot ja p/ott + xG-osuus ennen/jälkeen datasta (COACHING_CHANGES + STG_GAMES) sekä
  keskiarvon ylärajana (regressio keskiarvoon). 7.11.: keskiarvo +6,3 %-yks. neljässä vaihdossa.
- **Ei tarkennuksia, kun oletus on järkevä**: kesto puuttuu -> loukkaantuminen 10 ottelua, muu muutos
  loppukausi; alku puuttuu -> heti; "voittaa/häviää" ilman määrää -> 5 ottelua; pelkkä kysymys
  ("pääseekö X jatkoon?") -> tavoite (goal) nykyennusteella. Oletus sanotaan yhdellä lauseella.
- Moottorin tekstituloste (agentille) sisältää nyt jatkoon (1.–10.) -sarakkeen ja joukkueen muutoksen.
- Testattu: "Kärpät vaihtavat valmentajaa" -> +5 %-yks., jatkoon 75,0 % -> 98,8 %; "Bartosak
  loukkaantuu" -> 10 ottelua; "Pääseekö Jokerit jatkoon?" -> 7,0 %. Ei yhtään tarkennuskysymystä.
- ⚠️ Snowflaken agentin työkalukuvaus (deploy_agent.spec) ei vielä mainitse xg_sharea; sovelluksen
  ohje kertoo sen agentille. Proseduuri julkaistaan deploy.yml:llä.

## Uutiset skenaariossa (7.11.2026)

Käyttäjä: "Miten pagesissa olevassa uutisominaisuus otetaan skenaarioon mukaan luontevasti" -> "aloita".
`lib/newsContext.ts`, vain rakenteiset kentät (ei otsikoita eikä tekstiä agentille):
- **Lähtötilanne:** voimassa olevat hyväksytyt poissaolot (`news_absences`, sama sääntö kuin
  `absences.py active()`: pelaajan viimeisin out/back, dismiss peruu) niille joukkueille, joita haku
  tai auki oleva skenaario koskee. Agentti ottaa ne liiga_skenaario-kutsuun (`{"injury", "until"}`),
  ellei käyttäjä pyydä pois ("ilman Wernblomia"). Vastauksen alla "Mukana uutisista: …"
  (`Described.news`, tallentuu `result.news`).
- **Vihjeet:** hyväksymättömät loukkaantumis-/pelikieltouutiset (`news_candidates` + `flags`, 21 pv,
  ei kirjausta) kysytyille joukkueille; agentti mainitsee ne, ei laske.
- Hyväksyntä pysyy uutissivulla kirjautumisen takana (vaikuttaisi kaikkien ennusteeseen).
- Snowflakessa uutistauluja ei vielä ole (J3): kyselyt kaatuvat hiljaa ja listat ovat tyhjiä.
- Testattu 7.11.: "Pääseekö TPS jatkoon?" -> Wernblom mukana, 54,2 % (ilman 55,5 %); "Lukko häviää
  kolme seuraavaa" -> Hämäläinen ja Virtanen mukana; HIFK ei vihjeitä (viimeisin 10.10. > 21 pv).

## Hakuehdotukset ja keskitetty haku (7.11.2026)

Käyttäjä: "uutiset näkyisivät googlemaiseen tyyliin ehdotuksia", "Entä jos? poista tämä",
"tiputa keskelle haku ja isommaksi".
- `GET /api/skenaario/ehdotukset` (`lib/newsSuggestions.ts`): valmiit kysymykset pohjasta rakenteisista
  kentistä (ei kielimallia, ei otsikoita): hyväksytyt poissaolot joukkueittain, sekä 21 pv:n
  pelikielto-/loukkaantumis-/paluu-/siirtouutiset, joissa pelaaja tunnistettu ja joista ei ole kirjausta.
  Kysymys on joukkueelle auki oleva (`openQuestion()`: putoamisuhka ≥ 15 % -> välttyykö putoamiselta,
  top 6 ≥ 85 % -> runkosarjan voitto, jatkoon ≥ 90 % -> kärkikuusikko, muuten jatkoon).
- Pudotusvalikko kentän alla: 🕘 kolme viimeisintä omaa hakua (avaa tallennetun) + 📰 uutisehdotukset,
  suodattuu kirjoittaessa, nuolet/Enter/Esc. Valinta ajaa haun heti.
- "Entä jos?" -sanamerkki poistettu; kenttä 64 px (puhelin 56 px), pystysuunnassa keskellä, kunnes
  tuloksia on.
- Huom. kehityspalvelin: `cat >>` -lisäys olemassa olevaan moduuliin jäi Turbopackin välimuistiin
  ("is not a function"); uusi tiedosto (`newsSuggestions.ts`) ratkaisi.
- Laajennus 7.11. ("uutisia enemmän"): ikkuna 30 pv, enintään 12; pelaaja myös otsikosta/tiivistelmästä
  `news_roster`ia vasten (siirroissa vain otsikosta); siirroksi kelpaa vain sopimukseen viittaava otsikko
  (`SIGNING`, myös "Hyökkääjä X Kouvolaan" ja "debyytti"), jatkosopimukset pois; loukkaantuminen =
  "loukkaantunut" (agentti käyttää kestolle oletusta). Valikossa 2 omaa hakua + uutiset, yhteensä 10.
  7.11.: 12 ehdotusta (2 poissaoloa, 8 hankintaa, 2 loukkaantumista).

## Jatkoaika ja pisteet, ruutuun mahtuminen (7.11.2026)

- Moottori: uudet tulokset `ot` (menee jatkoajalle, kumpi tahansa voittaa), `point` (vähintään
  piste), `regulation` (ratkeaa varsinaisella ajalla); ottelukohtaisesti `overtime`, `regulation`,
  `home_point`, `away_point`. Labelit "menee jatkoajalle" / "X saa vähintään pisteen". Testi lisätty.
  Testattu: "Sport–HPK 14.11. menee jatkoajalle", "KooKoo saa pisteen jokaisesta viidestä seuraavasta".
- Etusivu: kenttä ~kolmanneksen korkeudella, ehdotuslista enintään 52 vh (vierii sisällään), pitkä
  lähdetieto lyhennetään.

## Evaluointi, lukittu jakso näkyviin, hellävarainen sävy (7.11.2026)

- `scripts/dev/search_eval.py`: 23 tapausta + 5 vihamielistä live-reittiä vasten (~6 min).
  Mitat: vastasi, ei_tark, johtop (1. lause pääjoukkueesta + %), luvut (1. lauseen prosentit
  löytyvät moottorin tuloksesta ±0,15), rivit (lukitukset, jatkoaika/piste, poissaolo, xg_share,
  tavoite, uutispoissaolo, pohjan säilyminen/pudotus), kuvaaja. Ensimmäinen ajo 27/28: jatkohaun
  vastaus alkoi "Aloitin uuden skenaarion" -> ohje: valinta toiseen lauseeseen; uusinta 2/2.
  Tulos kaikissa: luvut 21/21 (agentti ei keksi prosentteja), vihamieliset 5/5.
- Pistekäyrä: yhtenäinen lukittu jakso kultaisena taustana ("lukittu"), nykykäyrä piirretään päälle
  (näkyy, että käyrät kulkevat yhdessä ennen jaksoa), selkokielinen selitys päivineen kuvaajan alla.
- Sävy (käyttäjä: "hellävarainen skenaarioemulaattori"): lempeä ja selkokielinen, ammattisanat
  selitetään, epävarmuus rauhallisesti; vastaus kertoo, mitä malli teki muille otteluille.

## Aliagentit, faktantarkistus ja muuttunut tallennettu haku (7.11.2026)

Käyttäjä: "agentti voisi käynnistää subagenttia. kaikki totuus kuitenkin datassa" ja "entä jos
tallennettu skenaario on muuttunut". `lib/subagents.ts`:
- **Faktantarkistus (koodi):** vastauksen jokainen prosentti löytyy moottorin tuloksesta (joukkueiden
  p_*, vaatimukset, ottelut, uskottavuus, joukkueen muutoksen xG-osuudet, varmuustasot 50/80/90/95).
  Muuten kirjoittaja-aliagentti saa moottorin taulukon ja kirjoittaa tekstin uudelleen (kerran).
- **Tutkija-aliagentti** vastauksen jälkeen (ei hidasta päävastausta): kolme lähiskenaariota pelkkinä
  rakenteina, moottori laskee rinnakkain. Rivi tehdään moottorin kanonisista riveistä ("Pelicans
  häviää × 5 · Pelicans: jatkoon 37,2 → 17,4 %"), koska aliagentin kysymys ja skenaario voivat erota
  (7.11. "vain 2 ottelua" laski viisi). Käyttäjän oman skenaarion kopiot karsitaan. UI: "Myös kannattaa
  katsoa", napautus ajaa haun.
- **Muuttunut tallennettu haku:** jos ennuste on päivittynyt, haku ajetaan avattaessa uudelleen
  ("Päivitetty tämän päivän ennusteella (alkuperäinen haku …)"). `/api/skenaario` pudottaa jo pelatut
  ottelut (`dropped`) eikä kaadu (myös sirun poisto).

## Kaikki toimii myös Snowflakessa (7.11.2026)

Käyttäjä: "KAIKKI PITÄÄ TOIMIA SNOWFLAKE". Tämän päivän haun osat, jotka eivät toimineet siellä:
- **Uutiset** (ehdotukset, lähtötilanne, vihjeet, uuden pelaajan joukkue) lukivat raakatauluja
  (otsikot), joita Snowflakessa ei ole eikä tule. Nyt `scripts/news/news_signals.py` (news_pull.py:n
  viimeinen vaihe) johtaa `news_signals` (published, source, team, kind, player) ja `news_absence_log`
  (URL tiivisteenä) -taulut uutiskantaan; `liiga.snowflake_sync._sync_news` julkaisee ne
  `LIIGA.MODEL.NEWS_SIGNALS` / `NEWS_ABSENCE_LOG`. Sovellus lukee vain näitä (`NT()` valitsee nimen).
  Huom. tämä on Macin synkka eikä J3:n suunnittelema GitHub-latausrooli; ei otsikoita kummassakaan.
- **Valmentajanäyttö**: `COACHING_CHANGES` on RAW-skeemassa -> näkymä `LIIGA.MODEL.V_COACHING_CHANGES`
  (deploy.yml / deploy_views.py).
- **Rosteritarkistus**: `ROSTER_2026_27` on RAW-skeemassa -> sovellus vertaa `PLAYER_RATES`iin.
- **Rosterijono**: Snowflakessa `LIIGA.MODEL.ROSTER_REQUESTS` (deploy-app.yml, LIIGA_APP INSERT);
  `roster_queue.py` lukee ja kuittaa myös sen.
- Ylläpitäjän GRANTit julkaisun jälkeen: `_account/roles/LIIGA_APP.sql` (SKENAARIO_HAKU, ROSTER_REQUESTS).
- Todennettu liiga_ci-yhteydellä: NEWS_SIGNALS 26 / NEWS_ABSENCE_LOG 8 riviä, vihjekysely ja
  PLAYER_RATES (Kumpulainen mukana) toimivat Snowflakessa.

## Mallin säätö ja hyperversiointi (7.11.2026, vaihe 1)

Käyttäjä: "Simulaatiomoottori laskee jatkossa vielä edemmän eli voi malliakin säätää ... irrallinen
leijuva iteraatio ... hyperversioitu, kaikki on mahdollista"; osana hakukokemusta ("ei erillistä sivua"),
"kaikki" säädöt, "jatkopolku, kaikki muokkaus Google-chatissa", "sano suoraan että A/B-testaus ei onnistu".
- Moottori: rivi `{"model": {poisson_weight, home_ice, league_avg, ot_scale, ot_lean, strength}}`.
  Julkaistu = w0·Poisson + (1−w0)·Elo -> Elo puretaan, uusi = w·Poisson' + (1−w)·Elo (Poisson' uusilla
  kotiedulla, maalitasolla, vahvuuksilla), jatkoajat skaalataan. Oletusarvoilla tasan 0 muutosta (7.11.
  oikealla datalla; testissä ≤ 0,001). Virallinen ennuste ei muutu. Testi lisätty (19/19).
- Agentti tuntee säädöt ja sanoo mallia säädettäessä suoraan, ettei malliversiota voi A/B-testata
  etukäteen. Säätöpaneelissa Malli-osio liukusäätimin, kun mallirivi on mukana.
- Jatkopolku: hakukentän uusi kysymys auki olevan vastauksen jälkeen saa edellisen kysymyksen ja
  vastauksen (prompt) sekä pohjan; `parent` kulkee reitille.
- Hyperversio: `version = sha256(kanoniset rivit ilman labeleita + forecast_ts)[:12]`, `parent_id`
  (SKENAARIO_HAKU: ALTER ADD COLUMN IF NOT EXISTS). Paneelissa "versio … · jatkoa edelliselle".
- Testattu: "Pääseekö Tappara kärkikuusikkoon?" -> jatko "Entä jos malli painottaa pelaajia 80 %" ->
  top 6 65,2 -> 80,4 %, A/B-lause, versio 7420b5f9d317 <- 536029bbdd45. Eval-osajoukko 3/3.
- **Vaihe 2 (ei vielä):** syvät säädöt (Elon k, ikäkäyrä, liigakertoimet, maalivahtien paino,
  yleisöpaino) vaativat ennusteputken ajon per versio -> taustatyö.

## Säännöt koodina (7.11.2026)

`lib/scenarioRules.ts`: oletuskestot (`normalize`), uutispoissaolot (`withNews`), johtopäätöslause
(`verdict`, pääjoukkue = eniten mainittu skenaarion riveissä), kuvaajan valinta (`pickChart`) ja
A/B-huomautus (`abNotice`). Agentin ohjeesta poistettu vastaava teksti; agentille jää kieli.
Tavoite: nämä siirtyvät myöhemmin Snowflake-agentille (LIIGA_ENNUSTAJA) työkaluiksi, jotta
paikallinen ja Snowflake toimivat samoin myös ilman sovelluskerrosta.

## Uutiset Snowflakeen ja agentille (7.11.2026, LINJAMUUTOS)

Käyttäjä 7.11.: uutisotsikot ja ingressit saavat olla Snowflakessa, ja agentti saa nähdä ne
("saa nähdä ja päivittyä samalla kun haetaan uudet data liiga pistää"). Aiempi linja (J3: vain
rakenteiset signaalit, ei otsikoita agentille) päättyi.
- Keräimen ydin `src/liiga/news_collect.py` (scripts/news/collect.py on kääre GitHubille).
- `refresh_results()` -> `news_ingest.ingest_news()` vain Snowflaken sisällä: LIIGA_DAILY lisää uudet
  jutut tauluun `LIIGA.RAW.NEWS_ITEMS`; virhe ei kaada ajoa (palautuu `got["news"]`).
- Näkymä `LIIGA.MODEL.V_NEWS_ITEMS` (sovellus, agentti). Paikallisesti news.duckdb:n news_items.
- Haku: `lib/newsContext.ts headlines()` -> kysymyksen joukkueiden 14 pv:n 8 tuoreinta otsikkoa
  agentin kontekstiin (taustaksi; skenaarioon vain pyynnöstä).
- ACCOUNTADMIN (Snowsight): LIIGA_NEWS_RULE.sql -> RAW/tables/NEWS_ITEMS.sql -> LIIGA_NEWS_ACCESS.sql
  (integraatio + `ALTER NOTEBOOK ... EXTERNAL_ACCESS_INTEGRATIONS`).
