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
