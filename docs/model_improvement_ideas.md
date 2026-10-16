# Mallin parannusideat

Ideoita siitä, miten ennustemallia voi parantaa. Tämä on **ideavarasto**, ei
aikataulu: järjestetty suunnitelma siitä, mitä mitataan ja milloin, on
`docs/model_improvements_in_season.md`.

Kaksi sääntöä koskee jokaista ideaa:

- **Ei viritystä kesken kauden** (AGENTS.md §10). Idean voi mitata nyt, mutta
  malliin se menee vasta kauden jälkeen, ja sitä arvioidaan log-lossilla ja
  MAE:lla, ei korrelaatiolla.
- **Mittari on mallin virhe, ei raaka tilasto.** "Väsyneet joukkueet voittavat
  harvemmin" voi tarkoittaa vain, että heikot joukkueet pelaavat tiheämmin.
  Kysymys on aina: osuuko malli järjestelmällisesti ohi tässä tilanteessa?

Kirjaa jokaiselle: ongelma, näyttö tähän mennessä, tarvittava data, miten
mitataan, milloin.

---

## 1. Väsymys (lisätty 2026-10-10)

**Ongelma.** Malli ei tiedä, onko joukkue pelannut eilen, levännyt viikon tai
matkustanut 600 km. Jokainen ottelu simuloidaan kuin molemmat olisivat
levänneitä.

**Näyttö tähän mennessä.** Kaudet 2022–26, 2 266 ottelua, raaka
kotivoitto-% (ei vielä mallin virheenä):

| tilanne | ottelut | koti voitti |
|---|---:|---:|
| molemmat levänneet (vertailu) | 1 462 | 54,6 % |
| koti pelasi eilen, vieras levännyt 2–4 pv | 91 | 45,1 % |
| koti pelasi eilen, vieras levännyt 5+ pv | 24 | 62,5 % |
| vieras pelasi eilen, koti levännyt | 326 | 56,4 % |
| molemmat pelasivat eilen | 363 | 58,4 % |

Selvin vaikutus on kotijoukkue toisena peräkkäisenä päivänä levännyttä
vastaan: noin −9 prosenttiyksikköä (n = 91). Vierasjoukkueen väsymys näkyy
vain noin +2:na. Pitkästä levosta ei ole näyttöä edusta (n = 24, kohina).
Laskettu ad hoc 10.10.; kysely liittää `team_game_log`in `(season, game_id)`:llä.

**Havainto 10.10.:** seitsemästä toista päivää pelaavasta joukkueesta kolme
vaihtoi aloittavan maalivahdin (HPK Saarinen → Crespin, Kärpät Rubin →
Vedenpää, Ilves Rifalk → Armalis). Osa väsymyksen vaikutuksesta kulkee siis
maalivahdin kautta, ja se on eri asia kuin kenttäpelaajien väsymys.

**Data, joka meillä jo on:**

1. **Lepopäivät** — `stg_games.start_ts` joukkueittain. Muuttuja: päiviä
   edellisestä ottelusta (1 = toinen peräkkäinen päivä).
2. **Otteluiden tiheys** — otteluita viimeisen 7 päivän aikana.
3. **Maalivahdin kuormitus** — pelasiko aloittaja eilen (`game_goalies`),
   ja aloittiko tänään varamaalivahti.

**Data, joka puuttuu:**

4. **Matkustus** — kilometrit edellisestä ottelupaikasta. Tarvitsee 17 hallin
   koordinaatit kerran käsin (kotihalli = kotijoukkue). Ottelupaikka on aina
   kotijoukkueen halli. **Liiga.fi näyttää joukkuetilastoissa sarakkeen
   "Matka"** (kumulatiivinen km, esim. Jukurit 942, Pelicans 675 11.10.), joten
   luku on heillä olemassa; selvitä mistä päätepisteestä se tulee ennen kuin
   lasket omaa. Kumulatiivinen summa ei riitä sellaisenaan -- tarvitaan
   ottelukohtainen matka.

**Miten mitataan.**

- *Historia (backtest):* aja `elo_ratings_as_of`-tyyppinen ennakkoennuste
  jokaiselle 2022–26 ottelulle ja laske residuaali (toteuma − ennuste)
  lepoluokittain. Jos residuaali on nolla, malli on jo väsymyksen tasolla
  (esim. koska heikot joukkueet pelaavat tiheämmin) eikä korjausta tarvita.
- *Tämä kausi:* `prediction_games` sisältää jokaisen ottelun ennakkoennusteen
  (`V_GAME_EVALUATION` Snowflakessa), joten residuaali lepoluokittain on yksi
  kysely. Otos on pieni; käytä vain suunnan tarkistukseen.
- *Muoto:* yksi kerroin per luokka (esim. koti-b2b vs. levännyt vieras)
  odotettuihin maaleihin tai Elo-eroon, ei uutta mallia. Hyväksy vain, jos
  log-loss paranee kauden ulkopuolella (leave-one-season-out).

**Milloin.** Historian residuaalit voi laskea milloin tahansa (ei API-kutsuja,
data on kannassa). Malliin kauden 2026-27 jälkeen. Siihen asti väsymyksen voi
näyttää erillisenä korjauksena, kuten käsin tehdyssä veikkauksessa 10.10.

---

## 2. Merkit lukitun mallin parantamiseksi (lisätty 2026-10-11)

**Kysymys.** Onko 99 ensimmäisestä ottelusta löytynyt merkkejä, joilla ennuste
olisi parempi kuin ennen kautta lukittu malli?

**Lähtötilanne, 99 ottelua:**

| | osuma | log-loss |
|---|---:|---:|
| lukittu malli (ennuste ennen ottelua) | 56,6 % | 0,690 |
| tämän kauden xG-arvio yksinään¹ | 57,6 % | 0,705 |
| vakio "kotijoukkue voittaa 58,6 %" | 58,6 % | 0,678 |

¹ Joukkueen xG tehty/päästetty kauden alusta, kotietu kauden maaleista,
aloittavan maalivahdin kauden torjunnat, Poisson. Laskettu takautuvasti ilman
jälkiviisautta (vain ottelua edeltävät ottelut). Skripti istunnon
scratchpadissa 11.10.; tee siitä pysyvä ennen historiatestiä.

Kumpikaan ei vielä päihitä vakiota, mutta 99 ottelulla ero ei ole merkitsevä.
Kolme merkkiä, kaikki **otoksen sisällä löydettyjä** -- ne ovat hypoteeseja,
eivät tuloksia, ennen kuin ne pitävät historiassa:

1. ~~**Kotietu on mallissa pieni.**~~ **Testattu 16.10. — hylätty.**
   `scripts/experiments/home_advantage.py`: tuotannon ensemble kausilla
   2024–26, Poissonin `home_ice` 1,04–1,20 × Elon `home_adv` 20–80,
   leave-one-season-out. Parannus pidetyllä kaudella **+0,0000** log-lossia.
   Malli on historiassa kalibroitu oikein: keskimääräinen kotitodennäköisyys
   54,3–54,4 % vs. toteuma 54,2–56,0 %. Väite "malli jää alle historian
   keskiarvon" oli väärä: koko kauden 544 ottelun keskiarvo on 54,4 %, ja
   53,0 % johtui siitä, että ensimmäisissä 104 ottelussa vieraina oli
   keskimääräistä vahvempia joukkueita (esikauden ennuste niille 53,7 %).
   Tämän kauden 58,7 % on kohinaa: z = 0,78 historian 54,9 %:sta. Älä
   avaa tätä uudelleen ilman uutta näyttöä; tarkista kauden lopussa.
2. **Mallin ja kauden xG-arvion yhdistelmä on parempi kuin kumpikaan.** 70 %
   malli + 30 % xG-arvio: log-loss 0,690 → 0,682 (xG-arvio yksin 0,705).
   Tukee ajatusta, että pelaajapohjainen osa (40 %, jäädytetty kauden alkuun)
   hyötyisi tämän kauden maalipaikoista. Sama suunta kuin xg_history():n
   historiallinen tulos: 10 ottelun jälkeen xG-taulukko ennustaa loppukautta
   paremmin kuin oikea taulukko (r = 0,32 vs. 0,26). Liittyy
   `docs/model_improvements_in_season.md`:n "thaw team_strength" -kohtaan.
3. **Päivän aloittava maalivahti.** Kokoonpano kertoo aloittajan ~2 h ennen
   ottelua, mutta malli käyttää joukkueen painotettua keskiarvoa. 10.10.
   seitsemästä toista päivää pelaavasta joukkueesta kolme vaihtoi
   maalivahtia. Varoitus: maalivahdin alkukauden ylivire tasoittuu
   (historiassa r_gk = 0,17), joten käytä aloittajan *esikauden*
   torjuntaennustetta, älä kauden lukuja.

Negatiivinen tulos, joka kannattaa muistaa: **viimeistelyonnea ei kannata
jahdata.** Maalit − xG -erän pysyvyys on historiassa r = 0,08, joten
pelkkien maalien varaan päivittyvä Elo oppii osin sattumaa.

**Miten testataan (ei kesken kauden virittäen):** jokainen merkki erikseen
kausilla 2022–26, leave-one-season-out, log-loss ja MAE. Kotietu ja
aloittava maalivahti ovat halvimmat testata (data on kannassa). Yhdistelmän
paino valitaan historiasta, ei tämän kauden 99 ottelusta -- 70/30 on löydetty
juuri niistä ja olisi muuten ylisovitettu.

**Milloin:** historiatestit milloin tahansa; malliin kauden 2026-27 jälkeen.

---

## Muut avoimet ideat (yksityiskohdat muualla)

Lyhyt hakemisto, jotta ideat löytyvät yhdestä paikasta. Lähde on linkitetyssä
kohdassa; älä kopioi yksityiskohtia tänne.

| idea | ongelma lyhyesti | missä |
|---|---|---|
| Maalivahtien painotus | kolmas maalivahti, jolla on paljon otteluita alemmalla tasolla, huonontaa joukkuetta (Auvinen: HIFK 1,101 → 1,119; Karhunen: Jokerit −0,7 p) | CLAUDE.md "Adding new players" kohta 9; `goalies.build_team_goaltending` |
| Päivän aloittava maalivahti | malli käyttää painotettua keskiarvoa, vaikka kokoonpano julkaistaan ~2 h ennen ottelua ja kertoo aloittajan | uusi, 10.10. |
| Regressio pelipaikan keskiarvoon | pelaaja, jolla on vähän huonoa dataa, arvottuu korkeammalle kuin pelaaja ilman dataa (Mäkinen 0,128 → 0,219) | CLAUDE.md "Näkymätön Liiga-historia" |
| `RL0`-haamumaalit | `player_season_scoring` laskee epäonnistuneet rangaistuslaukaukset maaleiksi, 172 maalia 2022–26 | CLAUDE.md "Maalitapahtuma ei ole aina maali" |
| Loukkaantumiset ja rosterimuutokset | `game_lineups.injured` kertoo poissaolot, mutta malli ei käytä niitä | `docs/model_improvements_in_season.md` "TODO — decide the in-season roster policy" |
