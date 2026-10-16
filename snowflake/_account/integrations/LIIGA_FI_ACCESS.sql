-- Ulkoinen pääsy liiga.fi:hin: LIIGA_DAILY-notebook (tulokset) ja proseduuri
-- LINEUP_FORECAST_<sha> (pelipäivän kokoonpanot). Vain verkkosääntö
-- LIIGA.CODE.LIIGA_FI_RULE (www.liiga.fi:443).
-- Määritys luettu Snowflakesta (DESCRIBE INTEGRATION) 16.10.2026. Julkaisuroolin
-- käyttöoikeus on roles/LIIGA_DEPLOYER.sql:ssä.

USE ROLE ACCOUNTADMIN;

CREATE EXTERNAL ACCESS INTEGRATION IF NOT EXISTS LIIGA_FI_ACCESS
  ALLOWED_NETWORK_RULES = (LIIGA.CODE.LIIGA_FI_RULE)
  ENABLED = TRUE
  COMMENT = 'Narrow egress to liiga.fi only';
