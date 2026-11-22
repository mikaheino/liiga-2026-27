-- Aamusynkan palvelukäyttäjä (launchd + sync_to_snowflake.py), avainpari.
-- POISTETTAVA (22.11.2026): aamusynkka on korvattu (src/liiga/curated.py, recompute.yml), control planen
-- liiga-paivitys on pois päältä ja taulujen omistaja on LIIGA_ADMIN. Poistetaan aikaisintaan 29.11.2026,
-- kun LIIGA_DAILY_RUN ja recompute.yml ovat olleet viikon puhtaita: DROP USER LIIGA_SYNC (ja LIIGA_LOADER).
-- Yhteys liiga_sync tiedostossa ~/.snowflake/connections.toml.
--
-- Aja ACCOUNTADMINina: snow sql -c futurice --role ACCOUNTADMIN -f snowflake/_account/users/LIIGA_SYNC.sql
-- Idempotentti. Koko tilin järjestys: snowflake/_account/README.md.

USE ROLE ACCOUNTADMIN;

-- EI raw_gamesia: LIIGA_DAILY-notebook (omistaja ACCOUNTADMIN) luo sen uudelleen,
-- jolloin omistajuus palaisi ACCOUNTADMINille ja seuraava synkka kaatuisi.
-- Otteluohjelman siirrot (harvinaisia) viedään ACCOUNTADMINina, ks. CLAUDE.md.

CREATE USER IF NOT EXISTS LIIGA_SYNC
  TYPE = SERVICE
  DEFAULT_ROLE = LIIGA_LOADER
  DEFAULT_WAREHOUSE = LIIGA_WH
  COMMENT = 'Liiga: paikallisen ajon aamusynkka (launchd). Avainparitunnistus.';

GRANT ROLE LIIGA_LOADER TO USER LIIGA_SYNC;
