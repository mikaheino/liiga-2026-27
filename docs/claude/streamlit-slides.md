# Streamlit, diat, LinkedIn-postaukset, sarjan vyöhykkeet

Siirretty CLAUDE.md:stä 23.10.2026 sanasta sanaan (tokenisäästö). Lue kun aihe on työn alla.

## Streamlit app (local + Snowflake, since 2026-08-30)

`streamlit_app/streamlit_app.py` shows the two most-asked-for views from the
site — the position-distribution heatmap and the forecast-history chart —
plus a month-by-month fixture list (from `prediction_games`) showing win
probabilities and, once a game is played, the score and the probability the
model had given the eventual winner. A prominent "last updated" stamp comes
from `prediction_meta.updated_at`.

**One file, two backends.** It detects a Snowpark session: inside Snowflake it
reads `LIIGA.MODEL`, locally it reads `data/liiga.duckdb`. It deliberately does
NOT import the `liiga` package — Streamlit in Snowflake only receives this file
plus `environment.yml`, so it has to be self-contained. Verified both paths give
identical numbers (Tappara 43%, JYP σ 3.8).

```bash
streamlit run streamlit_app/streamlit_app.py          # local
cd streamlit_app && snow streamlit deploy --replace \
  -c CONTAINER_SERVICES --role ACCOUNTADMIN --warehouse LIIGA_WH \
  --database LIIGA --schema CODE                      # Snowflake
```

Freshness is automatic and needs no scheduler: `load_updated_at()` is
uncached and its value is the `@st.cache_data` key for everything else, so a
new prediction invalidates the cache exactly when the data changes. In
Snowflake that happens as soon as the local run's `sync_all()` lands the
tables. **Don't add a TTL** — it would either lag a fresh prediction or
re-query pointlessly.

This is a Snowflake-account app, not a public one; the never-publish rule
above is about the claude.ai artifact and still stands.

## Sarjan vyöhykkeet — putoaminen on uutta 2026-27

Kolme vyöhykettä, ja kolmas on tälle kaudelle uusi: **1.–6.** suoraan
puolivälieriin, **7.–10.** karsintaan, **15.–17. putoaa B-sarjaan**.

Rajat lasketaan joukkuemäärästä eikä kirjoiteta lukuina — putoajien määrä on
se sääntö, ei sija 14:
- `streamlit_app/streamlit_app.py`: `PLAYOFF_CUT` / `QUALI_CUT` /
  `RELEGATION` → `RELEGATION_CUT`
- `scripts/local/build_site.py`: samat, ja JS saa ne `__PLAYOFF_CUT__`-tyylisinä
  paikanpitäjinä `render()`:ssä — älä kovakoodaa niitä takaisin skriptiin

Näkyy joka taulukossa: vyöhykepalkki sijan vieressä (`_qbar`) ja
`zone_legend()` alla, sivustolla rivin ylärajaviiva plus punainen nimi ja
palkki, ja molempien sijaintijakaumissa pystyviiva sarakkeen 15 kohdalla.
Väri ei koskaan kanna tätä yksin — sijaluku on vieressä ja selite nimeää
vyöhykkeet.

Huomaa että muototaulukko värittää **toteutuneen** sijan ja "Kuka voittaa
runkosarjan?" **ennustetun** — sama raja, eri kysymys.

**Malli ei tiedä putoamisesta eikä sen tarvitse.** Simulaatio tuottaa
sijoitusjakauman; putoamisraja on vain viiva sen päällä. Jos joskus haluat
mallin ottavan huomioon että putoamisuhan alla pelataan eri tavalla, se on
oma muutoksensa eikä seuraa tästä.

## Streamlit: Liigapörssi-design (1b muototaulukko, 2026-09-05)

Sovelluksen päänäkymä on toteutettu claude.ai/design-projektin
`Liigaporssi Streamlit.dc.html` suunnasta **1b** ("Kuka on kuumana?"):
sivupalkki, neljä välilehteä ja rivikohtainen muoto + vire.

**Paletti on Liigan logosta, tausta musta (2026-09-05).** Sävyt on poimittu
logokuvan pikseleistä eikä silmämääräisesti: korostus `#EBCA68`, kulta
`#CCA752`, keskikulta `#69521E`, ruskea `#36270D`, varjo `#2A1904`. Vakiot
ovat tiedoston alussa (`ACCENT`, `BRAND`, `GOLD_MID`, `GOLD_DIM`) ja
CSS-tokeneina `--lp-*`. Aiempi S-ryhmän vihreä on kokonaan poissa.

**SOK-logoa ei ole eikä tule.** Sivupalkin rakenne tulee SOK:n / S-ryhmän
design-systeemistä, mutta `assets/sok-logo-full.png` **ei** — tämä repo on
julkinen ja henkilökohtainen, eikä esitä itseään SOK:n tekemänä. Älä lisää
logoa ilman erillistä pyyntöä.

**Sivusto (`site/index.html`) ei muuttunut mustaksi.** Sen retro-2005-teema
on erikseen pyydetty ja dokumentoitu alempana; älä yhtenäistä niitä
oma-aloitteisesti.

Rakenne, ylhäältä alas:

1. **Kuka on kuumana?** — neljä välilehteä samasta `team_game_log`-datasta:
   Sarjataulukko (muotoruudut + vire-sparkline), Koti / vieras, Maalinteko
   (TM/PM/xG), Erikoistilanteet (YV / AV)
2. **Kuka voittaa runkosarjan?** — pankitut vs. simuloidut pisteet
3. **Mihin kukin joukkue päätyy** — sijaintijakauma
4. **Ottelut** — ✓/✗ sen mukaan osuiko malli
5. **Miten ennuste on liikkunut** — pienoiskuvaajat

Kohdat 3 ja 4 ovat ainoa paikka jossa **mallin toteuma** näkyy; älä poista
niitä designin tieltä.

**Kaikki viisi osiota käyttävät samaa muotokieltä ja samaa palettia.**
Mestaruuspalkit, sijaintijakauma ja ottelulista ovat kaikki `render_grid()`:n
CSS-gridejä — ei Altairia eikä `st.dataframe`a. Se ei ole pelkkä ulkonäköasia:
Styler ei osaa haalentaa riviä, joten sivupalkin korostus ei muuten ylettyisi
niihin.

**Korostus haalentaa muut, ei vain korosta valittua.** `dim_class()` antaa
riville `lp-on` tai `lp-off`; jälkimmäinen pudottaa opacityn 0,30:een. 17 rivin
taulukossa tai 289 solun lämpökartassa pelkkä korostusväri ei riitä — silmä
löytää valitun vasta kun ympäriltä otetaan kontrastia pois. Kun mitään ei ole
valittu, kaikki on täydessä voimassa: 17 rivin haalentaminen korostamatta
yhtäkään tekisi sivusta vain vaikealukuisemman. Ottelurivi korostuu jos
**kumpi tahansa** joukkue on valittu, ja pienoiskuvaajissa korostetut paneelit
nousevat ensimmäisiksi.

Kolme asiaa jotka eivät ole ilmeisiä:

- **Muototaulukko on HTML, ei `st.dataframe`.** Rivikohtaista SVG-sparklinea
  ja V/J/H-ruutuja ei saa Stylerilla: solu ottaa vain tekstin ja tyylin.
  `render_grid()` piirtää CSS-gridin yhtenä `st.markdown`-lohkona, mikä
  toimii kummallakin backendillä toisin kuin `st.column_config`.
- **`streamlit_app/.streamlit/config.toml` maalaa Streamlitin omat
  widgetit** ja asettaa `base = "dark"`. Ilman sitä liukusäädin,
  valintaruutu ja välilehden alleviivaus jäävät Streamlitin punaiseksi ja
  tausta valkoiseksi — CSS-injektio ei yllä widgettien sisään. Onko
  Snowflake-deploy sen lukee, on **testaamatta**.
- **`background-color` ei selviä Streamlitin HTML-sanitoinnista**, mutta
  lyhytmuoto `background` selviää. Sijaintijakauman 289 solusta jäi
  jäljelle pelkkä tekstiväri, jolloin kirkkaimmat solut olivat mustaa
  tekstiä mustalla. Todennettu DOM:ista, ei pääteltynä. `_cell_style`
  laskee sekoituksen rivin pohjaa vasten valmiiksi heksaksi, joten se ei
  ole myöskään alphan varassa.
- **Altair renderöi valkoiselle** ellei jokaista osaa nimetä erikseen.
  `dark()` asettaa taustan, akselit, ruudukon, selitteen ja fasettien
  otsikot; jokainen niistä putoaisi muuten omaan vaaleaan oletukseensa.
- **Fontit (Hanken Grotesk, Roboto Mono) tulevat Google Fontsista
  `@import`illa.** Snowflaken Streamlit voi estää ulkoisen pyynnön, joten
  fallback-pino on oikea eikä koriste.

**Lajittelu on pisteet → maaliero → tehdyt maalit**, eli liiga.fi:n oma
järjestys. Todennettu `raw_standings.ranking`-saraketta vasten, jonka API itse
palauttaa: tämä sääntö toistaa kaikki 17 sijaa, kun taas aiempi pisteet →
tehdyt maalit meni pieleen 10:ssä. Pelkkä maalimäärä palkitsee avoimesta
pelistä eikä hyvästä — HPK oli kolmantena 7 tehdyllä vaikka oli päästänyt 6.

**Ottelumäärä ei vaikuta järjestykseen.** SaiPa ja JYP ovat 6. ja 9. yhdellä
ottelulla, Lukko 3. kahdella. liiga.fi:n omassa bundlessa on kytkin
`sortByPointsPerGameSeason`, joten jonain kautena järjestys on ollut pisteet
per ottelu — tällä kaudella se ei ole päällä, ja sen käyttö nostaisi SaiPan ja
JYP:n kärkeen eli eri järjestykseen kuin virallinen taulukko.

⚠️ Tämä on **liiga.fi:n palauttama järjestys, ei todennettu sarjasääntö**.
Keskinäiset ottelut eivät ole vielä erottaneet ketään, joten jos oikea sääntö
sisältää ne, se ei näy tästä aineistosta. Tarkista uudelleen
`raw_standings.ranking`ia vasten jos järjestys alkaa poiketa.

Sarjataulukko rakennetaan `points`-sarakkeesta, ei `result_category`:sta:
Liiga jakaa 3/2/1/0, joten V / VJA / HJA / H on suoraan johdettavissa eivätkä
kaksi saraketta voi koskaan olla eri mieltä. `season_table()` saa koko
joukkuelistan erikseen — joukkue joka ei ole vielä pelannut puuttuu
`team_game_log`:sta kokonaan, ja syyskuussa se on normaali tilanne, ei
poikkeus.

## Diat jakoon — Streamlitin alaosio (2026-09-05)

Sovelluksen alimmainen osio tarjoaa viisi 1080×1350 (4:5) diaa **tästä
hetkestä**: sijat 1–6, 7–12, 13–17 sekä kaksi ennuste-vs-toteuma-diaa
(`award_status_slide`, `newcomers_status_slide`). Latausnapit antavat
**PDF:ää, eivät PNG:tä** — LinkedIn-karuselli on PDF, joten PNG olisi väärä
tiedostomuoto siihen mihin kuvia käytetään.

**Toteumadiat nimeävät samat pelaajat kuin ennakkodiat** ja näyttävät heidän
tuottonsa sekä sijansa pörssissä (`season_stats`, `RANK()` eikä
`ROW_NUMBER()` — viisi kolmen pisteen pelaajaa on kaikki kolmansia).

⚠️ **Torjunta-%:a ei voi laskea kuluvalta kaudelta.** `game_goalies` kirjaa
päästetyt maalit eikä mitään millä jakaa: liiga.fi ei julkaise laukauksia.
Maalivahtiriveillä on aloitukset ja päästetyt, ja dia sanoo syyn ääneen.
Älä keksi torjunta-%:a jostain.

**Rivillä on kaksi sijaa.** Iso laatikko on nykyinen ja nuolen alla `alkup.`
on ensimmäinen ennuste; nuoli on niiden erotus. Alaviite nimeää molemmat ja
päivää vertailun.

**`alkup.` on viimeisin ennuste ENNEN kauden alkua, ei `prediction_history`:n
vanhin rivi.** Tämä on käyttäjän määritelmä sanalle "alkuperäinen": se ennuste
joka julkaistiin. `rank_context()` etsii sen ehdolla **`games_played = 0`**
eikä päivämäärällä — niin se pysyy oikeana ensi kaudellakin ja kertoo
kyselyssä mitä tarkoittaa. Avauspäivän ajo lasketaan mukaan: putki ajetaan
aamulla ja ottelut pelataan illalla.

2026-27:llä se on **1.9.2026**, ja sen kärki (115/107/105/104/99/99) vastaa
täsmälleen `site_instagram/slide_1.png`:ää.

⚠️ Vanhin rivi on **28.6.2026** ja se on eri ennuste — **9 sijaeroa 17:stä**:
HIFK 6.→5., Jokerit 8.→6., SaiPa 5.→7., K-Espoo 11.→9. Tappara, KooKoo ja
Ilves istuvat molemmissa samalla sijalla, joten kärkeä katsomalla ei näe
kumpaa vertailukohtaa käytetään. Älä "korjaa" tätä vanhimmaksi riviksi.

**Nuoli vertaa ENSIMMÄISEEN ennusteeseen, ei edelliseen ajoon**, ja luku sen
alla on se johon se vertaa. Päivittäinen ajo liikuttaa joukkueita pisteen
kymmenesosilla, joten päivävertailu näyttäisi nuolen joukkueelle joka istuu
täsmälleen siinä sijassa jonka se sai kesäkuussa — KooKoo oli 2., putosi
välissä 3:een ja on taas 2. `proj_rank` on pienempi kun sija on parempi,
joten luvun lasku on dialla nousu; tämä on se kohta jonka saa helposti
väärinpäin.

⚠️ **Nuoli mittaa ennusteen liikettä, ei pelkkää kauden opetusta.** Siihen
sisältyy myös se mitä korjaamme omasta datastamme, eikä dia erota niitä.

Mittaus 15.9.: otteluita ei pelattu 10.9. jälkeen, joten `games_played` oli 23
joka päivä ja 14.9. → 15.9. -ero on **pelkkää dataa**. Silti seitsemän
joukkuetta vaihtoi sijaa: K-Espoo 7. → 10. (−6,0 p), HIFK 9. → 7., KooKoo
6. → 4., Jokerit 11. → 9., Sport −6,2 p. Syy oli kokoonpanojen täsmäytys ja
5.9. tehty nimikorjaus joka pääsi vihdoin `player_rates`:iin.

Esikauden rivi itse on turvassa: `prediction_history` on append-only eikä
roster-muokkaus kirjoita siihen takautuvasti. Todennettu 15.9. — 1.9. rivi on
yhä 115,3 / 107,4 / 104,8 / 104,1 / 99,0 / 98,7 eli sama kuin julkaistu
`site_instagram/slide_1.png`.

**Typografia on jaettu vain osittain, tarkoituksella.** Otsikot, sijanumerot,
joukkueiden nimet ja pistemäärät ovat Arial Blackia (`HEAD_F`) — dian ilme on
sen massassa, eikä julkaistun karusellin ulkoasu saa muuttua tunnistettavasti.
Leipäteksti (`BODY_F`) on **Hanken Grotesk**, sama kuin sovelluksessa.

Fontti on **viety repoon** (`site/assets/fonts/hanken-grotesk-400-latin.woff2`,
13 kt, SIL OFL) ja upotetaan diaan base64-data-URI:na, ei haeta Google
Fontsista ajon aikana: Chrome renderöi diat offline, ja verkosta haettu fontti
putoaisi hiljaa Helveticaan huonolla yhteydellä — jolloin dia poikkeaisi
edellisistä ilman näkyvää syytä. `body_font_face()` hoitaa upotuksen ja
kertoo jos tiedosto puuttuu.

**Vain leikkaus 400.** Dian CSS ei aseta `font-weight`iä millekään
`BODY_F`-elementille; jokainen lihavoitu vaihtaa `HEAD_F`:ään. Käyttämättömät
leikkaukset kolminkertaistaisivat jokaisen dian koon tyhjästä.

**Diat rakentaa `scripts/local/build_instagram.py`, ei `streamlit_app.py`.** Sama
koodi tuottaa levylle kirjoitettavan yhdeksän dian karusellin, joten ilme ei
voi karata erilleen. Streamlit lataa moduulin ajonaikaisesti
(`_slide_builder()`), ei importilla tiedoston alussa — yhden tiedoston
omavaraisuussääntö säilyy, ja Snowflakessa osio kertoo puuttumisesta ääneen
sen sijaan että katoaisi.

Jaetut osat skriptissä: `rasterise()` (HTML → PNG headless Chromella),
`iqr_bands()`, `rank_context()`, `live_slides()` ja `slides_to_pdf()`.

Kaksi asiaa jotka eivät ole ilmeisiä:

- **Rasterointi on Chrome.** Ulkoasu on CSS:ää, joten Python-piirtokirjasto
  olisi toinen, ajan myötä eriytyvä toteutus samasta ilmeestä. Hinta on että
  osio toimii läppärillä muttei Snowflakessa.
- **Vaakunat näkyvät puolikkaina tarkoituksella.** `.chip` on
  `overflow:hidden` ja logo ylisuuri; se on karusellin oma ratkaisu eikä
  rikkinäinen kuva. Älä "korjaa" sitä.

`build_instagram.py`:n ajaminen **ylikirjoittaa `site_instagram/`:n
julkaistut diat**. Aja se vain kun karuselli on tarkoitus julkaista uudelleen.

## Erilliset postaukset: varjosarjataulukko ja 40 minuuttia (2026-09-26)

Streamlitin diaosion alla on **"Erilliset postaukset"**, kaksi postausta omina
PDF:inään. Rakentajat ovat `scripts/local/build_instagram.py`:ssä (`xg_post()`,
`forty_post()`), eivät sovelluksessa, ja ne **eivät kirjoita mihinkään** —
`site_instagram/` pysyy koskemattomana, `build()` on edelleen ainoa joka
kirjoittaa sinne. Luvut lasketaan renderöintihetkellä, ei kovakoodattuina.

**Varjosarjataulukko** (`xg_shadow`): odotetut sarjapisteet maalipaikoista.
Kumpikin joukkue tekee maaleja Poissonin mukaan omalla xG:llään; voitto 3,
tasapeli 1,5 (jatkoajan 2 tai 1). Ottelu jakaa siis aina 3 pistettä, joten
**summa on sama kuin oikeassa taulukossa** — 171 = 171,0 kun tämä tehtiin —
ja taulukot ovat suoraan vertailukelpoisia. "Sarjassa" on liiga.fi:n järjestys
(pisteet → maaliero → tehdyt), sama kuin sovelluksessa.

Toinen dia väittää että varjosarjataulukkoon kannattaa uskoa. Väite on **testattu
eikä oletettu**, ja `xg_history()` laskee sen uudelleen joka renderöinnillä:
10 ensimmäisen ottelun jälkeen kaudet 2022–26 (77 joukkuekautta)

| ennustaa loppukauden pisteitä / ottelu | r |
|---|---|
| oikea sarjataulukko | 0,26 |
| **varjosarjataulukko** | **0,32** |
| viimeistelyonnen (maalit − xG) pysyvyys | **0,08** |
| pelin hallinnan (xG-ero) pysyvyys | 0,53 |

Eli viimeistelyn "onni" on käytännössä sattumaa joka tasoittuu. Kumpikaan
taulukko ei ennusta 10 ottelun kohdalla hyvin — varjosarjataulukko vain paremmin.
Dia sanoo sen noin eikä enempää.

**Peli ratkeaa 40 minuutissa** (`forty_minutes`): kahden erän jälkeinen
johtaja voitti historiassa 86,3 % (1 779 ottelua, 2022–26) ja tällä kaudella
93,2 % (41/44). Ero ei ole vielä merkitsevä (z = 1,3), ja dian alaviite
laskee tämän itse ja sanoo sen ääneen.

`forty_minutes` **kaatuu tarkoituksella** jos johtoasemien ja tappioasemien
summat eivät täsmää. Ensimmäinen versio laski jokaisen tasapelin molemmille
tappioasemaksi (tasatilanne on pandasissa `NaN`, ei `None`, eikä `is None`
tunnista sitä) ja näytti 16 käännöstä kolmen sijaan. Se näkyi vasta kun diaa
katsoi.

**Järjestys ei ole liiga.fi:n xME-järjestys (2026-10-11).** Liiga.fi:n
joukkuetilastot järjestää maalipaikkaeron (xTM − xPM) mukaan; data on sama
(TPS 34,01 / 21,38 kummassakin), mutta tämä muuttaa paikat ottelu kerrallaan
sarjapisteiksi, joten ylivoimainen paikkavoitto tuo enintään 3 p. Käyttäjä
valitsi tämän tavan ja alaviitteen, joka sanoo eron ääneen.

**Nimi on "varjosarjataulukko", ja sarakkeet on kirjoitettu lukijalle
(2026-09-26).** "xP" ja "Ero" eivät kertoneet kenellekään mitään, joten ne
ovat nyt "Paikkojen mukaan", "Oikeat pisteet" ja "Yli / ali", ja alaviite
sanoo selkokielellä mitä yli / ali tarkoittaa. Otsikko on 18 merkkiä eikä
mahdu 76 px:llä yhdelle riville, joten sillä on oma `.title.long` (62 px) —
kahdelle riville jaettuna 17 riviä ei mahtuisi.

⚠️ **Muutos `build_instagram.py`:hyn ei näy sovelluksessa ennen
uudelleenkäynnistystä.** `build_posts` ja `build_slides` ovat
`@st.cache_data`-funktioita, joiden avain on niiden oma koodi ja ennusteen
aikaleima — ei ladatun moduulin koodi. Kun muutat diaa, käynnistä Streamlit
uudelleen, tai sovellus tarjoaa vanhaa diaa uuden sijaan.

JYP:n vaakunasta näkyy vain kaistale, koska sen pyörre on oikealla ja
karusellin ilme näyttää vain vasemman puolikkaan. Sama kuin julkaistussa
karusellissa; ei korjattu (ks. "Vaakunat näkyvät puolikkaina tarkoituksella").

### Maalivahtipostaus (`goalie_post`, 2026-09-26)

Kaksi diaa, "Kovimmat torjujat" ja "Vaikein alku", kuusi maalivahtia kummassakin,
vähintään 3 ottelua. Kenttäpelaajille samaa **ei voi** tehdä: liiga.fi antaa xG:n
vain joukkueelle per ottelu, ei laukaukselle eikä pelaajalle.

Kolme valintaa, jokainen mitattu:

- **Maalivahdin OMAT päästetyt, ei joukkueen.** liiga.fi:n xG ei sisällä
  tyhjää maalia kohti laukaistuja paikkoja: 2022–26, 4 730 joukkueottelua,
  (maalit − xG) nousee **+1,61 ± 0,06 per tyhjä maali** — jos tyhjän maalin
  paikka olisi xG:ssä, nousu olisi ~0,2. `game_goalies.goals_against` nettoaa
  tyhjät jo valmiiksi. Joukkueen päästetyillä Saarinen olisi −2 väärin.
- **Vertailu keskivertomaalivahtiin, ei raakaan xG:hen.** Raaka xG yliarvioi
  tämän kauden maalit (maalivahdit päästävät 92 % xG:stä, ja historiassa
  suunta on sama). Raakana 12/20 oli plussalla ja lähes keskitasoinen
  päätyi "heikoimpiin". Odotus = vastustajan xG × kauden päästösuhde.
- **Vain ottelut joissa pelasi yksi maalivahti** — peliaikaa ei ole, joten
  jaettua ottelua ei voi jakaa (2/114). Näissä `goals_against` on NaN.

⚠️ **Plus tarkoittaa VÄHEMMÄN päästettyjä.** Ensimmäinen alaviite sanoi
"päästänyt enemmän (+)" — päinvastoin kuin luku. Alaviite puhuu nyt
*torjunnoista*, jolloin sana ja merkki osoittavat samaan suuntaan. Sama ansa
kuin diojen nuolissa: tarkista merkin suunta dialta, älä koodista.

"Vaikein alku" eikä "heikoimmat" tarkoituksella: kyse on oikeista ihmisistä
julkisessa postauksessa, ja historia tukee sanavalintaa — `xg_history()`:n
`r_gk` = **0,17**, eli alkukauden maalivahtipelin etu tasoittuu suurelta osin.
Alaviite laskee tämän ja sanoo sen.

### Alkukauden yllättäjät (`surprise_post`, 2026-10-10)

Kaksi diaa. **Joukkueet**: pisteet vs. odotus, joka lasketaan esikauden
`prediction_games`-snapshotista (`games_played = 0`, sama määritelmä kuin
`rank_context`) **ottelu kerrallaan juuri pelatuista otteluista**, joten
vastustajat ja koti/vieras ovat mukana. Summa täsmää oikeisiin (282 = 282,1),
ja funktio kaatuu jos ei. Alaviite nimeää joukkueet joilla |z| ≥ 2; z:n
hajonta tulee samoista todennäköisyyksistä (3/2/1/0).

**Pelaajat**: tehopisteet − esikauden p/ottelu × pelatut ottelut
(kokoonpanoista). Esikauden ennuste on **jäädytetty tiedostoon
`data/preseason_player_rates.csv`** (commit 8d37c6d), koska `player_rates`
rakentuu kauden aikana uudelleen. Älä päivitä sitä. Tuontipelaajat
yhdistetään nimellä + joukkueella (esikaudella heillä ei ollut id:tä).
`RL0`-haamumaalit vähennetään pisteistä.

**Pelaajadia on kokoonpano kentän muodossa: 3 hyökkääjää ylhäällä, 2 puolustajaa keskellä, maalivahti alhaalla**
(käyttäjän pyyntö 10.10.), ei kuusi suurinta. Pelipaikka tulee kokoonpanoista.
Maalivahti verrataan **omaan** esikauden torjuntaennusteeseensa
(`proj_save_pct` samassa CSV:ssä, `goalies_raw.txt`:n versiosta d454ecc):
`goalie_saves()`:n odotus × (1 − ennuste) / (1 − liigan keskiarvo). Ilman
sitä kärkeen nousisi se jonka tiedettiin jo olevan hyvä. Vain yllättäjät, ei pettymyksiä:
kyse on oikeista ihmisistä julkisessa postauksessa.

Älä vaihda genetiiviin ("KooKoo:n"): joukkueiden nimet taipuvat
epäsäännöllisesti, joten alaviite luettelee nimet perusmuodossa.

### Välitilinpäätös (`scorecard_post`, 2026-10-11)

Kaksi diaa: osumaprosentti isona ("Miten malli on osunut?") vertailuna
"aina kotijoukkue" ja otoksen ±-epävarmuus, sekä ennuste nyt vs. esikausi
(17 riviä: ennustesija, esikauden sija, nuoli, sarjasija, ennustetut pisteet).
Osuma lasketaan **täsmälleen kuten sovelluksen tulostaulu** (`render_scoreboard`):
viimeisin snapshot ottelupäivänä tai ennen, suosikki = `p_home_win >= 0,5`.
Älä laske sitä toisella ehdolla -- dia ja sovellus näyttäisivät eri luvun.

Prosenttiluku on keskitetty (`.hero.center`, vain tällä dialla -- 40 minuutin
dia käyttää samaa `.hero`a vasemmalle tasattuna). **Yhdistelmä**
`scorecard_surprise_post` = ennuste nyt vs. esikausi, yllättäjät kentällä,
varjosarjataulukko, yllättäjäjoukkueet (tässä järjestyksessä), neljä diaa yhtenä PDF:nä, **ilman osumaprosenttidiaa** (käyttäjän päätös 11.10.:
luku kuuluu postauksen tekstiin, lukijaa kiinnostaa oman joukkueen sijoitus).
Erilliset postaukset ovat sovelluksessa yhä.

Nuoli vertaa julkaistuun esikauden ennusteeseen (`games_played = 0`), ja
alaviite sanoo ääneen, että liike sisältää myös syyskuun datakorjaukset
(ks. "Nuoli mittaa ennusteen liikettä, ei pelkkää kauden opetusta").
