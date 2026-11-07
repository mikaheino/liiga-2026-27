-- Uutiset sovellukselle ja agentille (7.11.2026, käyttäjä: uutiset "saa nähdä ja päivittyä
-- samalla kun haetaan uudet data liiga pistää"). LIIGA_APP näkee MODELin näkymät.
-- published_at: julkaisuaika (RSS) tai haun aika, jos lähde ei kerro (seurojen HTML-listat).
CREATE OR REPLACE VIEW LIIGA.MODEL.V_NEWS_ITEMS
  COMMENT = 'Liigan uutiset: julkaisuaika, lähde, joukkue, liput (loukkaantuminen, siirto, ...), otsikko, ingressin alku, linkki.'
AS
SELECT COALESCE(TRY_TO_TIMESTAMP_TZ(NULLIF(published, '')), TRY_TO_TIMESTAMP_TZ(fetched_at)) AS published_at,
       source, team, flags, title, summary, url
FROM LIIGA.RAW.NEWS_ITEMS;
