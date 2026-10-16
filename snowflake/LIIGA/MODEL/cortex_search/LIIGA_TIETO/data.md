# Data, lähteet ja päivitykset

Tämä tiedosto on agentin tietopankkia (`liiga_tieto`).

## Lähteet

- **Ottelut ja tulokset:** liiga.fi:n avoin rajapinta (ottelukohtainen päätepiste):
  tulos, maalit, syötöt, maalipaikat (xG), erät, kokoonpanot, maalivahdit,
  rangaistukset ja tuomarit. Kaudet 2021-22 - 2026-27.
- **Sarjataulukko:** liiga.fi:n järjestys -- pisteet, sitten maaliero, sitten
  tehdyt maalit. Ottelumäärä ei vaikuta järjestykseen.
- **Rosterit:** esikauden siirtoartikkelin sopimuslistat, päivitetty siirroilla
  ja kauden aikana pelattujen otteluiden kokoonpanoilla. Vaikutus ennusteeseen
  kirjataan jokaisesta rosterierästä erikseen.
- **Ulkomaiset ja Mestis-tilastot:** pelaajien muiden sarjojen kaudet koottu
  käsin (hockeydb, Wikipedia, mestis.fi) ja muunnettu Liiga-tasolle
  sarjakertoimilla.
- **Maalivahtien torjunnat:** maalivahtien uratilastot muista sarjoista ja
  Liigasta, koottu käsin.
- **Yleisöarvio:** 40 Jatkoaika.comin keskustelijan esikauden lopputaulukko.

## Päivitysaikataulu

- Snowflake tarkistaa joka aamu klo 5.00 (Suomen aikaa), onko jokin ottelu
  alkanut yli 8 tuntia sitten ja yhä hakematta. Jos on, ennuste ajetaan
  uudelleen: tulokset haetaan, Elo päivittyy ja loput ottelut simuloidaan.
  Myöhäisimmät ottelut alkavat klo 20.30, joten ne ovat haettavissa klo 4.30.
- Ennusteen päivityspäivä näkyy agentin vastauksissa ("Ennuste päivitetty").
- Jokaisen pelaamattoman ottelun todennäköisyydet tallennetaan joka aamu ennen
  ottelua, joten mallin osuvuus mitataan aina ennusteella, joka oli olemassa
  ennen ottelun alkua -- ei jälkikäteen.
- Esikauden ennuste (julkaistu 1.9.2026) on jäädytetty vertailukohdaksi.

## Siirretyt ja perutut ottelut

Siirretyt ottelut päivitetään otteluohjelmaan uusille päivilleen. Peruttu
ottelu ilman uutta päivää pysyy ohjelmassa vanhalla päivällään ja simuloidaan
normaalisti, kunnes uusi päivä julkaistaan.

## Snowflake-toteutus

Kaikki data on Snowflakessa (LIIGA.RAW lähdedata, LIIGA.MODEL johdetut
taulut). Agentti käyttää kahta semanttista mallia (ennuste; kausi ja toteuma),
kahta proseduuria (skenaariosimulaattori; pelipäivän kokoonpanot) ja tätä
tietopankkia. Agentti julkaistaan GitHubista: jokainen versio evaluoidaan
33 kysymyksen testijoukolla ennen kuin se hyväksytään tuotantoon.
