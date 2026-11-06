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

**Sivutietoinen ja telakoitu agentti (5.11.2026, käyttäjä: "agentilla olisi ymmärrys siitä
millä sivulla sitä käytetään ... ja agentti ei tulisi niin suoraan applikaation päälle").**
Kaksi muutosta, molemmat **vain sovelluksessa** -- agenttia, sen ohjeita tai versiota ei
koskettu, joten deploy.yml-ajoa ei tarvita:

- **Konteksti:** `Chat.tsx` lähettää kysymyksen mukana `page = { path, query }`
  (luetaan lähetyshetkellä `window.location`ista, joten myös `?nakyma=`, `?kk=` ja
  `?joukkue=` näkyvät). `/api/chat` rajaa arvot (polku alkaa `/`, pituudet) ja
  **`lib/pageContext.ts`** rakentaa niistä suomenkielisen NÄKYMÄ-lohkon: sivun nimi,
  valinnat ja ne luvut jotka sivulla todella näkyvät -- samoista `lib/data.ts`:n
  välimuistista ja samoilla funktioilla kuin sivu, eli ei yhtään lisäkyselyä. Lohko
  liitetään **vain viimeiseen käyttäjäviestiin** (`withPage()` agent.ts:ssä), joten
  vanhentunutta kontekstia ei kerry historiaan eikä selaimen `sessionStorage`iin.
  Sama lohko menee paikalliselle Claudelle (`localClaude.ts`). Mukana `CONTEXT_RULE`:
  tulkitse "tämä joukkue"/"tuo luku" näkymää vasten, älä hae valmiiksi annettuja
  lukuja uudelleen työkalulla, äläkä linkitä sivulle jolla käyttäjä jo on.
  Mitattu 5.11. paikallisesti: "Miksi tämä on muuttunut näin paljon?" ilman joukkueen
  nimeä → oikea joukkue, sivun luvut ja linkki `/liike`en eikä takaisin joukkuesivulle.
  Aloituskysymykset ovat nyt sivukohtaiset kaikilla sivuilla (ennen vain joukkuesivulla),
  ja otsikkorivi näyttää käyttäjälle saman kontekstin ("◎ Tappara").
- **Telakointi:** auki oleva paneeli ei kellu sisällön päällä. Työpöydällä `body` saa
  luokan `chat-open` ja kaventuu `--chat-w` verran (`clamp(300px, 26vw, 380px)`).
  ⚠️ **Sivuttaisvieritys on kielletty** (käyttäjä 5.11.: "joutuu scrollailemaan
  sivuttain -> ei hyvä"): ensimmäinen yritys antoi sarjataulukolle oman
  `overflow-x: auto`:n, mikä oli väärä ratkaisu. Nyt **valinnat-sivupalkki väistyy**
  keskustelun ajaksi (`body.chat-open .rail { display: none }`, takaisin ≥ 1760 px),
  jolloin taulukko mahtuu kokonaan. Mitattu: 1440 px → 1008/1008, 1280 px → 889/889,
  ei yhtään sivuttain vierivää elementtiä. Puhelimessa paneeli
  on alalaatikko (55 dvh, kahvasta 82 dvh), jonka yläpuolella sivu näkyy ja vierii;
  `body` saa laatikon verran alatilaa. Kelluva nappi piiloutuu auki-tilassa kokonaan
  (paneelin oma ✕ sulkee) ja sen hehkuanimaatio poistettiin. `#agentti`-tunniste
  URL:ssa avaa paneelin valmiiksi. ⚠️ `body.chat-open .layout` täytyy olla
  `:not(.no-rail)` -- muuten se antaa sivupalkittomalle sivulle (joukkuesivu, etusivu)
  haamusarakkeen ja sisältö kutistuu.

**Agentti ottelukortissa -- korvaa kelluvan paneelin (5.11.2026 ilta).** Käyttäjä:
"agenttiominaisuus tuntuu päälleliimatulta" -> 11 kierroksen ideointi (ideoija, kriitikko,
tutkija; workflow) -> suositus, jonka käyttäjä hyväksyi demoa varten ("nyt rakennetaan demoa").
**Vapaa keskustelu ilman kelluvaa nappia (6.11., käyttäjä: "olis mukava jos agentin saisi
myös vapaata keskustelua varten halutessaan missä tahansa ruudussa"):** sivutietoinen,
telakoitu paneeli (yllä) on taas kaikilla sivuilla, mutta FAB on poistettu kokonaan (myös
`LIIGA_FAB`-lippu). Paneeli avataan navigaation **"Kysy"**-kohdasta (`AskButton.tsx`:
ylävalikon viimeinen, puhelimen alavalikon viimeinen -- osio muiden joukossa) tai kortin
vastausrivin **"▸ Jatka keskustelua"** -napista, joka tuo kortin kysymyksen ja vastauksen
keskustelun jatkoksi (`lib/chatBus.ts`, selaimen tapahtumat, koska avaajat ja paneeli ovat
eri puissa). Paneeli (z 70) on korttien (z 60) päällä ja työpöydällä kortti siirtyy sen
viereen, joten kortti ja keskustelu näkyvät yhtä aikaa. Escape sulkee ensin kortin, sitten
paneelin. Paneelin ollessa auki yläpalkki tiivistyy (brändin alarivi ja aikaleima piiloon).
⚠️ Yläpalkin `AskButton` kytkeytyy vasta sivun sisällön myötä, joten se lukee alkutilan
`body.chat-open`-luokasta -- pelkkä tapahtuma jäi kuulematta, jos paneeli avautui heti.
⚠️ Headless-kuvassa yläpalkin Kysy näyttää korostumattomalta: virtuaaliaika ei vie
`transition`ia loppuun (vain siirtyvät ominaisuudet jäävät alkuarvoon; mitattu 6.11.).

- **Kohde, ei ikkuna (laajennettu 5.11. myöhään, käyttäjä: "voisiko tämä olla muuallakin"):**
  agentilta kysytään kohteesta, `components/CardAgent.tsx`:
  - **ottelu** -- `MatchCard` avautuu nyt jokaisesta ottelusta: kierroskortti, `/ottelut`-lista,
    joukkuesivun viimeiset/seuraavat ja "Suurimmat hutit". Kortin sisältö yhdestä paikasta
    `lib/matchDetail.ts` (vire ja keskinäiset ottelua EDELTÄVISTÄ otteluista, pelatussa
    lopputulos). Listarivillä "venytetty" nappi taustalla (`.mc-row-tap`), joukkueiden nimet
    (linkit joukkuekorttiin) sen päällä -- ei sisäkkäisiä interaktiivisia elementtejä.
    Kortti renderöidään `document.body`:yn (`createPortal`): rivien `rise`-animaation
    `transform` ja `.swipe { will-change: transform }` tekisivät kiinteälle kortille oman
    kehyksen. Siksi `@types/react-dom` (19.1.11) lisättiin. `#ottelu=<kausi>:<game_id>`
    avaa kortin suoraan (demo, testikuvat).
  - **joukkue** -- joukkuesivun "Ennusteen liike" -kaavion alla; tilannekuva samasta
    `pageContext.ts`:n `team()`-funktiosta kuin sivun konteksti.
  - **pelaaja** ja **koko liiga** (6.11., käyttäjä: "entä jos haluan kysyä yleisiä kysymyksiä
    pelaajista? Snowflake tietää nämä tiedot") -- uusi sivu **`/pelaajat`** (`components/Players.tsx`,
    navigaatioon ylä- ja alapalkkiin): pistepörssi (30 kärki, "näytä kaikki") ja maalivahdit
    (≥ 3 yksin pelattua). Rivi avaa pelaajakortin (`#pelaaja=<player_id>` suoraan), jossa
    agentti avaimella `('player', '<kausi>:<player_id>')`; sivun alalaidassa
    `('season', '<kausi>:liiga')` kysymyksille, joilla ei ole yhtä pelaajaa kohteena.
    Data `loadPlayers()`: Snowflakessa `V_PLAYER_SEASON_NOW`/`V_GOALIE_SEASON_NOW`, DuckDB:ssä
    (paikallinen + Pages) samat kyselyt pohjatauluista -- todennettu 6.11.: 484 + 41 riviä ja
    sama kärki desimaaleja myöten. Pelaajasirut "Nimi: kysymys" (nimiä ei taivuteta): ero
    esikauden odotukseen ≥ 5 p, joukkueen kahden parhaan pistemiehen tai ykkösmaalivahdin
    (≥ 60 % aloituksista) kuukauden poissaolo (simulaattori), maalivahdin torjuntaero ≥ 5.
    Koko liigan osiossa ei sirua (datassa ei ole yksittäistä syytä). Alavalikossa nyt 6 kohtaa
    (Pagesissa 7): `.bnav[data-n]` pienentää tekstiä.
  Avain `(subject_type, subject_key)`: `('game', '2027:2701477')`, `('team', '2027:Tappara')`
  -- uusi kohdetyyppi (pelaaja, kausi) on uusi haara `resolve()`-funktioon
  (`lib/kortti.ts`), ei skeemamuutos. Avain tarkistetaan datasta (olemassa oleva ottelu,
  tämän kauden joukkue).
- **Elinkaari:** `pending -> done | error`; `forecast_ts` = `PREDICTION_META.UPDATED_AT`
  kysymyshetkellä, ja kun ennuste päivittyy, rivi saa lapun **VANHA PERUSTA**. Kesken jäänyt
  rivi (palvelin käynnistyi uudelleen) muuttuu virheeksi 5 min jälkeen.
- **Kortin voi sulkea kesken:** `POST /api/kortti` palauttaa heti, agentti ajetaan
  `after()`issa (`askOnce`, lib/agent.ts) ja edistyminen on muistissa (yksi instanssi,
  app.yml). ⚠️ Todennettava STAGINGissa, että App Runtime ajaa `after()`in loppuun.
- **Välimuisti = avain:** sama kysymys (normalisoitu) samasta ottelusta samalla
  ennusteella palauttaa valmiin rivin eikä kutsu agenttia. Enintään 2 kesken per ottelu.
- **Valmiit kysymykset vain datan syystä** (lasketaan kohteen koodissa, CardAgent vain näyttää):
  ottelu -- "Miksi X on suosikki?" (tasaisessa, |p − 0,5| < 0,06, "Mikä ratkaisee näin
  tasaisen ottelun?"), pelipäivänä kokoonpanot, pelatussa vain jos malli antoi voittajalle
  < 40 %: "Miksi malli meni pieleen?"; joukkue -- ennuste liikkui viikossa ≥ 3 p, top 6
  25–75 %, putoaminen ≥ 15 %, muuten (jos esikaudesta ≥ 5 p) "Miksi ennuste on muuttunut
  esikaudesta?". Ei vastaväitettä pyytämättä (ideoinnin hylätty malli).
- **Jälki samalla korttieleellä:** "▸ Jälki" avaa SwipeBack-kortin: agentti, perusta,
  kesto, työkalut ja Cortex Analystin SQL (`render()` poimii `tool_use`-nimet kuten
  morning_brief.py:99; SQL:n paikkaa tool_resultissa ei ole dokumentoitu, joten se haetaan
  mistä tahansa `sql`-avaimesta -- tarkista STAGINGissa, että se löytyy).
- Mitattu 5.-6.11. paikallisesti: kysymys -> valmis 7,5-10,8 s (ottelu, joukkue, pelattu ottelu, pelaaja, koko liiga),
  sama kysymys eri kirjoitusasulla -> `cached: true`; Pages-käännöksessä agenttia ei ole (0 osumaa HTML:ssä). Virhepolku: rivi tallentui `error`-tilaan ja uusi yritys sallittiin.
- ⚠️ **Kehityspalvelimen muistivälimuisti** (`globalThis.__liigaData`) säilyy kuumassa
  latauksessa: kun rivin muoto muuttuu, vaihda memo-avain (`loadFixtures:v2`), muuten vanhan
  muotoiset rivit jäävät käyttöön kunnes ennusteen aikaleima vaihtuu.
- **Demo:** kysy kortista edellisenä iltana ennen aamun ennusteajoa, niin VANHA PERUSTA
  -rivi on aito. Ideoinnin koko aineisto ja demon runko: istunnon workflow `agentti-ideointi`
  (5.11.); toisiksi parhaat varastossa (agentin allekirjoittama poissaolon kesto, jonka
  kokoonpano ratkaisee; haastaja Snowflakeen Git-objektilla).

**Pagesiin ei agenttia (käyttäjän päätös 5.11.2026).** Puhelimessa luettava versio on
GitHub Pages, jossa Chat ja `/api/chat` on poistettu käännöksestä (27.10.) -- siellä ei
ole palvelinta, joka kutsuisi agenttia. Harkittiin välitystä olemassa olevan
`workers/hyvaksynta`-Workerin kautta (sama GitHub-kirjautuminen, oma Snowflake-
palvelutunnus roolilla `LIIGA_AGENT_USER`, konteksti ilman lukuja); **hylättiin
toistaiseksi**. Älä ehdota uudelleen ilman uutta pyyntöä. Agentti on siis vain
Snowflake-sovelluksessa ja kehityskoneella.

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
- ⚠️ **Google Fonts voi katketa Snowflaken käännöksessä (6.11.):** `next/font/google` hakee fontit
  käännöksen aikana, ja STAGING-käännös kaatui `Module not found: Can't resolve
  '@vercel/turbopack-next/internal/font/google/font'` / `next/font/google queries have exactly one
  entry` (12 virhettä, kaikki `layout.tsx`:n fonteista). Koodi ei ollut muuttunut, ja **uusinta
  (`gh run rerun <id> --failed`) meni läpi**. Lokin saa `snow sql -c liiga_ci -q "SELECT * FROM
  TABLE(USER$LIIGA_CI.PUBLIC.SPCS_APP_BUILDER_JOB_<id>!SPCS_GET_LOGS())"` (uusin rivi ensin). Jos
  toistuu, pysyvä korjaus on `next/font/local` repoon tallennetuilla fonteilla.
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

## GitHub Pages -kopio (27.10.2026)

Käyttäjä: "kolme paikkaa, jokainen erillinen kokonaisuutensa": **Mac** (launchd, dev),
**GitHub Pages** (Actions, ei Macia), **Snowflake** (LIIGA_DAILY). Yhteistä vain koodi gitissä.
`.github/workflows/pages.yml` (päivittäin 05.15 UTC + käsin): `daily_update.py --no-sync`
runnerissa repon `data/liiga.duckdb`:stä eteenpäin -> `scripts/deploy/pages_build.sh` ->
Pages. Main-haaraan ei kirjoiteta. Ennustehistoriaa (`prediction_history`,
`prediction_games`) ei voi laskea jälkikäteen, joten Pagesin oma historia säilyy CSV:nä
haarassa **`pages-data`** (`scripts/deploy/pages_history.py restore|save`); ensimmäinen
ajo alkaa repon tietokannan historiasta. liiga.fi vastaa GitHubin runnereille
(`pages-connectivity.yml`, 27.10.).

Pagesissa ei agenttia (Chat, /api/chat), LinkedIn-osiota eikä Mouho-ilmoittautumista;
Mouho-linkki vie pelin omaan Pagesiin. Lähdekoodissa vain liput (`lib/target.ts`:
`NEXT_PUBLIC_LIIGA_STATIC`, `NEXT_PUBLIC_BASE_PATH`); käännösskripti tekee kopion, josta
reitit poistetaan, `force-dynamic` -> `force-static` ja joukkueille `generateStaticParams`.
⚠️ Älä lisää `generateStaticParams`ia lähteeseen: Snowflake-käännöksessä se teki
joukkuesivusta staattisen (● eikä ƒ), eli ensimmäisen haun data olisi jäänyt voimaan.
URL-valinnoista riippuvat näkymät ovat `components/Views.tsx`:ssä selaimessa
(`useSearchParams` + Suspense, fallback = oletusnäkymä), jotta sama koodi toimii molemmissa.

**Uutishaastaja (27.10.):** `/uutiset` ja kierroskortin haastajarivi lukevat
tauluja, jotka syntyvät vain Pages-käännöksessä (`load_news.py`); muualla
`optional()` palauttaa tyhjän. OK-nappi = selaimen fine-grained token ->
`absence.yml` workflow_dispatch. Testikäännös ilman kehityskannan muutoksia:
`LIIGA_DUCKDB=<kopio> scripts/deploy/pages_build.sh` (duckdb_query.py lukee
muuttujan). Suunnitelma ja tulokset: `docs/uutismalli_suunnitelma.md`.

**Korttiteema puhelimessa (27.10.):** vähemmän mutta selkeämmin, napautus avaa, pyyhkäisy
palaa. `SwipeBack` (Tinder-tyylinen veto oikealle; ei vieritettävistä riveistä, lomakkeista
eikä iOS:n reunaeleestä) osiosivuilla, joukkuesivulla ja ottelukortissa (`onBack`).
Sijaintitaulukko `PositionBoard`: etusivulla vain tietokoneella (`desk-only`), puhelimessa
`/sijainti` molemmilla rajoilla ja pistetahdeilla (`pos-full`). Kierroksen ottelu avaa
`MatchCard`in (ennuste, haastaja, vire, keskinäiset, uutiset). Joukkueen nimi avaa
joukkuekortin kaikissa taulukoissa (`Team` = Link). Testaus kosketuksella: CDP:n
touch-tapahtumat eivät laukaise Reactin käsittelijöitä, käytä `new TouchEvent(...)`.


**Ajastus ei ole lupaus (31.10.2026).** Mitatut viiveet: `pages` aamuajo 6 h 07–6 h 17,
ilta-ajo 3 h 31–3 h 51; `news` klo 14 -ajo jäi 30.10. kokonaan väliin (ensimmäinen ajo
tuli käsin klo 16.47). GitHubin dokumentaatio sanoo suoraan että `schedule` voi myöhästyä
kuormassa, eikä SLA:ta ole. Siksi:

- cronit siirretty pois tasatunneilta ja -varteilta (`17 5`, `9,39 17-20`, `11 9-14`)
- `pages.yml`:lle otteluikkuna 17–20 UTC puolen tunnin välein, `--grace 2` (data.md)
- `news.yml`:n malli — useita laukaisuja + kellonaikavartija — on oikea rakenne;
  yksi cron ei riitä mihinkään aikakriittiseen

**Ennen ottelua annettavat ennusteet (31.10. ilta).** Kaksi niistä on sellaisia, ettei
niitä voi laskea jälkikäteen: Pagesin oma ennustehistoria (`pages.yml`, aamuajo) ja
uutishaastajan otteluennuste (`news.yml` → `recompute.yml`). 31.10. kumpikaan ajastettu
laukaisu ei tullut lainkaan — illan kuuden ottelun haastajarivi puuttui vielä klo 14.42,
kaksi tuntia ennen aloitusta, ja aamun Pages-ajo oli tehty käsin. Siksi:

- `news.yml`: ikkuna `11 9-14` UTC ja vartija klo 11–21 Suomen aikaa (ennen `11 11-14`
  ja klo 14). Kuusi laukaisua kolmen sijaan ja ensimmäinen neljä tuntia aiemmin.
  Aikainen ajo kirjaa rivin perusennusteesta ja myöhempi korvaa sen paremmalla
  (`challenger.py` ennustaa vain alkamattomat ottelut ja korvaa saman päivän rivit)
  — rivin olemassaolo on tärkeämpi kuin sen tarkkuus.
- `pages.yml`: aamulaukaisuja kolme (`17 5`, `43 6`, `27 8`), kaikki ennen sunnuntain
  aikaisinta aloitusta (15.00 = 13 UTC), ja historia tallennetaan **vain jos päivän
  ensimmäinen ottelu ei ole alkanut** (askel "Onko päivän ensimmäinen ottelu jo
  alkanut"). Myöhästynyt aamuajo ei ole vain myöhäinen: `persist()` korvaa päivän
  tilannekuvan eikä alkaneita otteluita ole siinä mukana, joten tallennus pyyhkisi
  juuri sen ennusteen, jota varten historia on olemassa.
- Käsin: `gh workflow run news.yml` (vartija ei koske `workflow_dispatch`iin) laskee
  haastajan ja julkaisee sivun; `gh workflow run pages.yml -f history=true` aamulle.

Julkisen repon vakiorunnerit ovat ilmaisia eivätkä kuluta kiintiötä, joten tiheys ei maksa
mitään. Pagesin 10 käännöstä/tunti **ei koske omaa Actions-workflowia**. Todelliset rajat
ovat `GITHUB_TOKEN` 1 000 API-kutsua/tunti/repo ja liiga.fi:n kuormittaminen.
