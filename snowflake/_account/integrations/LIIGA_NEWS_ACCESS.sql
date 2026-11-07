-- Ulkoinen pääsy uutislähteisiin (7.11.2026). Käyttäjä: LIIGA_DAILY-notebook, joka hakee
-- uutiset samassa ajossa kuin liiga.fi:n datan. Vain verkkosääntö LIIGA.CODE.LIIGA_NEWS_RULE.
-- Aja Snowsightissa ACCOUNTADMINina tämän järjestyksessä:
--   1. snowflake/LIIGA/CODE/network_rules/LIIGA_NEWS_RULE.sql
--   2. snowflake/LIIGA/RAW/tables/NEWS_ITEMS.sql
--   3. tämä tiedosto (integraatio + notebookin pääsy)

USE ROLE ACCOUNTADMIN;

CREATE EXTERNAL ACCESS INTEGRATION IF NOT EXISTS LIIGA_NEWS_ACCESS
  ALLOWED_NETWORK_RULES = (LIIGA.CODE.LIIGA_NEWS_RULE)
  ENABLED = TRUE
  COMMENT = 'Liigan uutislähteet (Yle, seurat)';

-- Notebook tarvitsee molemmat: liiga.fi ja uutislähteet.
ALTER NOTEBOOK LIIGA.CODE.LIIGA_DAILY SET EXTERNAL_ACCESS_INTEGRATIONS = (LIIGA_FI_ACCESS, LIIGA_NEWS_ACCESS);
