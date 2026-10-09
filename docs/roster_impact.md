# Rosterimuutosten vaikutus aloituspisteisiin

*Generoitu: `python scripts/roster_impact.py` — älä muokkaa käsin.*

Esikauden ennuste (kaikki 544 ottelua, esikauden Elo) laskettuna jokaisella committoidulla rosteriversiolla. Kaikki muu pidetään samana, joten luvut kertovat pelkän rosterin vaikutuksen. Pisteiden summa on joka versiossa sama: kun joku vahvistuu, muut menettävät vähän, siksi muuttumattomillakin joukkueilla on pieni miinus.

Lähtötaso on **26.8.2026** (d454ecc), roster jolla kauden ensimmäinen ennuste tehtiin.

## Pisteet versioittain

| joukkue | 26.8.2026 | 15.9.2026 | 9.10.2026 | muutos yhteensä |
|---|---:|---:|---:|---:|
| Jukurit | 70,8 | 72,4 | 73,2 | **+2,4** |
| Sport | 69,1 | 69,0 | 71,3 | **+2,1** |
| HPK | 86,1 | 86,5 | 86,8 | **+0,7** |
| HIFK | 99,1 | 99,4 | 99,4 | **+0,3** |
| Ilves | 104,2 | 104,1 | 103,9 | **−0,3** |
| Kärpät | 91,4 | 91,3 | 91,1 | **−0,3** |
| KalPa | 93,0 | 92,9 | 92,7 | **−0,3** |
| Ässät | 89,5 | 89,4 | 89,2 | **−0,3** |
| Lukko | 105,0 | 104,9 | 104,7 | **−0,3** |
| K-Espoo | 93,8 | 93,7 | 93,5 | **−0,3** |
| TPS | 78,9 | 78,8 | 78,6 | **−0,3** |
| SaiPa | 98,3 | 98,2 | 98,0 | **−0,3** |
| JYP | 96,5 | 96,4 | 96,2 | **−0,3** |
| Tappara | 115,3 | 115,2 | 114,7 | **−0,6** |
| KooKoo | 107,2 | 106,7 | 106,6 | **−0,7** |
| Jokerit | 98,6 | 98,5 | 97,8 | **−0,8** |
| Pelicans | 89,3 | 88,6 | 88,5 | **−0,9** |

## Vaiheittain

### 15.9.2026 — Reconcile the roster with who has actually been dressing

Commit `dd120d5`, roster 509 → 526.

| joukkue | muutos | lisätty | poistettu |
|---|---:|---|---|
| Jukurit | +1,6 | Aleksandr Osipov, Alex Lintuniemi, Linus Sjödin, Natan Gashaw Teshome, Rasmus Baggström, Thomas Olsen | – |
| HPK | +0,4 | Gabriel Nitz, Ilari Mäkinen | – |
| HIFK | +0,3 | Frans Karjalahti, Linus Nässen, Ossi Sippola | – |
| K-Espoo | −0,1 | Juho Keinänen | – |
| TPS | −0,1 | Petteri Lindbohm | – |
| Ässät | −0,1 | Maxim Saarimäki | – |
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

