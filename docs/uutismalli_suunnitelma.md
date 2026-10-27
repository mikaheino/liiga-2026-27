# Uutismalli: projektisuunnitelma ja todo (luotu 2026-10-27)

Kevyen datan (aloittavat maalivahdit, loukkaantumiset, paluut, siirrot,
valmentajavaihdot, väsymys) tuominen ennusteeseen. Ei vielä toteutettu: tämä
dokumentti on suunnitelma, ja vaihe 0 varmistaa ensin, että data on saatavilla.

## Rajaus

- **Kokonaan GitHubissa ja ilmaiseksi:** Actions (ajot), Pages (sivu),
  git-haara (data), pull requestit + GitHub Mobile (hyväksyntä). Ehto: repo
  pysyy julkisena (yksityisessä Pages maksaa ja Actions-minuutit rajautuvat).
- **Haastaja, ei korvaaja:** lukittua mallia ei viritetä kesken kauden
  (AGENTS.md §10). Uutismalli = perusennuste + hyväksyttyjen tapahtumien
  vaikutus, kirjataan ennen jokaista ottelua kuten xG-haastaja
  (`prediction_games_challenger`, `ab_report.py`). Ratkaisu kauden lopussa
  log-lossilla.
- **Ihminen hyväksyy:** mikään uutisista poimittu ei mene malliin ilman
  hyväksyntää puhelimesta. Rakenteellinen data (kokoonpanot) voi mennä suoraan.
- **Ei Snowflakea, ei Macia:** kolmas ajopaikka pysyy itsenäisenä
  (CLAUDE.md: kolme erillistä ajopaikkaa).

## Arkkitehtuuri (tarkennettu 27.10. illalla)

Käyttäjän linjaukset 27.10.:
- **Uutiset ja kokoonpanot luetaan samassa ajossa kerran päivässä klo 14.00
  Suomen aikaa**, jolloin aloittava maalivahti on mukana samassa ennusteessa.
- **Haastaja reagoi lyhyisiinkin poissaoloihin**, ei vain pitkiin.
- **Hyväksyntä sovelluksessa yhdellä OK-painalluksella**, ei GitHubin PR:iä.
- **Tavoite: nähdä, paraneeko haastaja** näillä tiedoilla lukittuun malliin verrattuna.

```
klo 14.00 (Actions)
  liiga.fi: päivän otteluiden kokoonpanot ─┐  aloittava MV (line 1), kenttäjako
  Yle + seurojen sivut: uudet jutut ───────┤  liput, pelaajaehdotus rosterista
                                           ↓
  sovellus (puhelin): uutinen + pelaaja + kesto [1 ott · 1 vko · 2–4 vko · loppukausi]
                      OK → workflow_dispatch (token vain puhelimen selaimessa)
                                           ↓
  poissaolot.csv (news-data)  +  päivän aloittajat
                                           ↓
  haastaja: ottelukohtaiset todennäköisyydet ennen ottelua (poissaolijat pois,
  aloittajan esikauden torjuntaennuste) → prediction_games_news
                                           ↓
  Pages: virallinen ennuste ennallaan, haastajan ero otteluittain;
         A/B-näkymä: haastaja vs. lukittu malli (log-loss, osumat) kauden alusta
```

- **OK-nappi:** fine-grained token vain tähän repoon, oikeus *Actions: write*
  (ei koodin muokkausta), tallennettu kerran puhelimen selaimeen; julkisella
  sivulla nappeja ei näy ilman tokenia. Ajo validoi syötteen datana: uutinen
  löytyy `news_items.csv`:stä, pelaaja rosterista, kesto listasta; syöte
  ympäristömuuttujina, ei `${{ }}`-lausekkeina komentoriville (workflow-injektio).
- **Kokoonpano tarkistaa poissaolot:** jos "poissa oleva" pelaaja on päivän
  kokoonpanossa, poissaolo päättyy; jos ei ole, se vahvistuu.
- **Vaikutus** lasketaan skenaariologiikalla (`SIMULATE_SCENARIO`). Mittakaava
  27.10.: Huuhtanen (HIFK) poissa -> HIFK:n voittotodennäköisyys 51,9 -> 50,5 %
  per ottelu; koko loppukausi -2,0 p, top 6 23,5 -> 17,9 %. Lyhyt poissaolo on
  ~1–2 %-yks. per ottelu, joten haastaja mitataan otteluittain.
- **Maalivahtiosan voi testata heti historiassa** (kaudet 2022–26: kuka
  aloitti, `game_goalies`), uutisosaa ei (historiallisia uutisia ei ole) --
  se mitataan vain eteenpäin.
- **Turvallisuus** (tapaus 18.8.): uutisteksti on epäluotettavaa syötettä; ei
  kielimallia tässä vaiheessa, ei kirjoitusta koodiin.

## Datalähteet: tila 27.10.2026

Tarkistettu käsin 27.10. (curl, sama User-Agent kuin putkessa; kokeiluskriptit
istunnon scratchpadissa). ✓ = vastaa ja sisältää tarvittavan, ? = vastaa mutta
käyttö varmistamatta, ✗ = ei käytettävissä. "AI-kielto" = robots.txt kieltää
AI-botit (GPTBot, ClaudeBot, anthropic-ai, CCBot ym.).

### liiga.fi (virallinen, AI-kieltoja ei ole)

| lähde | tila | havainto |
|---|---|---|
| `games/{season}/{id}`: kokoonpano ennen ottelua | ✓ | KalPa–Sport 27.10. klo 18.30: kokoonpano (28 + 31 pelaajaa, `line`, `roleCode`) näkyi jo klo 15.27. Maalivahdit `MV`, `line 1` = aloittaja. GitHubin runner pääsee rajapintaan. |
| pelaajakenttä `injured` | ✗ | 0 / 520 pelaajariviä 10 välimuistin ottelussa: kenttä on, mutta tyhjä. |
| pelaajakenttä `suspended` | ✓ | Pelikielto ennen ottelua: 27.10. TPS:n seuraavassa ottelussa Lukas Wernblom (pitkä pelikielto, Yle 25.10.) ja vastustajan Linus Öberg `suspended: true`. Pelikiellot virallisesta lähteestä ilman uutisia; `lineups.py` kirjaa kentän. |
| `teams/info` | ✓ | 16 joukkuetta: seurojen viralliset osoitteet, **hallien koordinaatit** (karttalinkeissä) ja kausitilastot (corsi, PDO, alivoima/ylivoima, `distance_travelled` kausittain). Koordinaateista + otteluohjelmasta saa matkat ottelukohtaisesti väsymyssignaaliin (vaihe 3). Jokerit puuttuu. |
| `schedule`, `standings`, `players/stats/summed/...` | ✓ | 418 kt / 45 kt / 431 kt. |
| `news`, `articles`, `injuries`, `transfers`, `players`, `teams/stats`, `games/stats` | ✗ | 400 / 403. Ei uutis-RSS:ää. |

### Seurojen omat sivut (ensikäden lähde loukkaantumisille ja siirroille)

| seura | tila | havainto |
|---|---|---|
| HIFK, HPK, Ilves, JYP, K-Espoo, KooKoo, Lukko, Sport, Ässät | ✓ | RSS (`/feed` tai `/rss`, WordPress), ei AI-kieltoja. 9 / 17. |
| Kärpät, SaiPa, Jukurit | ✓? | Ei RSS:ää; `/uutiset/`-sivu (Kärpät 9 artikkelilinkkiä) ja SaiPa/Jukurit sivukartta. Ei AI-kieltoja. Tarvitsee HTML-jäsennyksen. |
| Jokerit | ? | `/uutiset` 20 linkkiä + sivukartta, mutta **AI-kielto**. Julkaisee mm. "Kokoonpano"-jutut. |
| Tappara, Pelicans, TPS (`hc.tps.fi`), KalPa (`kalpa.fi`) | ? | Etusivu vastaa, syötettä tai uutislistaa ei löytynyt tavallisista poluista. Selvitettävä käsin. |

### Media

| lähde | tila | havainto |
|---|---|---|
| Yle urheilu-RSS (`yle.fi/rss/urheilu`, `feeds.yle.fi/.../YLE_URHEILU.rss`) | ✓ | 20 juttua, ei AI-kieltoja; kaikki lajit, suodatus tarpeen. |
| Iltalehti jääkiekko-RSS | ? | 20 juttua, **AI-kielto**. |
| Ilta-Sanomat urheilu-RSS | ? | 100 juttua, **AI-kielto**. |
| Maakuntalehdet (Keskisuomalainen-konserni: ESS, Etelä-Saimaa, Hämeen Sanomat, Keskisuomalainen, Kouvolan Sanomat, Länsi-Savo, Savon Sanomat; Ilkka-Pohjalainen, Turun Sanomat) | ? | RSS löytyy, kaikilla **AI-kielto**. |
| HS, Aamulehti, Satakunnan Kansa, MTV, Kaleva | ? | Ei RSS:ää tavallisista poluista; uutissivukartat; **AI-kielto**. |
| Jatkoaika | ✗ | Ei syötettä, **AI-kielto**. |
| Google News RSS -haku | ✗ | Toimisi erinomaisesti ("Liiga loukkaantui" 100 juttua, "Kärpät" 61 / 7 vrk), mutta robots.txt kieltää `/rss/`-polut kaikilta. |
| Bing News RSS | ? | 7 juttua; ehdot tarkistamatta. |
| Leijonat | ✗ | 403. |

### Kielimalli

| lähde | tila | havainto |
|---|---|---|
| GitHub Models | ? | Actionsista ilman avainta; ilmaiset rajat (~50–150 kyselyä/vrk) vain kolmansien osapuolten lähteistä. |

**Johtopäätökset:**

1. **Aloittava maalivahti** saadaan virallisesta lähteestä ilman uutisia.
2. **Loukkaantumisille ja siirroille riittää ilman AI-kieltoja olevat lähteet:**
   seurojen omat sivut (9 RSS:llä + 3 uutissivulla = 12 / 17) ja Yle. Seura
   julkaisee loukkaantumis- ja siirtotiedon usein ensimmäisenä.
3. **AI-kiellolliset mediat** (iltapäivälehdet, maakuntalehdet, Jatkoaika,
   Jokerit): korkeintaan otsikko + linkki ihmiselle ilman tekstin käsittelyä,
   tai ei lainkaan. Ks. "robots.txt ja laki" alla.
4. **Väsymys/matkat** (vaihe 3) saadaan kokonaan liiga.fi:stä: hallien
   koordinaatit `teams/info`:sta + otteluohjelma.

### robots.txt ja laki

robots.txt ei sinänsä ole sitova, mutta EU:ssa sillä on oikeudellinen merkitys:
tekstin- ja tiedonlouhinnan poikkeus (DSM-direktiivi 2019/790 art. 4,
tekijänoikeuslaki 13 b §) ei ole voimassa, jos oikeudenhaltija on kieltänyt
louhinnan koneluettavasti, ja robots.txt:n AI-kielto on juuri sellainen
varaus. Tutkimuslaitosten poikkeus (art. 3) ei koske harrasteprojektia.
Lisäksi: repo on julkinen ja nimelläsi, ja estetty lähde voi estää GitHubin
IP-osoitteet koko putkelta. Ei oikeudellinen neuvo; linjaus: AI-kiellollisia
lähteitä ei louhita.

## Todo

### Vaihe 0: varmistukset ennen rakentamista

- [ ] **Kokoonpanon ajoitus, ratkaiseva klo 14:lle:** 27.10. klo 16.31 seuraavan päivän
      otteluilla pelaajalista oli rajapinnassa mutta `line` tyhjä (aloittaja tuntematon);
      saman päivän 18.30-ottelulla kokoonpano oli valmis viimeistään klo 15.27.
      14.00-ajo kirjaa joka ottelulle, oliko kokoonpano valmis -> kattavuus
      viikonloppujen 15.00/17.00-otteluissa erikseen. Jos ei riitä: toinen ajo
      myöhemmin ottelupäivänä.
- [ ] (vanha) **Kokoonpanon ajoitus:** milloin kokoonpano ilmestyy rajapintaan? Kirjaa
      tunneittain yhden viikon ajan (kaikki ottelupäivät), ja näytä myöhäiset muutokset
      (aloittaja vaihtuu viime hetkellä?). Tavoite: luotettava aikaraja.
- [ ] **Aloittajan tunnistus:** `MV` + `line 1` = aloittaja? Vertaa kauden
      pelattuihin otteluihin (`game_goalies`: kuka oikeasti pelasi) ≥ 50 ottelua.
- [ ] **`suspended`-kenttä:** mitä se tarkoittaa; vastaako pelikieltouutisia?
- [ ] **`injured`-kenttä:** tarkista koko kauden välimuistista ja tulevista
      kokoonpanoista; jos aina tyhjä, hylkää lopullisesti.
- [ ] **Käyttöehdot:** Iltalehti, IS ja Yle: saako RSS:n otsikkoa ja ingressiä
      käsitellä automaattisesti ja kielimallilla? Jos ei, vain otsikko + linkki
      sääntöpohjaisesti tai vain Yle.
- [ ] **Uutismäärä ja osuvuus** (keräin käynnissä 27.10. alkaen: `scripts/news/collect.py`,
      `news.yml` kerran päivässä (Ylen SM-liiga-aihesyöte kattaa ~7 vrk), tulos `news-data`-haaran `news_items.csv`; ensimmäinen ajo
      246 juttua 13 lähteestä, 68 liputettua): kerää 2 viikon ajan ilman poimintaa.
      Kuinka monta Liiga-juttua päivässä, monessako loukkaantuminen/paluu,
      montako niistä olisi muuttanut kokoonpanoa? Tämä kertoo, kannattaako vaihe 2.
- [ ] **Seurojen sivut, loput 5:** Tappara, Pelicans, TPS, KalPa (syöte tai
      uutislista käsin) ja Jokerit (AI-kielto: kysy seuralta tai jätä pois).
- [ ] **Kuka julkaisee ensin:** vertaa 2 viikkoa seuran sivua, Yleä ja
      iltapäivälehtien otsikoita samoista loukkaantumisista.
- [ ] **Hallien koordinaatit:** pura `teams/info`:n karttalinkeistä; Jokerit
      puuttuu (lisää käsin).
- [ ] **GitHub Models:** kokeile Actionsista yhdellä jutulla; kirjaa rajat ja
      vasteaika. Varasuunnitelma: sääntöpohjainen poiminta (avainsanat
      loukkaantui, sivussa, palaa, siirtyy, erotettiin).
- [ ] **60 päivän sääntö:** pitävätkö `pages-data`-commitit ajastukset päällä
      (GitHub sammuttaa julkisen repon ajastukset 60 päivän hiljaisuuden jälkeen)?
- [ ] **Tilastollinen voima:** montako jäljellä olevaa ottelua tarvitaan, että
      haastajan log-loss-ero erottuu? (99 ottelun jälkeen mikään malli ei
      erottunut vakiosta, `model_improvement_ideas.md` §2.)

## Tila 27.10. illalla: vaiheet 1–3 käytössä

**Historiatesti, aloittava maalivahti** (`scripts/experiments/starting_goalie.py`,
2 308 ottelun tiedot liiga.fi:stä `.cache/`-hakemistoon; walk-forward kuten
`liiga.inseason`). Taso = vastustajan xG - päästetyt per aloitus, aiemmat kaudet
(decay 0,7), regressio n0 näennäisottelulla; ero joukkueen kauden aiempien
aloittajien keskitasoon -> vastustajan maaliodottama. 12 muunnelmaa, kaikki
paransivat. Lukittu malli ll2 0,6623 (2023–26) / 0,6934 (2027).

| muunnelma (esikauden taso, n0 = 20) | ll2-muutos 2023–27 (1 999 ott.) | t |
|---|---:|---:|
| vain Poisson-osa (paino 0,4) — **valittu** | -0,0006 ± 0,0003 | -2,15 |
| koko ensembleen | -0,0012 ± 0,0007 | -1,66 |
| koko, otteluissa joissa aloittaja poikkeaa ≥ 0,15 maalia (270) | -0,0057 | |

Kausittain parannus 2023, 2024, 2026 ja 2027, ~0 kaudella 2025. Valittiin
pienempi mutta erottuva, samalla painolla kuin poissaolot. Tasot kaudelle
2026–27: `data/goalie_levels_2027.csv` (`--levels`; 114 vahtia, kärjessä
Randelin, Saarinen, Bartosak).

**Haastaja** (`scripts/news/challenger.py`, klo 14 -ajossa ja jokaisen OK:n
jälkeen): Pagesin aamun ennuste + aloittavat maalivahdit + liiga.fi:n pelikiellot
(`suspended`, näkyy jo päivää ennen kenttäjakoa) + hyväksytyt poissaolot
(`apply_injuries`, sama kuin agentin skenaariotyökalu). Vain alkamattomat
ottelut. Kirjataan `news-data/prediction_games_news.csv`. Esimerkki 28.10.:
K-Espoo–TPS 58,6 -> 59,1 % (Wernblom ja Öberg pelikiellossa), HIFK–Ilves
50,2 -> 48,9 %, jos Huuhtanen kirjataan poissaolevaksi.

**Kausiennuste poissaoloilla** (käyttäjä 27.10.: "jos Wernblom on poissa kuusi
ottelua, noille kuudelle ottelulle uusi ennuste, mikä vaikuttaa koko kauden
ennusteeseen"; sama loukkaantumisille): kesto kirjataan otteluina 1–10 tai
loppukausi (`approve.py` laskee paluupäivän joukkueen otteluohjelmasta), ja
`scripts/news/challenger_season.py` vie voimassa olevat poissaolot juuri niihin
otteluihin ja simuloi kauden skenaariotyökalun `compute`-funktiolla (samat
satunnaisluvut). Esimerkki: Wernblom 6 ottelua -> TPS:n voitto noissa
otteluissa 47,2 -> 45,0 %, kausi 89,8 -> 89,5 p, top 6 14,5 -> 13,6 %. Näkyy
Uutiset-sivulla, joukkuesivulla ja kierroskortissa (myös tulevat päivät).

**Sovellus (Pages):** Uutiset-sivu (alavalikko): Haastaja vs. lukittu malli
(log-loss, osumat pelatuista), päivän haastajaennusteet, uutiset suodatettuna
("vain olennaiset", joukkueen korostus). OK-napit näkyvät vain selaimessa, johon
on tallennettu token (fine-grained, vain tämä repo, Actions: Read and write):
`absence.yml` validoi (`approve.py`), kirjaa `absences.csv`:hen, laskee
haastajan ja julkaisee sivun arvolla `history=false` (illalla laskettu ajo ei
korvaa päivän ennustehistoriaa). Etusivun kierroskortissa haastajan rivi, kun
se poikkeaa tai sillä on huomioita.

### Vaihe 1: aloittava maalivahti (ei uutisia, ei kielimallia)

- [x] **Klo 14.00 -ajo** (27.10.): `scripts/news/lineups.py` + `collect.py` samassa
      `news.yml`-ajossa; `news-data`-haaraan `lineup_games.csv` (valmius + aloittajat,
      myös "ei valmis" -rivit) ja `lineup_players.csv` (valmiit kokoonpanot).

- [ ] Actions-ajo ottelupäivinä vaiheen 0 aikarajan jälkeen: hae kokoonpanot,
      tallenna aloittaja `pages-data`-haaraan aikaleimoineen.
- [ ] Haastaja: joukkueen painotetun maalivahtikeskiarvon tilalle aloittajan
      **esikauden** torjuntaennuste (ei kauden lukuja: r_gk = 0,17).
- [ ] Kirjaa haastajan ennuste ennen ottelua; A/B-raportti.
- [ ] Sivulle: aloittajat seuraavan kierroksen kortissa, kun tiedossa.

### Vaihe 2: loukkaantumiset ja paluut uutisista (jos vaihe 0 puoltaa)

- [ ] RSS-keräys, Liiga-suodatus, poiminta skeemaan, rosteriyhdistys.
- [ ] Botti avaa PR:n per ehdotus (`data/events/injuries.csv`), PR-kuvauksessa
      lähde, lainaus ja vaikutus ennusteeseen (skenaarioajo).
- [ ] Hyväksyntä GitHub Mobilessa; hylkäykset kirjataan (lähteen laatu).
- [ ] Paluun käsittely: tapahtumalla alku ja odotettu loppu; vanhenee itsestään.
- [ ] Ajoitus talteen (julkaistu, haettu, hyväksytty): ei vuotoa jo pelattuihin
      otteluihin.

### Vaihe 3: kevyet rakenteelliset signaalit

- [ ] Väsymys (peräkkäiset päivät, matkat): `model_improvement_ideas.md` §1.
- [ ] Valmentajavaihdon jälkeinen piristys (`coaching_changes` jo olemassa).
- Ei uutisten sävyä tai "fiilistä": todennäköisesti kohinaa (vrt.
  viimeistelyonni r = 0,08).

### Mittaus ja päätös

- [ ] Ennakkoon kirjattu hypoteesi ja mittari (log-loss, Brier) ennen
      ensimmäistä haastajaennustetta.
- [ ] Kauden lopussa: haastaja vs. lukittu malli; uutismalli otetaan
      perusmalliin vain, jos se voittaa myös historiatestissä.

## Avoimet päätökset käyttäjälle

1. Hyväksytäänkö uutislähteiden käyttö kielimallilla, vai vain säännöt + linkki?
2. Näkyykö haastajan ennuste sivulla perusennusteen rinnalla vai vain
   raportissa kauden loppuun asti?
3. Kuka saa PR-ilmoitukset (vain sinä, vai muitakin)?
