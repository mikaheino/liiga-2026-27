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

-- 22.11.2026 (G3): myös seurojen, Ylen ja Sportin uutiset (LIIGA.RAW.NEWS_ITEMS: otsikko + ingressi) samaan
-- ontologiaan. source_kind = 'media' (IS, IL, MTV: vain otsikko) | 'news' (NEWS_ITEMS: otsikko + ingressi).
ALTER TABLE LIIGA.MEDIA.MEDIA_EVENTS ADD COLUMN IF NOT EXISTS source_kind STRING
  COMMENT 'media = IS/IL/MTV (MEDIA_LINKS, vain otsikko) | news = seurat, Yle, Sport (RAW.NEWS_ITEMS, otsikko + ingressi)';
ALTER TABLE LIIGA.MEDIA.MEDIA_EVENTS ADD COLUMN IF NOT EXISTS summary STRING
  COMMENT 'Ingressi (vain news; media-riveillä NULL, koska lupa koskee vain otsikoita)';
UPDATE LIIGA.MEDIA.MEDIA_EVENTS SET source_kind = 'media' WHERE source_kind IS NULL;
ALTER TABLE LIIGA.MEDIA.MEDIA_EVENTS ALTER COLUMN teams COMMENT 'Liigajoukkueet RAW_GAMES-nimin, pilkulla ja välilyönnillä erotettuna';

-- Joukkueen tunnistus otsikosta, kun lähde ei kerro joukkuetta (vartalo kattaa taivutusmuodot: Lukon, Ilveksen, Kärppien).
CREATE OR REPLACE VIEW LIIGA.MEDIA.V_TEAM_PATTERNS
  COMMENT = 'Liigajoukkue ja sen nimen vartalo otsikkotunnistukseen (EXTRACT_MEDIA_EVENTS)'
AS
SELECT t.team, COALESCE(p.stem, t.team) AS stem
  FROM (SELECT DISTINCT home_team AS team FROM LIIGA.RAW.RAW_GAMES
         WHERE season = (SELECT MAX(season) FROM LIIGA.RAW.RAW_GAMES)) t
  LEFT JOIN (SELECT column1 AS team, column2 AS stem FROM VALUES
      ('Ilves', 'Ilve(s|k)'), ('Kärpät', 'Kärp'), ('Ässät', 'Äss'), ('Lukko', 'Luko|Lukon|Lukko'),
      ('Jokerit', 'Jokeri'), ('Pelicans', 'Pelican'), ('Tappara', 'Tappara'), ('KalPa', 'KalPa'),
      ('Jukurit', 'Jukuri'), ('SaiPa', 'SaiPa'), ('Sport', 'Sport(i|in| )')) p ON p.team = t.team;

CREATE OR REPLACE PROCEDURE LIIGA.MEDIA.EXTRACT_MEDIA_EVENTS()
  RETURNS VARIANT LANGUAGE SQL
  COMMENT = 'Uudet otsikot (MEDIA_LINKS) ja uutiset (RAW.NEWS_ITEMS) -> MEDIA_EVENTS, vain poimimattomat URLit. Kutsuja: control plane (liiga-media-ontologia).'
  EXECUTE AS OWNER
AS
$$
DECLARE
  n INTEGER;
BEGIN
  INSERT INTO LIIGA.MEDIA.MEDIA_EVENTS (url, published, source, source_kind, title, summary, teams, players, coaches, event_type)
  WITH uudet AS (
    SELECT url, published, source, 'media' AS source_kind, title, NULL::STRING AS summary, team, fetched_at
      FROM LIIGA.MEDIA.MEDIA_LINKS
    UNION ALL
    SELECT url, COALESCE(TRY_TO_TIMESTAMP_TZ(NULLIF(published, '')), TRY_TO_TIMESTAMP_TZ(fetched_at)), source, 'news',
           title, NULLIF(summary, ''), team, TRY_TO_TIMESTAMP_TZ(fetched_at)
      FROM LIIGA.RAW.NEWS_ITEMS
  ), u AS (
    SELECT * FROM uudet n
     WHERE n.url IS NOT NULL AND n.title IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM LIIGA.MEDIA.MEDIA_EVENTS e WHERE e.url = n.url)
    QUALIFY ROW_NUMBER() OVER (PARTITION BY n.url ORDER BY n.fetched_at) = 1
  ), x AS (
    SELECT u.*, u.title || IFF(u.summary IS NULL, '', '. ' || u.summary) AS txt FROM u
  ), y AS (
    SELECT x.*,
           AI_EXTRACT(text => x.txt, responseFormat => {'schema': {'type': 'object', 'properties': {
             'players': {'description': 'Names of ice hockey players mentioned (full names as written)', 'type': 'array'},
             'coaches': {'description': 'Names of coaches or sports directors mentioned', 'type': 'array'}}}}):response AS r,
           AI_CLASSIFY(x.txt, ['suspension', 'injury', 'transfer', 'coaching', 'game result', 'crisis', 'off-ice', 'other'],
             {'task_description': 'Classify a Finnish ice hockey (SM-liiga) news item by event type'}):labels[0]::STRING AS et
      FROM x
  )
  SELECT url, published, source, source_kind, title, summary, team,
         COALESCE(r:players::ARRAY, []), COALESCE(r:coaches::ARRAY, []), et FROM y;
  n := SQLROWCOUNT;

  -- Joukkueet RAW_GAMES-nimiin (lähteissä "Tampereen Ilves", "Oulun Kärpät", erottimet vaihtelevat);
  -- jos lähde ei kerro joukkuetta, tunnistus otsikosta (ja ingressistä) nimen vartalolla. Ei kielimallia.
  UPDATE LIIGA.MEDIA.MEDIA_EVENTS e SET teams = t.teams
    FROM (SELECT e2.url, LISTAGG(DISTINCT p.team, ', ') WITHIN GROUP (ORDER BY p.team) AS teams
            FROM LIIGA.MEDIA.MEDIA_EVENTS e2
            JOIN LIIGA.MEDIA.V_TEAM_PATTERNS p
              ON IFF(NULLIF(TRIM(e2.teams), '') IS NOT NULL,
                     ARRAY_CONTAINS(p.team::VARIANT, TRANSFORM(SPLIT(REPLACE(REPLACE(e2.teams, 'Tampereen Ilves', 'Ilves'),
                       'Oulun Kärpät', 'Kärpät'), ','), v -> TRIM(v::STRING)::VARIANT)),
                     REGEXP_LIKE(e2.title || ' ' || COALESCE(e2.summary, ''), '(^|.*[^A-Za-zÅÄÖåäö])(' || p.stem || ').*', 's'))
           GROUP BY e2.url) t
   WHERE e.url = t.url AND (e.teams IS NULL OR e.teams <> t.teams);

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
  -- Haku heti ajan tasalle (TARGET_LAG 1 day olisi muuten jopa vuorokauden myöhässä); vain kun tuli uutta.
  IF (n > 0) THEN
    ALTER CORTEX SEARCH SERVICE LIIGA.MEDIA.LIIGA_MEDIA_SEARCH REFRESH;
  END IF;
  RETURN OBJECT_CONSTRUCT('uusia', :n);
END;
$$;

-- Agentin haku: otsikko (+ ingressi) + kuka + mitä; linkki, lähde ja aika palautetaan lähteeksi.
-- 22.11.2026: kattaa molemmat lähdetyypit (source_kind); suodatettavat: source, source_kind, event_type ja
-- team_list (ARRAY, @contains: myös usean joukkueen otsikot; teams-merkkijono vain näyttöön).
CREATE OR REPLACE CORTEX SEARCH SERVICE LIIGA.MEDIA.LIIGA_MEDIA_SEARCH
  ON search_text
  ATTRIBUTES source, source_kind, teams, team_list, event_type
  WAREHOUSE = LIIGA_WH
  TARGET_LAG = '1 day'
  COMMENT = 'Liiga-uutiset tapahtumineen agentille: IS, IL, MTV (otsikot) sekä seurat, Yle ja Sport (otsikko + ingressi). Pelikiellot, loukkaantumiset, siirrot, valmentajat.'
AS
SELECT url, title, COALESCE(summary, '') AS summary, source, source_kind, COALESCE(teams, '') AS teams,
       IFF(NULLIF(teams, '') IS NULL, [], SPLIT(teams, ', ')) AS team_list, event_type,
       TO_VARCHAR(published, 'YYYY-MM-DD HH24:MI') AS published,
       ARRAY_TO_STRING(players, ', ') AS players, ARRAY_TO_STRING(coaches, ', ') AS coaches,
       title || IFF(summary IS NULL, '', ' | ' || summary) || ' | joukkueet: ' || COALESCE(teams, '-')
         || ' | pelaajat: ' || ARRAY_TO_STRING(players, ', ') || ' | valmentajat: ' || ARRAY_TO_STRING(coaches, ', ')
         || ' | tyyppi: ' || event_type || ' | ' || TO_VARCHAR(published, 'YYYY-MM-DD') AS search_text
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
GRANT SELECT ON VIEW LIIGA.MEDIA.V_TEAM_PATTERNS TO ROLE LIIGA_APP;
GRANT USAGE ON SCHEMA LIIGA.MEDIA TO ROLE LIIGA_DEPLOYER;
GRANT USAGE ON CORTEX SEARCH SERVICE LIIGA.MEDIA.LIIGA_MEDIA_SEARCH TO ROLE LIIGA_DEPLOYER;
-- Agentin evaluointi (agent_eval.py) laskee uutiskysymyksen odotetun vastauksen MEDIA_EVENTSistä (22.11.2026).
GRANT SELECT ON TABLE LIIGA.MEDIA.MEDIA_EVENTS TO ROLE LIIGA_DEPLOYER;
