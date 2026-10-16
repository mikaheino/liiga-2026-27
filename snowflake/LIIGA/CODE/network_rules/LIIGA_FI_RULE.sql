-- Verkkosääntö: Snowflaken lähtevä liikenne vain liiga.fi:n rajapintaan.
-- Käyttäjät: integraatio LIIGA_FI_ACCESS (LIIGA_DAILY-notebook, LINEUP_FORECAST_<sha>).
-- Määritys luettu Snowflakesta (DESCRIBE NETWORK RULE) 16.10.2026; omistaja ACCOUNTADMIN.

USE ROLE ACCOUNTADMIN;

CREATE NETWORK RULE IF NOT EXISTS LIIGA.CODE.LIIGA_FI_RULE
  TYPE = HOST_PORT
  MODE = EGRESS
  VALUE_LIST = ('www.liiga.fi:443')
  COMMENT = 'liiga.fi API for the in-Snowflake ingest';
