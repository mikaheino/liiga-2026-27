-- LIIGA.MEDIA: muiden medioiden otsikot ja linkit (21.11.2026).
-- TEKOÄLYKÄYTTÖ SALLITTU 22.11.2026: Mika Heino ilmoitti luvan (Ilta-Sanomat, Iltalehti, MTV Uutiset;
-- laajuus otsikot ja linkit). Julkaisijoiden robots.txt kieltää yhä tekoälyrobotit, joten näiden medioiden
-- keräys pysyy pelkkänä syötteenlukijana: ei artikkelitekstiä eikä ingressiä (source_kind 'media').
-- Seurojen, Ylen ja Sportin uutisista (RAW.NEWS_ITEMS, source_kind 'news') käytetään otsikko ja ingressi:
-- ne tulevat liigaputken omasta uutiskeräyksestä, eivät tämän luvan piiristä.
-- Ontologia: MEDIA_EVENTS (pelaajat, valmentajat, tapahtumatyyppi) -> agentin haku LIIGA_MEDIA_SEARCH.
-- Aja ACCOUNTADMINina (ylläpitoyhteys futurice). Proseduurin koodi stagelta: ks. alla PUT.
USE ROLE ACCOUNTADMIN;
-- 23.11.2026: laaja haku (tier 'wide', MEDIA_SOURCES) tarvitsee myös HS:n, Ylen ja Bingin uutishaun.
-- Isännät ovat sallittuja valmiiksi; keräin hakee vain lähteitä, joilla enabled = true.
CREATE OR REPLACE NETWORK RULE LIIGA.CODE.LIIGA_MEDIA_RULE
  TYPE = HOST_PORT MODE = EGRESS
  VALUE_LIST = ('www.is.fi:443', 'www.iltalehti.fi:443', 'api.mtvuutiset.fi:443', 'www.hs.fi:443', 'yle.fi:443', 'www.bing.com:443')
  COMMENT = 'Muut mediat: vain RSS-syötteet ja uutishaun RSS (otsikot ja linkit)';
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
ALTER TABLE LIIGA.MEDIA.MEDIA_LINKS SET COMMENT = 'Liiga-uutisotsikot ja linkit (MEDIA_SOURCES). Vain otsikko ja linkki, ei artikkelitekstiä.';

-- Lähteet (23.11.2026): keräin lukee tämän. tier core = luvan piirissä 22.11.; tier wide = control planen
-- ehdotus "Laajempi uutishaku" (Kyllä asettaa enabled = true ja kirjataan AUDITiin).
CREATE TABLE IF NOT EXISTS LIIGA.MEDIA.MEDIA_SOURCES (
  source      STRING PRIMARY KEY,
  kind        STRING NOT NULL COMMENT 'rss | sport | search',
  tier        STRING NOT NULL COMMENT 'core | wide',
  url         STRING NOT NULL COMMENT 'search: {q} = joukkue + liiga',
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  last_run_at TIMESTAMP_TZ,
  last_status STRING
) COMMENT = 'COLLECT_MEDIA-lähteet. Vain otsikot ja linkit.';
MERGE INTO LIIGA.MEDIA.MEDIA_SOURCES t USING (
  SELECT * FROM VALUES
    ('Ilta-Sanomat', 'rss', 'core', 'https://www.is.fi/rss/jaakiekko.xml', TRUE),
    ('Iltalehti', 'rss', 'core', 'https://www.iltalehti.fi/rss/jaakiekko.xml', TRUE),
    ('MTV Uutiset', 'sport', 'core', 'https://api.mtvuutiset.fi/mtvuutiset/api/feed/rss/urheilu', TRUE),
    ('Helsingin Sanomat', 'sport', 'wide', 'https://www.hs.fi/rss/urheilu.xml', FALSE),
    ('Ilta-Sanomat urheilu', 'sport', 'wide', 'https://www.is.fi/rss/urheilu.xml', FALSE),
    ('Iltalehti urheilu', 'sport', 'wide', 'https://www.iltalehti.fi/rss/urheilu.xml', FALSE),
    ('Yle Urheilu', 'sport', 'wide', 'https://yle.fi/rss/urheilu', FALSE),
    ('Uutishaku', 'search', 'wide', 'https://www.bing.com/news/search?q={q}&format=rss&setlang=fi', FALSE)
    AS v(source, kind, tier, url, enabled)) v
  ON t.source = v.source
  WHEN MATCHED THEN UPDATE SET kind = v.kind, tier = v.tier, url = v.url
  WHEN NOT MATCHED THEN INSERT (source, kind, tier, url, enabled) VALUES (v.source, v.kind, v.tier, v.url, v.enabled);

-- Ontologia: yksi rivi per otsikko. Pelaajat ja valmentajat AI_EXTRACTilla, tyyppi AI_CLASSIFYlla,
-- pelaajat liitetään rosteriin (player_ids). Joukkueet: ASSIGN_MEDIA_TEAMS (lähteen joukkue + otsikon nimi).
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
-- 23.11.2026 (katselmointi): lähteen oma joukkue erikseen (vain news: seuran oma uutinen). IS/IL/MTV-syötteen
-- avainsanalista (MEDIA_LINKS.team) EI ole joukkue: niille joukkueet vain otsikon nimen vartalosta.
ALTER TABLE LIIGA.MEDIA.MEDIA_EVENTS ADD COLUMN IF NOT EXISTS source_team STRING
  COMMENT 'Lähteen kertoma joukkue (vain news: RAW.NEWS_ITEMS.team); media-riveillä NULL';
UPDATE LIIGA.MEDIA.MEDIA_EVENTS e SET source_team = n.team
  FROM (SELECT url, ANY_VALUE(team) AS team FROM LIIGA.RAW.NEWS_ITEMS GROUP BY url) n
 WHERE e.url = n.url AND e.source_kind = 'news' AND e.source_team IS NULL;
ALTER TABLE LIIGA.MEDIA.MEDIA_EVENTS ALTER COLUMN teams COMMENT 'Liigajoukkueet RAW_GAMES-nimin, pilkulla ja välilyönnillä erotettuna';

-- V_TEAM_PATTERNS: snowflake/LIIGA/MEDIA/deploy_media.sql (CI, deploy-bundle.yml, 23.11.2026).

-- Joukkueet (23.11.2026, katselmointi): lähteen joukkue (news) UNION otsikon (+ ingressin) nimen vartalo.
-- Vain rivit, joiden extracted_at >= SINCE (EXTRACT: tämän ajon rivit; '1970-01-01' = kaikki uudelleen). Ei kielimallia.
CREATE OR REPLACE PROCEDURE LIIGA.MEDIA.ASSIGN_MEDIA_TEAMS(SINCE TIMESTAMP_TZ)
  RETURNS NUMBER LANGUAGE SQL
  COMMENT = 'MEDIA_EVENTS.teams = lähteen joukkue (news) + otsikossa mainitut Liiga-joukkueet. Ei AI-kutsuja.'
  EXECUTE AS OWNER
AS
$$
BEGIN
  UPDATE LIIGA.MEDIA.MEDIA_EVENTS e SET teams = COALESCE(t.teams, '')
    FROM (SELECT e2.url, LISTAGG(DISTINCT p.team, ', ') WITHIN GROUP (ORDER BY p.team) AS teams
            FROM LIIGA.MEDIA.MEDIA_EVENTS e2
            LEFT JOIN LIIGA.MEDIA.V_TEAM_PATTERNS p
              ON (e2.source_team IS NOT NULL
                  AND ARRAY_CONTAINS(p.team::VARIANT, TRANSFORM(SPLIT(REPLACE(REPLACE(e2.source_team, 'Tampereen Ilves', 'Ilves'),
                        'Oulun Kärpät', 'Kärpät'), ','), v -> TRIM(v::STRING)::VARIANT)))
              OR REGEXP_LIKE(e2.title || ' ' || IFF(e2.source_kind = 'news', COALESCE(e2.summary, ''), ''),
                             '(^|.*[^A-Za-zÅÄÖåäö])(' || p.stem || ').*', 's')
           WHERE e2.extracted_at >= :SINCE
           GROUP BY e2.url) t
   WHERE e.url = t.url AND COALESCE(e.teams, '') <> COALESCE(t.teams, '');
  RETURN SQLROWCOUNT;
END;
$$;

CREATE OR REPLACE PROCEDURE LIIGA.MEDIA.EXTRACT_MEDIA_EVENTS()
  RETURNS VARIANT LANGUAGE SQL
  COMMENT = 'Uudet otsikot (MEDIA_LINKS) ja uutiset (RAW.NEWS_ITEMS) -> MEDIA_EVENTS, vain poimimattomat URLit. Kutsuja: control plane (liiga-media-ontologia).'
  EXECUTE AS OWNER
AS
$$
DECLARE
  n INTEGER;
  t0 TIMESTAMP_TZ DEFAULT CURRENT_TIMESTAMP();   -- tämän ajon rivit: extracted_at >= t0 (UPDATEt vain niihin)
BEGIN
  INSERT INTO LIIGA.MEDIA.MEDIA_EVENTS (url, published, source, source_kind, title, summary, source_team, players, coaches, event_type)
  WITH uudet AS (
    SELECT url, published, source, 'media' AS source_kind, title, NULL::STRING AS summary, NULL::STRING AS team, fetched_at
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

  CALL LIIGA.MEDIA.ASSIGN_MEDIA_TEAMS(:t0);

  -- Valmentaja ei ole pelaaja: nimi, joka on jossain otsikossa valmentaja tai COACHING_CHANGESissa,
  -- siirretään players -> coaches (AI_EXTRACT sekoittaa ne, kun otsikossa ei ole roolia).
  UPDATE LIIGA.MEDIA.MEDIA_EVENTS e
     SET coaches = ARRAY_DISTINCT(ARRAY_CAT(e.coaches, ARRAY_INTERSECTION(e.players, k.names))),
         players = ARRAY_EXCEPT(e.players, k.names)
    FROM (SELECT ARRAY_UNIQUE_AGG(nm) AS names FROM (
            SELECT f.value::STRING AS nm FROM LIIGA.MEDIA.MEDIA_EVENTS, LATERAL FLATTEN(coaches) f
            UNION SELECT coach_in FROM LIIGA.RAW.COACHING_CHANGES
            UNION SELECT coach_out FROM LIIGA.RAW.COACHING_CHANGES) WHERE nm IS NOT NULL) k
   WHERE ARRAY_SIZE(ARRAY_INTERSECTION(e.players, k.names)) > 0 AND e.extracted_at >= :t0;

  -- Pelaajat rosteriin (nimi = etunimi + sukunimi). Täsmäämättömät jäävät NULLiksi ja yritetään uudelleen.
  UPDATE LIIGA.MEDIA.MEDIA_EVENTS e SET player_ids = m.ids
    FROM (SELECT e2.url, ARRAY_AGG(DISTINCT r.player_id) AS ids
            FROM LIIGA.MEDIA.MEDIA_EVENTS e2, LATERAL FLATTEN(e2.players) f
            JOIN LIIGA.RAW.ROSTER_2026_27 r
              ON LOWER(r.first_name || ' ' || r.last_name) = LOWER(TRIM(f.value::STRING))
           WHERE e2.player_ids IS NULL AND e2.extracted_at >= DATEADD(day, -7, :t0)   -- uusinta viikon ajan
           GROUP BY e2.url) m
   WHERE e.url = m.url;
  -- Haku heti ajan tasalle; vain kun tuli uutta (TARGET_LAG 7 days on vain varalla).
  IF (n > 0) THEN
    ALTER CORTEX SEARCH SERVICE LIIGA.MEDIA.LIIGA_MEDIA_SEARCH REFRESH;
  END IF;
  RETURN OBJECT_CONSTRUCT('uusia', :n);
END;
$$;

-- LIIGA_MEDIA_SEARCH: snowflake/LIIGA/MEDIA/deploy_media.sql (CI, deploy-bundle.yml, 23.11.2026).

CREATE STAGE IF NOT EXISTS LIIGA.MEDIA.CODE;
-- PUT file://snowflake/LIIGA/MEDIA/procedures/COLLECT_MEDIA/collect_media.py @LIIGA.MEDIA.CODE AUTO_COMPRESS=FALSE OVERWRITE=TRUE;
CREATE OR REPLACE PROCEDURE LIIGA.MEDIA.COLLECT_MEDIA()
  RETURNS VARIANT LANGUAGE PYTHON RUNTIME_VERSION = '3.11'
  PACKAGES = ('snowflake-snowpark-python', 'requests')
  IMPORTS = ('@LIIGA.MEDIA.CODE/collect_media.py') HANDLER = 'collect_media.run'
  EXTERNAL_ACCESS_INTEGRATIONS = (LIIGA_MEDIA_ACCESS)
  COMMENT = 'Liiga-otsikot ja linkit (lähteet MEDIA_SOURCES). Kutsuja: control plane (liiga-mediat, liiga-mediat-tihea).'
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

-- Kertaluonteinen uudelleenlaskenta (23.11.2026): CALL LIIGA.MEDIA.ASSIGN_MEDIA_TEAMS('1970-01-01'::TIMESTAMP_TZ);
