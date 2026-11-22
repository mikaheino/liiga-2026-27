-- LIIGA.MEDIA: muiden medioiden otsikot ja linkit (21.11.2026).
-- TEKOÄLYKÄYTTÖ SALLITTU 22.11.2026: Mika Heino ilmoitti luvan (Ilta-Sanomat, Iltalehti, MTV Uutiset;
-- laajuus otsikot ja linkit). Julkaisijoiden robots.txt kieltää yhä tekoälyrobotit, joten keräys pysyy
-- pelkkänä syötteenlukijana: ei artikkelitekstiä eikä ingressiä. Lupa koskee vain otsikoita ja linkkejä.
-- Ontologia: MEDIA_EVENTS (pelaajat, valmentajat, tapahtumatyyppi) -> agentin haku LIIGA_MEDIA_SEARCH.
-- Aja ACCOUNTADMINina (ylläpitoyhteys futurice). Proseduurin koodi stagelta: ks. alla PUT.
USE ROLE ACCOUNTADMIN;
CREATE NETWORK RULE IF NOT EXISTS LIIGA.CODE.LIIGA_MEDIA_RULE
  TYPE = HOST_PORT MODE = EGRESS
  VALUE_LIST = ('www.is.fi:443', 'www.iltalehti.fi:443', 'api.mtvuutiset.fi:443')
  COMMENT = 'Muut mediat: vain RSS-syötteet (otsikot ja linkit)';
CREATE EXTERNAL ACCESS INTEGRATION IF NOT EXISTS LIIGA_MEDIA_ACCESS
  ALLOWED_NETWORK_RULES = (LIIGA.CODE.LIIGA_MEDIA_RULE) ENABLED = TRUE
  COMMENT = 'LIIGA.MEDIA.COLLECT_MEDIA: IS, IL, MTV RSS';
GRANT USAGE ON INTEGRATION LIIGA_MEDIA_ACCESS TO ROLE LIIGA_ADMIN;

USE ROLE LIIGA_ADMIN;
CREATE SCHEMA IF NOT EXISTS LIIGA.MEDIA;
ALTER SCHEMA LIIGA.MEDIA SET COMMENT = 'Muiden medioiden Liiga-otsikot ja linkit sekä niistä poimitut tapahtumat (lupa tekoälykäyttöön 22.11.2026, vain otsikot).';
CREATE TABLE IF NOT EXISTS LIIGA.MEDIA.MEDIA_LINKS (
  fetched_at TIMESTAMP_TZ NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  published  TIMESTAMP_TZ,
  source     STRING NOT NULL,
  team       STRING COMMENT 'Joukkueet avainsanoista, pilkuin',
  title      STRING NOT NULL,
  url        STRING NOT NULL
) COMMENT = 'Vain otsikko ja linkki, ei artikkelitekstiä.';
ALTER TABLE LIIGA.MEDIA.MEDIA_LINKS SET COMMENT = 'Liiga-uutisotsikot ja linkit (IS, IL, MTV). Vain otsikko ja linkki, ei artikkelitekstiä.';

-- Ontologia: yksi rivi per otsikko. Pelaajat ja valmentajat AI_EXTRACTilla, tyyppi AI_CLASSIFYlla,
-- pelaajat liitetään rosteriin (player_ids), joukkueet tulevat avainsanoista (MEDIA_LINKS.team).
CREATE TABLE IF NOT EXISTS LIIGA.MEDIA.MEDIA_EVENTS (
  url          STRING NOT NULL COMMENT 'MEDIA_LINKS.url',
  published    TIMESTAMP_TZ,
  source       STRING,
  title        STRING,
  teams        STRING  COMMENT 'Liigajoukkueet pilkuin (RAW_GAMES-nimet)',
  players      ARRAY   COMMENT 'Otsikossa mainitut pelaajat (AI_EXTRACT)',
  player_ids   ARRAY   COMMENT 'Rosteriin täsmäävät pelaajat: RAW.ROSTER_2026_27.player_id',
  coaches      ARRAY   COMMENT 'Valmentajat ja urheilujohtajat (AI_EXTRACT)',
  event_type   STRING  COMMENT 'suspension | injury | transfer | coaching | game result | crisis | off-ice | other (AI_CLASSIFY)',
  extracted_at TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP()
) COMMENT = 'Liiga-uutisten tapahtumat: kuka (joukkue, pelaaja, valmentaja) ja mitä (pelikielto, loukkaantuminen, siirto, valmentajamuutos, tulos, kriisi). Lähde: otsikot, linkki aina mukana.';

CREATE OR REPLACE PROCEDURE LIIGA.MEDIA.EXTRACT_MEDIA_EVENTS()
  RETURNS VARIANT LANGUAGE SQL
  COMMENT = 'Uudet otsikot -> MEDIA_EVENTS (vain poimimattomat, joten kulu on vain uusista). Kutsuja: control plane (liiga-mediat).'
  EXECUTE AS OWNER
AS
$$
DECLARE
  n INTEGER;
BEGIN
  INSERT INTO LIIGA.MEDIA.MEDIA_EVENTS (url, published, source, title, teams, players, coaches, event_type)
  WITH uudet AS (
    SELECT l.* FROM LIIGA.MEDIA.MEDIA_LINKS l
     WHERE NOT EXISTS (SELECT 1 FROM LIIGA.MEDIA.MEDIA_EVENTS e WHERE e.url = l.url)
    QUALIFY ROW_NUMBER() OVER (PARTITION BY l.url ORDER BY l.fetched_at) = 1
  ), x AS (
    SELECT u.*,
           AI_EXTRACT(text => u.title, responseFormat => {'schema': {'type': 'object', 'properties': {
             'players': {'description': 'Names of ice hockey players mentioned (full names as written)', 'type': 'array'},
             'coaches': {'description': 'Names of coaches or sports directors mentioned', 'type': 'array'}}}}):response AS r,
           AI_CLASSIFY(u.title, ['suspension', 'injury', 'transfer', 'coaching', 'game result', 'crisis', 'off-ice', 'other'],
             {'task_description': 'Classify a Finnish ice hockey (SM-liiga) news headline by event type'}):labels[0]::STRING AS et
      FROM uudet u
  )
  SELECT url, published, source, title, team, COALESCE(r:players::ARRAY, []), COALESCE(r:coaches::ARRAY, []), et FROM x;
  n := SQLROWCOUNT;

  -- Valmentaja ei ole pelaaja: nimi, joka on jossain otsikossa valmentaja tai COACHING_CHANGESissa,
  -- siirretään players -> coaches (AI_EXTRACT sekoittaa ne, kun otsikossa ei ole roolia).
  UPDATE LIIGA.MEDIA.MEDIA_EVENTS e
     SET coaches = ARRAY_DISTINCT(ARRAY_CAT(e.coaches, ARRAY_INTERSECTION(e.players, k.names))),
         players = ARRAY_EXCEPT(e.players, k.names)
    FROM (SELECT ARRAY_UNIQUE_AGG(nm) AS names FROM (
            SELECT f.value::STRING AS nm FROM LIIGA.MEDIA.MEDIA_EVENTS, LATERAL FLATTEN(coaches) f
            UNION SELECT coach_in FROM LIIGA.RAW.COACHING_CHANGES
            UNION SELECT coach_out FROM LIIGA.RAW.COACHING_CHANGES) WHERE nm IS NOT NULL) k
   WHERE ARRAY_SIZE(ARRAY_INTERSECTION(e.players, k.names)) > 0;

  -- Pelaajat rosteriin (nimi = etunimi + sukunimi). Täsmäämättömät jäävät NULLiksi ja yritetään uudelleen.
  UPDATE LIIGA.MEDIA.MEDIA_EVENTS e SET player_ids = m.ids
    FROM (SELECT e2.url, ARRAY_AGG(DISTINCT r.player_id) AS ids
            FROM LIIGA.MEDIA.MEDIA_EVENTS e2, LATERAL FLATTEN(e2.players) f
            JOIN LIIGA.RAW.ROSTER_2026_27 r
              ON LOWER(r.first_name || ' ' || r.last_name) = LOWER(TRIM(f.value::STRING))
           WHERE e2.player_ids IS NULL
           GROUP BY e2.url) m
   WHERE e.url = m.url;
  RETURN OBJECT_CONSTRUCT('uusia', :n);
END;
$$;

-- Agentin haku: otsikko + kuka + mitä; linkki ja aika palautetaan lähteeksi.
CREATE CORTEX SEARCH SERVICE IF NOT EXISTS LIIGA.MEDIA.LIIGA_MEDIA_SEARCH
  ON search_text
  ATTRIBUTES source, teams, event_type
  WAREHOUSE = LIIGA_WH
  TARGET_LAG = '1 day'
  COMMENT = 'Liiga-uutisotsikot (IS, IL, MTV) tapahtumineen agentille: pelikiellot, loukkaantumiset, siirrot, valmentajat.'
AS
SELECT url, title, source, COALESCE(teams, '') AS teams, event_type,
       TO_VARCHAR(published, 'YYYY-MM-DD HH24:MI') AS published,
       ARRAY_TO_STRING(players, ', ') AS players, ARRAY_TO_STRING(coaches, ', ') AS coaches,
       title || ' | joukkueet: ' || COALESCE(teams, '-') || ' | pelaajat: ' || ARRAY_TO_STRING(players, ', ')
         || ' | valmentajat: ' || ARRAY_TO_STRING(coaches, ', ') || ' | tyyppi: ' || event_type AS search_text
  FROM LIIGA.MEDIA.MEDIA_EVENTS;

CREATE STAGE IF NOT EXISTS LIIGA.MEDIA.CODE;
-- PUT file://snowflake/LIIGA/MEDIA/procedures/COLLECT_MEDIA/collect_media.py @LIIGA.MEDIA.CODE AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
CREATE OR REPLACE PROCEDURE LIIGA.MEDIA.COLLECT_MEDIA()
  RETURNS VARIANT LANGUAGE PYTHON RUNTIME_VERSION = '3.11'
  PACKAGES = ('snowflake-snowpark-python', 'requests')
  IMPORTS = ('@LIIGA.MEDIA.CODE/collect_media.py') HANDLER = 'collect_media.run'
  EXTERNAL_ACCESS_INTEGRATIONS = (LIIGA_MEDIA_ACCESS)
  COMMENT = 'Muut mediat: IS, IL, MTV Liiga-otsikot ja linkit. Kutsuja: control plane (liiga-mediat).'
  EXECUTE AS OWNER;

-- Sovellus (Mediat-sivu) ja agentti (haku). Julkaisu (LIIGA_DEPLOYER) tarkistaa palvelun olemassaolon.
GRANT USAGE ON SCHEMA LIIGA.MEDIA TO ROLE LIIGA_APP;
GRANT SELECT ON TABLE LIIGA.MEDIA.MEDIA_LINKS TO ROLE LIIGA_APP;
GRANT SELECT ON TABLE LIIGA.MEDIA.MEDIA_EVENTS TO ROLE LIIGA_APP;
GRANT USAGE ON CORTEX SEARCH SERVICE LIIGA.MEDIA.LIIGA_MEDIA_SEARCH TO ROLE LIIGA_APP;
GRANT USAGE ON SCHEMA LIIGA.MEDIA TO ROLE LIIGA_AGENT_OWNER;
GRANT USAGE ON CORTEX SEARCH SERVICE LIIGA.MEDIA.LIIGA_MEDIA_SEARCH TO ROLE LIIGA_AGENT_OWNER;
GRANT USAGE ON SCHEMA LIIGA.MEDIA TO ROLE LIIGA_AGENT_USER;
GRANT USAGE ON CORTEX SEARCH SERVICE LIIGA.MEDIA.LIIGA_MEDIA_SEARCH TO ROLE LIIGA_AGENT_USER;
GRANT USAGE ON SCHEMA LIIGA.MEDIA TO ROLE LIIGA_DEPLOYER;
GRANT USAGE ON CORTEX SEARCH SERVICE LIIGA.MEDIA.LIIGA_MEDIA_SEARCH TO ROLE LIIGA_DEPLOYER;
