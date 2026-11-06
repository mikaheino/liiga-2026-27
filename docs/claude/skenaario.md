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
| J1/V4 | panokset + napautuslukitus | |
| J1/V5 | "kuvaile skenaario omin sanoin" (SubjectType `scenario`) | |
| J1 | demokäsikirjoitus | |
| J2/V6–V10 | poissaolot, kauden kysymykset, uutiset paikalliseen (`data/news.duckdb`), kokoonpanot, vaihe B | |
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

**LIIGA_APP (6.11.).** Sovelluspalvelut (LIIGA_ENNUSTE, _STAGING, _DEV) omistaa LIIGA_DEPLOYER
→ sovelluksen agenttikutsut ajetaan julkaisuroolin oikeuksin. `snowflake/_account/roles/LIIGA_APP.sql`
= kapea rooli (MODEL luku, KORTTI_VASTAUS INSERT/UPDATE, proseduurit, agentti, LIIGA_WH),
annettu LIIGA_DEPLOYERille. Käyttöönotto: rooli ACCOUNTADMINina → omistuksen siirto
DEV-palvelulle ja testi → STAGING → tuotanto (deploy-app.yml siirtää omistuksen julkaisussa).
