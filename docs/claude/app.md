# Next.js-sovellus (App Runtime)

Siirretty CLAUDE.md:stä 23.10.2026 sanasta sanaan (tokenisäästö). Lue kun aihe on työn alla.

## Sovellus: Next.js Snowflake App Runtimessa (16.10.2026, korvaa Streamlitin)

**Hyväksytty tuotantoon 16.10.2026** ("Vie tämä tuotantoon CI/CD putken kautta"). Aiemmin
sovellus oli käyttäjän päätöksellä paikallinen, kunnes hän oli siihen tyytyväinen. Nyt se
julkaistaan **vain putken kautta** kuten agentti: `deploy.yml`:n `app-candidate`
(`snow app deploy --target staging`) -> hyväksyntä -> `--target prod --promote-only` +
`GRANT USAGE ... TO ROLE LIIGA_AGENT_USER`. Älä aja `snow app deploy`ta staging- tai
prod-targetiin omalta koneelta. Prototypointi jatkuu paikallisesti (`npm run dev`, :3010).
DEV-palvelu `LIIGA_ENNUSTE_DEV` on pysäytetty.

**Kaksi erillistä putkea (17.10.):** `deploy.yml` = agentti (näkymät, semanttiset mallit,
proseduurit, tietopankki, agenttiversio + evaluointi), `deploy-app.yml` = sovellus ja peli
(STAGING-käännös -> hyväksyntä -> `--promote-only`). Oma jono kummallakin: yhteisessä jonossa
vanha odottava ajo pysäytti kaiken.

**Paikallinen tila (17.10.):** ilman Snowflakea sovellus lukee `data/liiga.duckdb`:tä
(`scripts/local/duckdb_query.py`, `DATA_MODE` lib/snowflake.ts:ssä; App Runtimessa
sessiotoken -> Snowflake; `LIIGA_DATA` pakottaa). "Kysy agentilta" käyttää paikallisesti
Claude Codea (`claude -p`, ei työkaluja, tilannekuva DuckDB:stä, lib/localClaude.ts), Snowflakessa
agenttia. Jäädytykset: tagit `app-vN`/`mouho-vN`, peli `releases/mouho/*.html`
(`scripts/tools/bundle_mouho.py`), sovelluspaketti `releases/app/` (gitignore). Kysy käyttäjältä
välillä, jäädytetäänkö versio.

**Keskustelu ja peli (16.10.):** jokaisella sivulla on "Kysy agentilta" (`components/Chat.tsx`,
`/api/chat` striimaa NDJSONia). **Striimi (17.10.):** agentin REST `.../agents/LIIGA_ENNUSTAJA:run`
(`stream: true`, SSE) -- App Runtimessa sessiotoken (`OAUTH`), paikallisesti `liiga_ci`-avainparin JWT;
varalla SQL:n `DATA_AGENT_RUN`. Tila näkyy ~2 s:ssa, teksti ~15 s:ssa, valmis ~20-30 s. Vastaus on
osien lista: **kaikki tekstiosat + taulukot** (`response.table`) näytetään -- aiemmin vain viimeinen
tekstiosa, jolloin alku ja taulukko katosivat. Jatkokysymykset = agentin `suggested_queries`
(paikallisesti Clauden JATKO-rivi). Orkestrointimalli on **Sonnet** (käyttäjä 17.10.: halvempi;
`deploy_agent.py`, `LIIGA_AGENT_MODEL` vaihtaa). ⚠️ App Runtimen OAuth-tokenilla REST-striimi on
todennettava STAGINGissa; jos se ei aukea, varapolku vastaa ilman striimiä ja loki sanoo `[agent] striimi`.
`/mouho` = point-and-click-peli Mouho 2026 -turnaukseen (`public/mouho/`, oma moottori
`engine.js`, grafiikka `art.js`, tarina `game.js`; iframessa). Repo on julkinen, joten
pelin koodi on kaikkien luettavissa -- käyttäjä valitsi tämän tietoisesti.

**Agentti linkittää sovellukseen** (käyttäjä 16.10.): `deploy_agent.app_note()` lisää
vastausohjeeseen rivin "Lisää sovelluksessa: <linkki>" syvälinkkeineen (`/joukkue/<nimi>`,
`/sarjataulukko`, ...). Osoite luetaan `SHOW APPLICATION SERVICES`ista julkaisuhetkellä,
koska se ei ole ennustettavissa; ilman palvelua linkkiä ei tule. Seuraus: **ensimmäinen
tuotantoajo julkaisee sovelluksen, mutta agentti saa linkin vasta seuraavassa ajossa**
(sen versio rakennetaan ehdokasvaiheessa ennen kuin tuotantopalvelu on olemassa).
Todennettu DEV-aliaksella: "Miten Kärppien ennuste näyttää?" -> linkki `/joukkue/Kärpät`.
**Tuotannossa 16.10.2026:** https://mwduovc-zueemdq-container-services.snowflakecomputing.app
(ajo 38950653914, `--promote-only` toimi ensimmäisellä kerralla; STAGING iwduovc-…, DEV ewduovc-…).

`snowflake/LIIGA/CODE/application_services/LIIGA_ENNUSTE/` (Next.js 16, TypeScript,
`app.yml`). Käyttäjän päätös: Streamlit warehouse runtime on vanhentuva ja container
runtime jää päälle (ei sleep timeria) -- App Runtime sammuu itse
(`auto_suspend_secs: 300`, `auto_resume: true`). Python-tuki App Runtimessa on vasta
suunnitteilla, siksi TypeScript.

- **Sama data paikallisesti ja Snowflakessa:** `lib/snowflake.ts` käyttää palvelun
  sessiotokenia (`/snowflake/session/token`) tai paikallisesti `liiga_ci`-avainparia
  (`connections.toml`). Ei DuckDB-polkua, ei selainta. `npm run dev` -> :3010.
- **Agentin linkki:** valinnat ovat URL-parametreja: `?joukkue=KooKoo,Jokerit&ikkuna=10&xg=1&kayra=0`.
- **Putki (odottaa lupaa, ks. yllä):** dev (oma kone, oma artifact-repo) -> CI `app-candidate` (`npm ci`,
  `typecheck`, `snow app deploy --target staging`, palvelu käynnissä) -> tuotanto
  hyväksynnällä `--target prod --promote-only` (sama käännös) + `GRANT USAGE` käyttäjäroolille.
  `ci.yml`: `npm audit --audit-level=high`, `typecheck`, `next build`. Paikallinen
  laatuportti ajaa `typecheck`in jos `node_modules` on asennettu.
- **Mitattu 16.10.:** ensimmäinen julkaisu 12 min (järjestelmäpoolin `SYSTEM_COMPUTE_POOL_CPU`
  kylmäkäynnistys ~8,5 min + käännös ~1 min), lämpimänä ~3 min. DEV-osoite
  https://ewduovc-zueemdq-container-services.snowflakecomputing.app (Snowflake-kirjautuminen).
- **Kolme ansaa:** `HOSTNAME` on alustan varaama (094516) -- älä aseta; Next.js
  standalone ei kopioi `.next/static`ia eikä `public`ia (build-skripti tekee sen);
  Next.js 16 kirjoittaa projektiin oman `AGENTS.md`:n (`agentRules: false`).
- **Rakenne (16.10. myöhään, käyttäjän toive):** etusivu `/` = kauden tilanne + heatmap +
  viisi "ovea" elävine nostoineen. Kaikki muu on drilldownia: heatmapin rivi ->
  `/joukkue/<nimi>` (jakauma, ennuste, viimeiset/seuraavat, liike, ◀ ▶ selaus), ovet ->
  `/sarjataulukko`, `/voittaja`, `/ottelut`, `/liike`, `/linkedin`. Data `lib/data.ts`
  (React `cache()`, jokainen sivu hakee vain omansa). Osiot eivät näy oletuksena.
- **Välimuisti (16.10., "jos painan linkkiä, mitään ei tapahdu"):** Snowflake-kysely kesti
  0,3-11 s ja sivu odotti hitainta, 2-11 s per klikkaus. `lib/data.ts` pitää kaiken muistissa
  ennusteen aikaleiman (`PREDICTION_META.updated_at`) mukaan ja tarkistaa aikaleiman enintään
  30 s välein; uusi aikaleima tyhjentää muistin ja esilämmittää kaikki sivut taustalla.
  Mitattu: 0,05-0,7 s. 30 s on aikaleiman tarkistusväli, ei datan TTL (Streamlitin "älä lisää
  TTL:ää" koskee dataa). `app/loading.tsx` näyttää latausruudun heti klikkauksesta.
  Hitaat kyselyt (> 300 ms) lokittuvat `[sql]`-riveinä.
- ⚠️ **Kehityspalvelin voi jäädä tarjoamaan vanhaa käännöstä** tiedoston muokkauksen
  jälkeen (16.10.: luokka puuttui SSR-HTML:stä, vaikka koodi oli oikein). Tarkista
  `curl`illa; korjaus: pysäytä `next dev`, `rm -rf .next/dev`, käynnistä uudelleen.
- **Tila (16.10. ilta):** kaikki Streamlitin osiot siirretty: kauden tilanne, sijaintijakauma,
  sarjataulukko + välilehdet (`?nakyma=koti|maalit|erikois`), runkosarjan voittaja,
  ottelut kuukausittain (`?kk=2026-10`) + "missä malli menee pieleen", ennusteen liike.
  **Minimalismi on käyttäjän linja:** ei ingressejä eikä alaviitteitä, osion nimi korkeintaan
  yhtenä `.label`-rivinä. Taustaliike (valojuova, hengittävä hehku, piirtyvät viivat) on
  pyydetty; hehku jää päälle myös vähennetyllä liikkeellä, koska se ei liikuta mitään.
- **LinkedIn-osasto `/linkedin`:** `scripts/local/export_linkedin.py` renderöi kaikki diat ja
  postaukset (samat build_instagram-funktiot, EI `build()`ia) hakemistoon
  `$TMPDIR/liiga-linkedin/<aikaleima>/`; sovellus käynnistää sen napista ja tarjoaa PDF:t.
  Lukee **paikallista DuckDB:tä** (sivu näyttää sen aikaleiman), toimii vain läppärillä
  ja sanoo sen Snowflakessa ääneen. DuckDB:n lukko: tilakysely ei saa avata kantaa
  renderöinnin aikana (`currentStamp()` käyttää silloin talletettua aikaleimaa).
