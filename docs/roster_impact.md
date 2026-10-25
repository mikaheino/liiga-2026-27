# Rosterimuutosten vaikutus aloituspisteisiin

*Generoitu: `python scripts/local/roster_impact.py` — älä muokkaa käsin.*

Esikauden ennuste (kaikki 544 ottelua, esikauden Elo) laskettuna jokaisella committoidulla rosteriversiolla. Kaikki muu pidetään samana, joten luvut kertovat pelkän rosterin vaikutuksen. Pisteiden summa on joka versiossa sama: kun joku vahvistuu, muut menettävät vähän, siksi muuttumattomillakin joukkueilla on pieni miinus.

Lähtötaso on **26.8.2026** (d454ecc), roster jolla kauden ensimmäinen ennuste tehtiin.

## Pisteet versioittain

| joukkue | 26.8.2026 | 15.9.2026 | 9.10.2026 | 16.10.2026 | 16.10.2026 | 25.10.2026 | muutos yhteensä |
|---|---:|---:|---:|---:|---:|---:|---:|
| KalPa | 92,9 | 92,8 | 92,6 | 92,5 | 92,5 | 95,5 | **+2,6** |
| Jukurit | 70,9 | 72,5 | 73,2 | 73,2 | 73,2 | 73,0 | **+2,1** |
| Sport | 69,2 | 69,1 | 71,3 | 71,2 | 71,3 | 71,1 | **+1,9** |
| HIFK | 99,2 | 99,5 | 99,4 | 101,2 | 101,0 | 100,9 | **+1,7** |
| HPK | 86,2 | 86,6 | 86,9 | 86,8 | 86,8 | 87,4 | **+1,2** |
| Ässät | 89,3 | 89,2 | 89,0 | 89,0 | 89,0 | 88,9 | **−0,4** |
| Ilves | 104,0 | 104,0 | 103,8 | 103,7 | 103,7 | 103,6 | **−0,5** |
| TPS | 79,0 | 78,9 | 78,7 | 78,6 | 78,6 | 78,5 | **−0,5** |
| Kärpät | 91,3 | 91,2 | 91,0 | 90,9 | 90,9 | 90,7 | **−0,5** |
| SaiPa | 98,2 | 98,1 | 97,9 | 97,8 | 97,8 | 97,6 | **−0,5** |
| K-Espoo | 93,8 | 93,7 | 93,5 | 93,4 | 93,4 | 93,3 | **−0,6** |
| Lukko | 105,1 | 105,0 | 104,8 | 104,7 | 104,7 | 104,6 | **−0,6** |
| JYP | 96,2 | 96,1 | 95,9 | 95,8 | 95,8 | 95,7 | **−0,6** |
| KooKoo | 107,4 | 106,9 | 106,7 | 106,6 | 106,7 | 106,5 | **−0,9** |
| Pelicans | 89,4 | 88,8 | 88,6 | 88,5 | 88,5 | 88,4 | **−1,0** |
| Jokerit | 98,7 | 98,6 | 97,9 | 97,5 | 97,5 | 97,4 | **−1,3** |
| Tappara | 115,3 | 115,2 | 114,7 | 114,6 | 114,6 | 113,2 | **−2,1** |

## Vaiheittain

### 15.9.2026 — Reconcile the roster with who has actually been dressing

Commit `dd120d5`, roster 509 → 526.

| joukkue | muutos | lisätty | poistettu |
|---|---:|---|---|
| Jukurit | +1,6 | Aleksandr Osipov, Alex Lintuniemi, Linus Sjödin, Natan Gashaw Teshome, Rasmus Baggström, Thomas Olsen | – |
| HPK | +0,4 | Gabriel Nitz, Ilari Mäkinen | – |
| HIFK | +0,3 | Frans Karjalahti, Linus Nässen, Ossi Sippola | – |
| Ässät | −0,1 | Maxim Saarimäki | – |
| TPS | −0,1 | Petteri Lindbohm | – |
| K-Espoo | −0,1 | Juho Keinänen | – |
| KooKoo | −0,5 | Niclas Westerholm, Samuel Heikkinen | – |
| Pelicans | −0,7 | Jasper Lattu, Onni Amhamdi | Lukas Zetterberg |

*Rivit näytetään joukkueille joiden rosteri muuttui tai joiden pisteet liikkuivat vähintään 0,5.*

### 9.10.2026 — Bring the roster up to date with transfers since 8 Sep, and keep hockeydb

Commit `e340020`, roster 526 → 538.

| joukkue | muutos | lisätty | poistettu |
|---|---:|---|---|
| Sport | +2,2 | Brett Harrison, Oula Palve | – |
| Jukurit | +0,8 | Emils Vitols, Pekka Jormakka | Bogdans Hodass |
| HPK | +0,3 | Olli Palola, Onnikalle Lehtonen, Samuli Piipponen | – |
| HIFK | 0,0 | David Nemecek, Vili Varonen | Jori Lehterä |
| KooKoo | −0,2 | Niilo Romppanen | – |
| Lukko | −0,2 | Markus Kartano | – |
| Tappara | −0,5 | Markus Niemeläinen, Niko Hovinen | – |
| Jokerit | −0,7 | Tomi Karhunen | – |

*Rivit näytetään joukkueille joiden rosteri muuttui tai joiden pisteet liikkuivat vähintään 0,5.*

### 16.10.2026 — Bring the roster up to date with transfers since 9 Oct

Commit `ac63c18`, roster 538 → 540.

| joukkue | muutos | lisätty | poistettu |
|---|---:|---|---|
| HIFK | +1,8 | Olof Glifford, Sampo Ranta | – |
| Ässät | 0,0 | Ethan Prow | – |
| Pelicans | −0,1 | – | Onni Käyhkö |
| Jukurit | −0,1 | Christoffer Sedoff | – |
| K-Espoo | −0,1 | – | Tuomas Suoniemi |
| JYP | −0,1 | Atte Ohtamaa | – |
| Jokerit | −0,4 | – | Oliver Suni |

*Rivit näytetään joukkueille joiden rosteri muuttui tai joiden pisteet liikkuivat vähintään 0,5.*

### 16.10.2026 — Add Axel Landen and Severi Auvinen, and note that the schedule must reach Snowflake

Commit `ccf0e19`, roster 540 → 542.

| joukkue | muutos | lisätty | poistettu |
|---|---:|---|---|
| TPS | 0,0 | Axel Landen | – |
| HIFK | −0,2 | Severi Auvinen | – |

*Rivit näytetään joukkueille joiden rosteri muuttui tai joiden pisteet liikkuivat vähintään 0,5.*

### 25.10.2026 — Bring the roster up to date with transfers since 16 Oct

Commit `3cb1c50`, roster 542 → 545.

| joukkue | muutos | lisätty | poistettu |
|---|---:|---|---|
| KalPa | +3,0 | Jonne Tammela, Kyle Crnkovic | – |
| HPK | +0,6 | Mattias Tedenby | – |
| Pelicans | −0,1 | Antti Tyrväinen | – |
| Tappara | −1,4 | – | Jonne Tammela |

*Rivit näytetään joukkueille joiden rosteri muuttui tai joiden pisteet liikkuivat vähintään 0,5.*

