-- Sovelluksen (LIIGA_ENNUSTE, App Runtime) kapea ajorooli (6.11.2026,
-- docs/claude/skenaario.md, käyttäjän päätös 3).
--
-- Miksi: palvelu ajaa kyselynsä ja agenttikutsunsa omistajaroolinsa oikeuksin.
-- Omistaja oli LIIGA_DEPLOYER, jolla on luonti- ja kirjoitusoikeudet koko
-- projektiin, ja tuotantoagentilla on code_execution (ainoa lievennys
-- permission_policy always_ask). Sovelluksen kautta tuleva agenttikutsu näki siis
-- kaiken, mitä julkaisurooli näkee. Tämä rooli saa vain sen, mitä sovellus tekee:
-- lukee LIIGA.MODELia, kirjoittaa korttivastauksia (KORTTI_VASTAUS), kutsuu
-- agenttia ja skenaarioproseduuria.
--
-- LIIGA_DEPLOYER saa tämän roolin (hierarkia): CI voi julkaista palvelun ja
-- siirtää sen omistuksen tälle roolille, mutta tämä rooli ei saa julkaisuoikeuksia.
--
-- Aja ACCOUNTADMINina: snow sql -c CONTAINER_SERVICES --role ACCOUNTADMIN -f snowflake/_account/roles/LIIGA_APP.sql
-- Idempotentti. Koko tilin järjestys: snowflake/_account/README.md.

USE ROLE ACCOUNTADMIN;

CREATE ROLE IF NOT EXISTS LIIGA_APP
  COMMENT = 'Liiga Ennuste -sovelluksen ajorooli: lukee LIIGA.MODELia, kirjoittaa korttivastauksia, kutsuu agenttia.';

GRANT ROLE LIIGA_APP TO ROLE LIIGA_DEPLOYER;

GRANT ROLE LIIGA_APP TO ROLE SYSADMIN;

-- Data: vain luku, nykyiset ja tulevat (notebook ja synkka luovat taulut uudelleen).
GRANT USAGE ON DATABASE LIIGA TO ROLE LIIGA_APP;

GRANT USAGE ON SCHEMA LIIGA.MODEL TO ROLE LIIGA_APP;

GRANT USAGE ON SCHEMA LIIGA.CODE TO ROLE LIIGA_APP;

GRANT SELECT ON ALL TABLES IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_APP;

GRANT SELECT ON ALL VIEWS IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_APP;

GRANT SELECT ON ALL SEMANTIC VIEWS IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_APP;

GRANT SELECT ON FUTURE TABLES IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_APP;

GRANT SELECT ON FUTURE VIEWS IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_APP;

GRANT SELECT ON FUTURE SEMANTIC VIEWS IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_APP;

-- Ainoa kirjoitus: kohteisiin sidotut agenttivastaukset (lib/kortti.ts).
GRANT INSERT, UPDATE ON TABLE LIIGA.MODEL.KORTTI_VASTAUS TO ROLE LIIGA_APP;

-- Skenaarioproseduuri (joukkuesivun paneeli) ja agentin työkalut.
GRANT USAGE ON ALL PROCEDURES IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_APP;

GRANT USAGE ON FUTURE PROCEDURES IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_APP;

GRANT USAGE ON ALL CORTEX SEARCH SERVICES IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_APP;

GRANT USAGE ON FUTURE CORTEX SEARCH SERVICES IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_APP;

-- Agentti.
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE LIIGA_APP;

GRANT USAGE ON DATABASE SNOWFLAKE_INTELLIGENCE TO ROLE LIIGA_APP;

GRANT USAGE ON SCHEMA SNOWFLAKE_INTELLIGENCE.AGENTS TO ROLE LIIGA_APP;

GRANT USAGE ON AGENT SNOWFLAKE_INTELLIGENCE.AGENTS.LIIGA_ENNUSTAJA TO ROLE LIIGA_APP;

GRANT USAGE ON WAREHOUSE LIIGA_WH TO ROLE LIIGA_APP;
