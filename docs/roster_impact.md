# Rosterimuutosten vaikutus aloituspisteisiin

*Generoitu: `python scripts/roster_impact.py` — älä muokkaa käsin.*

Esikauden ennuste (kaikki 544 ottelua, esikauden Elo) laskettuna jokaisella committoidulla rosteriversiolla. Kaikki muu pidetään samana, joten luvut kertovat pelkän rosterin vaikutuksen. Pisteiden summa on joka versiossa sama: kun joku vahvistuu, muut menettävät vähän, siksi muuttumattomillakin joukkueilla on pieni miinus.

Lähtötaso on **26.8.2026** (d454ecc), roster jolla kauden ensimmäinen ennuste tehtiin.

## Pisteet versioittain

| joukkue | 26.8.2026 | 15.9.2026 | 9.10.2026 | 16.10.2026 | muutos yhteensä |
|---|---:|---:|---:|---:|---:|
| Jukurit | 70,9 | 72,5 | 73,3 | 73,2 | **+2,3** |
| HIFK | 99,1 | 99,3 | 99,4 | 101,1 | **+2,0** |
| Sport | 69,1 | 69,0 | 71,1 | 71,0 | **+1,9** |
| HPK | 86,1 | 86,5 | 86,8 | 86,7 | **+0,6** |
| Ässät | 89,4 | 89,3 | 89,1 | 89,1 | **−0,3** |
| KalPa | 93,1 | 93,0 | 92,8 | 92,7 | **−0,4** |
| Ilves | 104,1 | 104,0 | 103,8 | 103,7 | **−0,4** |
| SaiPa | 98,2 | 98,1 | 97,9 | 97,8 | **−0,4** |
| K-Espoo | 93,7 | 93,6 | 93,4 | 93,3 | **−0,4** |
| Kärpät | 91,2 | 91,1 | 90,9 | 90,8 | **−0,4** |
| Lukko | 105,1 | 105,0 | 104,8 | 104,7 | **−0,4** |
| TPS | 78,9 | 78,8 | 78,6 | 78,5 | **−0,4** |
| JYP | 96,7 | 96,6 | 96,3 | 96,3 | **−0,4** |
| Tappara | 115,3 | 115,2 | 114,7 | 114,6 | **−0,7** |
| KooKoo | 107,4 | 107,0 | 106,8 | 106,7 | **−0,8** |
| Pelicans | 89,2 | 88,6 | 88,4 | 88,3 | **−0,9** |
| Jokerit | 98,6 | 98,5 | 97,8 | 97,4 | **−1,2** |

## Vaiheittain

### 15.9.2026 — Reconcile the roster with who has actually been dressing

Commit `dd120d5`, roster 509 → 526.

| joukkue | muutos | lisätty | poistettu |
|---|---:|---|---|
| Jukurit | +1,6 | Aleksandr Osipov, Alex Lintuniemi, Linus Sjödin, Natan Gashaw Teshome, Rasmus Baggström, Thomas Olsen | – |
| HPK | +0,4 | Gabriel Nitz, Ilari Mäkinen | – |
| HIFK | +0,3 | Frans Karjalahti, Linus Nässen, Ossi Sippola | – |
| Ässät | −0,1 | Maxim Saarimäki | – |
| K-Espoo | −0,1 | Juho Keinänen | – |
| TPS | −0,1 | Petteri Lindbohm | – |
| KooKoo | −0,5 | Niclas Westerholm, Samuel Heikkinen | – |
| Pelicans | −0,7 | Jasper Lattu, Onni Amhamdi | Lukas Zetterberg |

*Rivit näytetään joukkueille joiden rosteri muuttui tai joiden pisteet liikkuivat vähintään 0,5.*

### 9.10.2026 — Bring the roster up to date with transfers since 8 Sep, and keep hockeydb

Commit `e340020`, roster 526 → 538.

| joukkue | muutos | lisätty | poistettu |
|---|---:|---|---|
| Sport | +2,1 | Brett Harrison, Oula Palve | – |
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
| HIFK | +1,7 | Olof Glifford, Sampo Ranta | – |
| Ässät | 0,0 | Ethan Prow | – |
| Jukurit | −0,1 | Christoffer Sedoff | – |
| Pelicans | −0,1 | – | Onni Käyhkö |
| JYP | −0,1 | Atte Ohtamaa | – |
| K-Espoo | −0,1 | – | Tuomas Suoniemi |
| Jokerit | −0,4 | – | Oliver Suni |

*Rivit näytetään joukkueille joiden rosteri muuttui tai joiden pisteet liikkuivat vähintään 0,5.*

