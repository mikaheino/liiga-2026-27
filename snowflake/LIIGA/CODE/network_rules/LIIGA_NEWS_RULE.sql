-- Verkkosääntö uutislähteille (7.11.2026): LIIGA_DAILY hakee uutiset samassa ajossa kuin
-- liiga.fi:n datan (src/liiga/news_ingest.py). Samat lähteet kuin src/liiga/news_collect.py
-- SOURCES: Ylen SM-liiga-syöte ja seurojen sivut, joiden robots.txt ei kiellä tekoälyä.
-- Uusi lähde = lisää tänne ja SOURCESiin. Omistaja ACCOUNTADMIN (aja Snowsightissa).

USE ROLE ACCOUNTADMIN;

CREATE OR REPLACE NETWORK RULE LIIGA.CODE.LIIGA_NEWS_RULE
  TYPE = HOST_PORT
  MODE = EGRESS
  VALUE_LIST = ('yle.fi:443', 'hifk.fi:443', 'hpk.fi:443', 'www.ilves.com:443',
                'www.jypliiga.fi:443', 'kiekko-espoo.fi:443', 'www.kookoo.fi:443',
                'www.raumanlukko.fi:443', 'vaasansport.fi:443', 'assat.com:443',
                'www.karpat.fi:443', 'saipa.fi:443', 'jukurit.fi:443')
  COMMENT = 'Liigan uutislähteet (Yle, seurat) LIIGA_DAILY-ajolle';
