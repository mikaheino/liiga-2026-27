-- Agentin omat työkalut ja aamutiedote (2026-10-16).
--
--   SIMULATE_SCENARIO_<sha>  mitä jos? -simulaattori, agentin työkalu liiga_skenaario
--                            (snowflake/procedures/simulate_scenario.py)
--   SEND_MORNING_BRIEF       ajaa agentin ja lähettää vastauksen sähköpostina
--   LIIGA_EMAIL              sähköposti-integraatio, vain sallitut vastaanottajat
--
-- Proseduurit omistaa LIIGA_DEPLOYER ja ne ajetaan omistajan oikeuksin: käyttäjä
-- (LIIGA_AGENT_USER) tarvitsee vain USAGEn proseduuriin, ei lukuoikeutta tauluihin
-- joita simulaatio lukee. Pinned-nimi (git-commit) samasta syystä kuin
-- semanttisilla malleilla: agenttiversio viittaa nimeen.
--
-- Aja kerran ACCOUNTADMINina:
--   snow sql -c CONTAINER_SERVICES --role ACCOUNTADMIN -f snowflake/agent_tools.sql

USE ROLE ACCOUNTADMIN;

GRANT CREATE PROCEDURE ON SCHEMA LIIGA.MODEL TO ROLE LIIGA_DEPLOYER;
GRANT CREATE TASK ON SCHEMA LIIGA.MODEL TO ROLE LIIGA_DEPLOYER;
GRANT USAGE ON FUTURE PROCEDURES IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_AGENT_USER;
GRANT USAGE ON FUTURE PROCEDURES IN SCHEMA LIIGA.MODEL TO ROLE LIIGA_AGENT_OWNER;

CREATE NOTIFICATION INTEGRATION IF NOT EXISTS LIIGA_EMAIL
  TYPE = EMAIL
  ENABLED = TRUE
  ALLOWED_RECIPIENTS = ('mika.heino@recordlydata.com')
  COMMENT = 'Liiga Ennustaja: aamutiedote. Vain sallitut vastaanottajat.';
GRANT USAGE ON INTEGRATION LIIGA_EMAIL TO ROLE LIIGA_DEPLOYER;

-- SYSTEM$SEND_EMAIL lähettää vain tilin käyttäjien VAHVISTETTUIHIN osoitteisiin.
DESC USER MHEINO;

-- Pelipäivän kokoonpanot (LINEUP_FORECAST_<sha>) hakevat liiga.fi:stä samalla
-- integraatiolla kuin LIIGA_DAILY-notebook (lisätty 16.10. illalla).
GRANT USAGE ON INTEGRATION LIIGA_FI_ACCESS TO ROLE LIIGA_DEPLOYER;
