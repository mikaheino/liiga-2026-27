# LIIGA.MODEL -näkymät

Yksi tiedosto per näkymä, julkaisujärjestys `_order.txt`:ssä:
`python scripts/deploy/deploy_views.py` (CI ajaa sen ennen semanttisia malleja).

Yhteiset säännöt (alkuperäinen otsikko, kausi_views.sql):

```sql
-- Näkymät semanttisille malleille LIIGA_KAUSI_SV (toteuma + mallin osuvuus)
-- ja LIIGA_ENNUSTAJA_SV (vyöhyketodennäköisyydet, kuluvan kauden ottelut).
--
-- Näkymiä, ei tauluja: notebook LIIGA_DAILY korvaa pohjataulut joka aamu
-- (CREATE OR REPLACE TABLE), ja näkymä nimellä viitattuna seuraa mukana.
-- Siksi mitään ei tarvitse ajastaa eikä mikään voi jäädä jälkeen.
--
-- Kaikki logiikka toistaa sovelluksen ja diojen laskennan (CLAUDE.md):
--   * sarjajärjestys pisteet -> maaliero -> tehdyt maalit (liiga.fi)
--   * ottelun ennuste = viimeisin snapshot ottelupäivänä tai ennen sitä
--     (sama ehto kuin streamlit_app.py, joten osumaprosentti täsmää)
--   * esikauden ennuste = viimeisin snapshot jossa games_played = 0
--   * RL0 (epäonnistunut rangaistuslaukaus) EI ole maali
--   * maalivahti: omat päästetyt vain yksin pelatuista otteluista
--
-- Aja: python scripts/deploy/deploy_views.py
-- (ACCOUNTADMIN omistaa pohjataulut -- sync luo ne sillä -- eikä SYSADMIN
-- saa luoda näkymiä LIIGA.MODELiin.)
-- (ei Scripting-lohkoja, joten -f toimii).
```
