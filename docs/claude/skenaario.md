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
| J1/V3 | paikallinen agentti A: `scripts/local/liiga_mcp.py` | |
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
