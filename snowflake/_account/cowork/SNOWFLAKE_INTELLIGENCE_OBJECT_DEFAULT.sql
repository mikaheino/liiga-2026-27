-- CoWork-objekti. Kun se on olemassa, CoWorkissa näkyvät VAIN siihen lisätyt
-- agentit, joten tilin toinen tuotantoagentti VW_AGENT on mukana. Listan
-- näkeminen ei anna pääsyä agenttiin; se vaatii USAGEn (LIIGA_AGENT_USER).
--
-- Aja ACCOUNTADMINina: snow sql -c CONTAINER_SERVICES --role ACCOUNTADMIN -f snowflake/_account/cowork/SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT.sql
-- Idempotentti. Koko tilin järjestys: snowflake/_account/README.md.

USE ROLE ACCOUNTADMIN;

-- CoWork-objekti. Kun se on olemassa, CoWorkissa näkyvät VAIN siihen lisätyt
-- agentit, joten myös tilin toinen tuotantoagentti VW_AGENT lisätään, ettei se
-- katoa käyttäjiltään. DEV-agenttia ei lisätä: se aukeaa suoralla linkillä.
CREATE SNOWFLAKE INTELLIGENCE IF NOT EXISTS SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT;

ALTER SNOWFLAKE INTELLIGENCE SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT
  ADD AGENT SNOWFLAKE_INTELLIGENCE.AGENTS.LIIGA_ENNUSTAJA;

ALTER SNOWFLAKE INTELLIGENCE SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT
  ADD AGENT SNOWFLAKE_INTELLIGENCE.AGENTS.VW_AGENT;

-- Listan näkeminen ei anna pääsyä agenttiin; se vaatii USAGE:n agenttiin.
GRANT USAGE ON SNOWFLAKE INTELLIGENCE SNOWFLAKE_INTELLIGENCE_OBJECT_DEFAULT TO ROLE PUBLIC;
