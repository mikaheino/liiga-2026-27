-- LIIGA.MEDIA: muiden medioiden otsikot ja linkit ihmisen luettaviksi (21.11.2026).
-- EI TEKOÄLYLLE: Ilta-Sanomat, Iltalehti ja MTV Uutiset kieltävät tekoälykäytön robots.txt:ssä.
-- Älä anna tätä skeemaa LIIGA_AGENT_OWNER-, LIIGA_AGENT_USER- tai LIIGA_DEPLOYER-rooleille, äläkä vie
-- sitä uutissignaaleihin, semanttisiin malleihin, Cortex Searchiin tai agentin työkaluihin.
-- Aja ACCOUNTADMINina (ylläpitoyhteys futurice). Proseduurin koodi stagelta: ks. alla PUT.
USE ROLE ACCOUNTADMIN;
CREATE NETWORK RULE IF NOT EXISTS LIIGA.CODE.LIIGA_MEDIA_RULE
  TYPE = HOST_PORT MODE = EGRESS
  VALUE_LIST = ('www.is.fi:443', 'www.iltalehti.fi:443', 'api.mtvuutiset.fi:443')
  COMMENT = 'Muut mediat: vain RSS-syötteet (otsikot ja linkit), ei tekoälylle';
CREATE EXTERNAL ACCESS INTEGRATION IF NOT EXISTS LIIGA_MEDIA_ACCESS
  ALLOWED_NETWORK_RULES = (LIIGA.CODE.LIIGA_MEDIA_RULE) ENABLED = TRUE
  COMMENT = 'LIIGA.MEDIA.COLLECT_MEDIA: IS, IL, MTV RSS';
GRANT USAGE ON INTEGRATION LIIGA_MEDIA_ACCESS TO ROLE LIIGA_ADMIN;

USE ROLE LIIGA_ADMIN;
CREATE SCHEMA IF NOT EXISTS LIIGA.MEDIA COMMENT = 'Muiden medioiden otsikot ja linkit ihmiselle. EI TEKOÄLYLLE (julkaisijoiden AI-kielto).';
CREATE TABLE IF NOT EXISTS LIIGA.MEDIA.MEDIA_LINKS (
  fetched_at TIMESTAMP_TZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  published  TIMESTAMP_TZ,
  source     STRING NOT NULL,
  team       STRING COMMENT 'Joukkueet avainsanoista, pilkuin',
  title      STRING NOT NULL,
  url        STRING NOT NULL
) COMMENT = 'Vain otsikko ja linkki, ei artikkelitekstiä. EI TEKOÄLYLLE.';
CREATE STAGE IF NOT EXISTS LIIGA.MEDIA.CODE;
-- PUT file://snowflake/LIIGA/MEDIA/procedures/COLLECT_MEDIA/collect_media.py @LIIGA.MEDIA.CODE AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
CREATE OR REPLACE PROCEDURE LIIGA.MEDIA.COLLECT_MEDIA()
  RETURNS VARIANT LANGUAGE PYTHON RUNTIME_VERSION = '3.11'
  PACKAGES = ('snowflake-snowpark-python', 'requests')
  IMPORTS = ('@LIIGA.MEDIA.CODE/collect_media.py') HANDLER = 'collect_media.run'
  EXTERNAL_ACCESS_INTEGRATIONS = (LIIGA_MEDIA_ACCESS)
  COMMENT = 'Muut mediat: IS, IL, MTV Liiga-otsikot ja linkit. Kutsuja: control plane (liiga-mediat).'
  EXECUTE AS OWNER;

-- Sovellus lukee (Mediat-sivu). Vain tämä rooli.
GRANT USAGE ON SCHEMA LIIGA.MEDIA TO ROLE LIIGA_APP;
GRANT SELECT ON TABLE LIIGA.MEDIA.MEDIA_LINKS TO ROLE LIIGA_APP;
