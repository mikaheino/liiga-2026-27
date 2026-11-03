# Rosterimuutosten vaikutus aloituspisteisiin

*Generoitu: `python scripts/local/roster_impact.py` — älä muokkaa käsin.*

Esikauden ennuste (kaikki 544 ottelua, esikauden Elo) laskettuna jokaisella committoidulla rosteriversiolla. Kaikki muu pidetään samana, joten luvut kertovat pelkän rosterin vaikutuksen. Pisteiden summa on joka versiossa sama: kun joku vahvistuu, muut menettävät vähän, siksi muuttumattomillakin joukkueilla on pieni miinus.

Lähtötaso on **26.8.2026** (d454ecc), roster jolla kauden ensimmäinen ennuste tehtiin.

## Pisteet versioittain

| joukkue | 26.8.2026 | 15.9.2026 | 9.10.2026 | 16.10.2026 | 16.10.2026 | 25.10.2026 | 3.11.2026 | 3.11.2026 | muutos yhteensä |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| KalPa | 93,0 | 92,9 | 92,7 | 92,7 | 92,7 | 95,3 | 95,3 | 95,2 | **+2,2** |
| Jukurit | 70,9 | 72,5 | 73,2 | 73,2 | 73,2 | 73,1 | 73,0 | 73,0 | **+2,1** |
| Sport | 68,9 | 68,8 | 71,0 | 71,0 | 71,0 | 70,8 | 70,8 | 70,7 | **+1,8** |
| HIFK | 98,9 | 99,1 | 99,1 | 100,9 | 100,7 | 100,6 | 100,5 | 100,5 | **+1,6** |
| HPK | 86,1 | 86,5 | 86,8 | 86,8 | 86,8 | 87,4 | 87,3 | 87,3 | **+1,2** |
| KooKoo | 107,4 | 106,9 | 106,7 | 106,6 | 106,6 | 106,5 | 107,4 | 107,3 | **0,0** |
| Ässät | 89,3 | 89,3 | 89,1 | 89,1 | 89,1 | 89,0 | 88,9 | 88,9 | **−0,5** |
| Ilves | 103,9 | 103,8 | 103,6 | 103,6 | 103,6 | 103,5 | 103,4 | 103,3 | **−0,5** |
| SaiPa | 98,0 | 97,9 | 97,7 | 97,7 | 97,7 | 97,5 | 97,5 | 97,4 | **−0,6** |
| K-Espoo | 94,7 | 94,6 | 94,4 | 93,7 | 93,7 | 93,6 | 94,2 | 94,1 | **−0,6** |
| TPS | 78,7 | 78,6 | 78,4 | 78,4 | 78,4 | 78,3 | 78,2 | 78,2 | **−0,6** |
| Lukko | 105,0 | 104,9 | 104,7 | 104,6 | 104,7 | 104,5 | 104,5 | 104,4 | **−0,6** |
| Kärpät | 91,2 | 91,2 | 91,0 | 90,9 | 90,9 | 90,8 | 90,7 | 90,7 | **−0,6** |
| JYP | 96,5 | 96,4 | 96,2 | 96,1 | 96,1 | 96,0 | 95,9 | 95,9 | **−0,6** |
| Jokerit | 98,6 | 98,5 | 97,8 | 97,5 | 97,5 | 97,3 | 97,5 | 97,5 | **−1,1** |
| Pelicans | 89,4 | 88,8 | 88,6 | 88,5 | 88,5 | 88,4 | 88,4 | 88,3 | **−1,1** |
| Tappara | 115,6 | 115,5 | 115,0 | 114,9 | 114,9 | 113,5 | 112,5 | 113,4 | **−2,2** |

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
| Jukurit | 0,0 | Christoffer Sedoff | – |
| Pelicans | −0,1 | – | Onni Käyhkö |
| JYP | −0,1 | Atte Ohtamaa | – |
| Jokerit | −0,3 | – | Oliver Suni |
| K-Espoo | −0,7 | – | Tuomas Suoniemi |

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
| KalPa | +2,7 | Jonne Tammela, Kyle Crnkovic | – |
| HPK | +0,6 | Mattias Tedenby | – |
| Pelicans | −0,1 | Antti Tyrväinen | – |
| Tappara | −1,4 | – | Jonne Tammela |

*Rivit näytetään joukkueille joiden rosteri muuttui tai joiden pisteet liikkuivat vähintään 0,5.*

### 3.11.2026 — Rosteripäivitys: 25 pelaajaa (huhuareena + kokoonpanotäsmäytys)

Commit `f561c45`, roster 545 → 570.

| joukkue | muutos | lisätty | poistettu |
|---|---:|---|---|
| KooKoo | +0,9 | Alexander Ruuttu, Devante Stephens | – |
| K-Espoo | +0,6 | Atte Vikla, Tuomas Suoniemi | – |
| Jokerit | +0,2 | Andrew Lucas, Oliver Suni | – |
| Jukurit | 0,0 | Aapo Kurri, Bogdans Hodass | – |
| Lukko | 0,0 | Vili Pulakka | – |
| SaiPa | 0,0 | Olli Eloranta, Vojtech Hora | – |
| Kärpät | −0,1 | Niilo Hinno | – |
| Pelicans | −0,1 | Alvar Soisalo, Joakim Torvinen, Onni Käyhkö | – |
| HPK | −0,1 | Niklas Jussila, Oskari Kuusisto, Veikka Fagerström | – |
| JYP | −0,1 | Eetu Räisänen, Veeti Vilander | – |
| HIFK | −0,1 | Jori Lehterä, Vertti Saastamoinen | – |
| Tappara | −1,0 | Alex Mäkelä, Emil Järventie, Tommi Kivistö | – |

*Rivit näytetään joukkueille joiden rosteri muuttui tai joiden pisteet liikkuivat vähintään 0,5.*

### 3.11.2026 — Rosterista pois Mäkelä, Lindbohm ja Soini

Commit `1cc43da`, roster 570 → 567.

| joukkue | muutos | lisätty | poistettu |
|---|---:|---|---|
| Tappara | +0,9 | – | Alex Mäkelä |
| Jukurit | 0,0 | – | Sebastian Soini |
| TPS | −0,1 | – | Petteri Lindbohm |

*Rivit näytetään joukkueille joiden rosteri muuttui tai joiden pisteet liikkuivat vähintään 0,5.*

