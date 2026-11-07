-- Uutisjutut (7.11.2026): LIIGA_DAILY lisää uudet joka ajossa (src/liiga/news_ingest.py).
-- Käyttäjän päätös 7.11.: otsikot ja ingressit saavat olla Snowflakessa ja agentti saa nähdä
-- ne. Koko artikkelia ei tallenneta (ingressistä 400 merkkiä). Aikaleimat ISO-tekstinä kuten
-- GitHubin news_items.csv:ssä. Luodaan valmiiksi, jotta MODEL-näkymä voidaan julkaista
-- ennen ensimmäistä ajoa. Omistaja ACCOUNTADMIN kuten muutkin notebookin RAW-taulut.

USE ROLE ACCOUNTADMIN;

CREATE TABLE IF NOT EXISTS LIIGA.RAW.NEWS_ITEMS (
  FETCHED_AT VARCHAR, PUBLISHED VARCHAR, SOURCE VARCHAR, TEAM VARCHAR,
  FLAGS VARCHAR, TITLE VARCHAR, URL VARCHAR, SUMMARY VARCHAR
) COMMENT = 'Liigan uutiset (Yle, seurat): otsikko, ingressin alku, joukkue, liput. LIIGA_DAILY.';
