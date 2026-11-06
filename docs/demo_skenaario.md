# Demo: skenaariotyökalu kolmessa ympäristössä (3 min)

J1-demo (docs/claude/skenaario.md). **Yhtään lukua ei kirjoiteta käsin:** aja demopäivänä
`.venv/bin/python scripts/dev/demo_numbers.py` ja käytä sen lukuja (alla 6.11.2026 ajo
esimerkkinä). Snowflaken luvut voivat erota, jos sen ennuste on eri päivältä; näkymä
kertoo perustan ("ennuste 6.11.").

Ennen esitystä: STAGING tai tuotanto lämpimäksi (avaa sovellus 10 min ennen; kylmäkäynnistys
voi kestää minuutteja), puhelimella Pages auki, paikallinen `npm run dev` käynnissä.

## 1. Puhelin, Pages: sama moottori ilman agenttia (40 s)

- Etusivu → **Seuraava kierros**. Ottelun alla panosrivi, esim.
  *"Panos · Kärpät kuuden joukkoon 40 % ↔ 27 %"* (14.11. Kärpät–Tappara).
- Napauta ottelua → ottelukortin **Panos**: kotivoitto / jatkoaika / vierasvoitto ja sivulliset.
- Viesti: *luvut lasketaan samoista 10 000 simuloidusta kaudesta kuin ennuste. Puhelimessa ei
  ole agenttia eikä palvelinta, kaikki on laskettu valmiiksi.*

## 2. Snowflake-sovellus: agentti kohteessa, Jälki näkyvissä (50 s)

- Sama ottelukortti sovelluksessa → **Lukitse omaan skenaarioon: Kärpät voittaa** → etusivun
  **Oma skenaario**: siru, uskottavuus ja liikkuneet joukkueet.
- Joukkuesivu (esim. KooKoo) → **Mitä vaaditaan** → "Entä jos voittaa seuraavat 5".
- Ottelukortin agentti: kysy *"Miksi tämä ottelu ratkaisee Kärpille?"* → avaa **Jälki**:
  työkalut, SQL ja agentin versio. Viesti: *agentti selittää, moottori laskee.*

## 3. Kuvaile omin sanoin (50 s)

- **Oma skenaario** -kenttään: *"HPK häviää kaikki ottelunsa joulun yli ja Jokerit voittaa
  seuraavat kolme"* → 8 sirua (6.11.: HPK putoaa 31,8 → 60,7 %, Jokerit 52,3 → 25,1 %,
  uskottavuus 0,4 %).
- Poista Jokerien voittojen sirut → luku päivittyy heti ilman agenttia (6.11.: HPK 55,4 %,
  Jokerit 41,3 %).
- Viesti: *agentti hoitaa vain kielen; sirut ovat moottorin tunnisteita, lausetta ei
  tallenneta.*

## 4. Paikallinen = Snowflake (20 s)

- Sama lause paikallisessa sovelluksessa (Claude + MCP) → samat sirut ja sama luku, Jälki
  näyttää saman työkalunimen `liiga_skenaario`. Viesti: *kolme kuorta, yksi moottori; vain
  agentti vaihtuu.*

## Varmistus ennen demoa

- `scripts/dev/demo_numbers.py` ajettu ja luvut päivitetty tähän.
- `scripts/dev/scenario_eval.py` paikallisesti läpi (17 + 7).
- Snowflake: `CALL LIIGA.MODEL.SIMULATE_SCENARIO_<sha>('[{"stakes":{"days":14}}]','json')` palauttaa panokset.
- Havainnot kirjattu `docs/claude/app.md`:hen.
