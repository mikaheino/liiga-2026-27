-- Aamusynkan palvelukäyttäjä (launchd + sync_to_snowflake.py), avainpari.
-- Yhteys liiga_sync tiedostossa ~/.snowflake/connections.toml.
--
-- Aja ACCOUNTADMINina: snow sql -c CONTAINER_SERVICES --role ACCOUNTADMIN -f snowflake/_account/users/LIIGA_SYNC.sql
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
