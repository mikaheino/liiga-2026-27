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

## Arkkitehtuuri

```
liiga.fi API (kokoonpanot) ──────────────────────────────┐
RSS (Iltalehti, IS, Yle) → suodatus → poiminta → PR ──→ hyväksyntä (puhelin)
                                                          ↓
                                   data/events/*.csv (pages-data-haara)
                                                          ↓
                 perusennuste + tapahtumat → haastajaennuste → Pages
```

- **Poiminta** tuottaa vain rakenteen
  `{tyyppi, pelaaja, joukkue, kesto, julkaistu, haettu, lähde-url, lainaus ≤ 1 lause}`.
  Pelaaja yhdistetään rosteriin koodilla (`player_id`), ei kielimallilla.
- **Vaikutus** lasketaan nykyisellä skenaariologiikalla (`apply_injuries`,
  `SIMULATE_SCENARIO`, `scripts/tools/skenaario.py`): pelaaja pois joukkueen
  vahvuudesta. Uutta on vain havaitseminen.
- **Turvallisuus** (tapaus 18.8.: uutissivuja lukenut agentti injektoitiin ja
  muokkasi tiedostoja): uutisteksti on epäluotettavaa syötettä. Poimijalla ei
  työkaluja eikä kirjoitusoikeutta, tulos skeemaan validoituna, crawler
  kirjoittaa vain yhteen datatiedostoon PR:n kautta, ei koskaan koodiin.

## Datalähteet: tila 27.10.2026

Tarkistettu käsin 27.10. (curl, sama User-Agent kuin putkessa). ✓ = vastaa ja
sisältää tarvittavan, ? = vastaa mutta käyttö varmistamatta, ✗ = ei käytettävissä.

| lähde | tila | havainto |
|---|---|---|
| liiga.fi `games/{season}/{id}`: kokoonpano ennen ottelua | ✓ | KalPa–Sport 27.10. klo 18.30: kokoonpano (28 + 31 pelaajaa, `line`, `roleCode`) näkyi jo klo 15.27. Maalivahdit `MV`, `line 1` = aloittaja (Korhonen / Härkönen). GitHubin runner pääsee rajapintaan (`pages-connectivity.yml`). |
| liiga.fi pelaajakenttä `injured` | ✗ | 0 / 520 pelaajariviä 10 välimuistin ottelussa. Kenttä on olemassa, mutta sitä ei näytä käytettävän. |
| liiga.fi pelaajakenttä `suspended` | ? | 6 / 520 riviä: käytössä, merkitys (pelikielto tässä ottelussa?) varmistettava. |
| liiga.fi uutisrajapinta | ✗ | `api/v2/news` 400, `articles` ja `injuries` 403. Ei RSS:ää (`/fi/uutiset/rss` palauttaa HTML:n). |
| Iltalehti, jääkiekko-RSS | ? | `iltalehti.fi/rss/jaakiekko.xml`: 20 juttua. robots.txt kieltää AI-botit (`AI2Bot` ym.): käyttöehdot tarkistettava ennen kielimallia. |
| Ilta-Sanomat, urheilu-RSS | ? | `is.fi/rss/urheilu.xml`: 100 juttua, kaikki lajit (suodatus tarpeen). robots.txt kieltää mm. `anthropic-ai` ja `Claude-SearchBot`. |
| Yle, urheilu-RSS | ✓? | `yle.fi/rss/urheilu`: 20 juttua; robots.txt:ssä ei AI-kieltoja. Kaikki lajit. |
| Jatkoaika | ✗ | `/rss` ja `/feed` 404; ei löytynyt syötettä. |
| Seurojen sivut (17) | – | Tarkistamatta. |
| GitHub Models (kielimalli) | ? | Toimii Actionsista ilman avainta, ilmaiset rajat (~50–150 kyselyä/vrk) vain kolmansien osapuolten lähteistä. Voi muuttua. |

**Johtopäätös:** aloittava maalivahti on saatavilla virallisesta lähteestä ilman
uutisia. Loukkaantumisille ei ole virallista lähdettä, joten ne tulevat
uutisista. Uutislähteiden käyttöehdot ovat avoin kysymys.

## Todo

### Vaihe 0: varmistukset ennen rakentamista

- [ ] **Kokoonpanon ajoitus:** milloin kokoonpano ilmestyy rajapintaan? Kirjaa
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
- [ ] **Uutismäärä ja osuvuus:** kerää RSS:t 2 viikon ajan ilman poimintaa.
      Kuinka monta Liiga-juttua päivässä, monessako loukkaantuminen/paluu,
      montako niistä olisi muuttanut kokoonpanoa? Tämä kertoo, kannattaako vaihe 2.
- [ ] **Seurojen sivut:** onko RSS:ää tai uutislistaa; kuka julkaisee
      loukkaantumiset ensimmäisenä?
- [ ] **GitHub Models:** kokeile Actionsista yhdellä jutulla; kirjaa rajat ja
      vasteaika. Varasuunnitelma: sääntöpohjainen poiminta (avainsanat
      loukkaantui, sivussa, palaa, siirtyy, erotettiin).
- [ ] **60 päivän sääntö:** pitävätkö `pages-data`-commitit ajastukset päällä
      (GitHub sammuttaa julkisen repon ajastukset 60 päivän hiljaisuuden jälkeen)?
- [ ] **Tilastollinen voima:** montako jäljellä olevaa ottelua tarvitaan, että
      haastajan log-loss-ero erottuu? (99 ottelun jälkeen mikään malli ei
      erottunut vakiosta, `model_improvement_ideas.md` §2.)

### Vaihe 1: aloittava maalivahti (ei uutisia, ei kielimallia)

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
