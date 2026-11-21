-- LIIGA.EVALS -skeema evaluoinneille (Cortex Agent Evaluations).
--
-- Aja ACCOUNTADMINina: snow sql -c futurice --role ACCOUNTADMIN -f snowflake/LIIGA/EVALS/_schema.sql
-- Idempotentti. Koko tilin järjestys: snowflake/_account/README.md.

USE ROLE ACCOUNTADMIN;

-- Evaluoinnit.
CREATE SCHEMA IF NOT EXISTS LIIGA.EVALS;
