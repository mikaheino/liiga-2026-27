-- Liiga Ennustaja -agentin roolit ja CoWork-näkyvyys (2026-10-16).
--
-- Miksi: koodinsuoritus (johtoryhmävisualisointi) perii agentin OMISTAJAROOLIN
-- oikeudet. Agentin omisti ACCOUNTADMIN, joten hiekkalaatikon koodi olisi
-- toiminut tilin laajimmilla oikeuksilla. Lisäksi agentilla ei ollut yhtään
-- käyttöoikeutta: vain ACCOUNTADMIN näki sen.
--
--   LIIGA_AGENT_OWNER  omistaa agentit; vain skillien luku + Cortex. Ei dataa.
--   LIIGA_AGENT_USER   demon käyttäjä: agentti, semanttiset mallit, niiden
--                      pohjadata (LIIGA.MODEL), varasto, CoWork-lista.
--
-- Työkalut (Cortex Analyst) ajetaan KUTSUJAN oikeuksin, joten data-oikeudet
-- kuuluvat käyttäjäroolille, eivät omistajalle.
--
-- FUTURE-oikeudet ovat pakollisia: LIIGA_DAILY-notebook ja sync luovat
-- MODEL-taulut uudelleen (CREATE OR REPLACE) joka aamu, ja
-- semantic_views.py --deploy luo semanttiset mallit uudelleen. Yksittäiset
-- oikeudet katoaisivat seuraavana yönä.
--
-- Aja: snow sql -c CONTAINER_SERVICES --role ACCOUNTADMIN -f snowflake/agent_roles.sql
-- Idempotentti (IF NOT EXISTS, GRANT toistuu ongelmitta).

USE ROLE ACCOUNTADMIN;

-- Roolit ja hierarkia: SYSADMIN (ja sitä kautta ACCOUNTADMIN) perii molemmat,
-- joten deploy-skriptit toimivat ACCOUNTADMINina kuten ennenkin.
CREATE ROLE IF NOT EXISTS LIIGA_AGENT_OWNER
  COMMENT = 'Omistaa Liiga Ennustaja -agentit. Rajattu: koodinsuoritus perii nämä oikeudet.';
CREATE ROLE IF NOT EXISTS LIIGA_AGENT_USER
  COMMENT = 'Liiga Ennustaja -agentin käyttäjä (CoWork-demo).';
GRANT ROLE LIIGA_AGENT_OWNER TO ROLE SYSADMIN;
GRANT ROLE LIIGA_AGENT_USER TO ROLE SYSADMIN;
GRANT ROLE LIIGA_AGENT_USER TO USER MHEINO;

-- Omistaja: agenttiskeema, skillien stage ja Cortex.
GRANT USAGE ON DATABASE SNOWFLAKE_INTELLIGENCE TO ROLE LIIGA_AGENT_OWNER;
GRANT USAGE ON SCHEMA SNOWFLAKE_INTELLIGENCE.AGENTS TO ROLE LIIGA_AGENT_OWNER;
GRANT USAGE ON DATABASE LIIGA TO ROLE LIIGA_AGENT_OWNER;
GRANT USAGE ON SCHEMA LIIGA.CODE TO ROLE LIIGA_AGENT_OWNER;
GRANT READ ON STAGE LIIGA.CODE.AGENT_SKILLS TO ROLE LIIGA_AGENT_OWNER;
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE LIIGA_AGENT_OWNER;

-- Käyttäjä: agentin löytäminen ja käyttö.
GRANT USAGE ON DATABASE SNOWFLAKE_INTELLIGENCE TO ROLE LIIGA_AGENT_USER;
GRANT USAGE ON SCHEMA SNOWFLAKE_INTELLIGENCE.AGENTS TO ROLE LIIGA_AGENT_USER;
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE LIIGA_AGENT_USER;

-- Käyttäjä: semanttiset mallit ja niiden pohjadata, nykyiset ja tulevat.
GRANT USAGE ON DATABASE LIIGA TO ROLE LIIGA_AGENT_USER;
GRANT USAGE ON SCHEMA LIIGA.MODEL TO ROLE LIIGA_AGENT_USER;
GRANT SELECT ON ALL TABLES IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_AGENT_USER;
GRANT SELECT ON ALL VIEWS IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_AGENT_USER;
GRANT SELECT ON ALL SEMANTIC VIEWS IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_AGENT_USER;
GRANT SELECT ON FUTURE TABLES IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_AGENT_USER;
GRANT SELECT ON FUTURE VIEWS IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_AGENT_USER;
GRANT SELECT ON FUTURE SEMANTIC VIEWS IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_AGENT_USER;

-- Käyttäjä: varastot. DOCKER_WH on agentin nykyinen työkaluvarasto,
-- LIIGA_WH projektin oma (siirto sinne on kohdassa 4).
GRANT USAGE ON WAREHOUSE DOCKER_WH TO ROLE LIIGA_AGENT_USER;
GRANT USAGE ON WAREHOUSE LIIGA_WH TO ROLE LIIGA_AGENT_USER;

-- Agenttien omistajuus. COPY CURRENT GRANTS säilyttää olemassa olevat oikeudet.
GRANT OWNERSHIP ON AGENT SNOWFLAKE_INTELLIGENCE.AGENTS.LIIGA_ENNUSTAJA
  TO ROLE LIIGA_AGENT_OWNER COPY CURRENT GRANTS;
-- (LIIGA_ENNUSTAJA_DEV poistettu 16.10.: kehitys on nyt versioita aliaksella DEV.)
GRANT USAGE ON AGENT SNOWFLAKE_INTELLIGENCE.AGENTS.LIIGA_ENNUSTAJA TO ROLE LIIGA_AGENT_USER;

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
