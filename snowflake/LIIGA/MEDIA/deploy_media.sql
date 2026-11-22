-- Median julkaisu CI:stä (23.11.2026): joukkuetunnistus ja agentin haku. Ajo: deploy-bundle.yml roolilla
-- LIIGA_DEPLOYER (omistaa vain nämä kaksi objektia, snowflake/_account/roles/LIIGA_DEPLOYER.sql). Taulut ja
-- proseduurit: _schema.sql (LIIGA_ADMIN). Idempotentti; ei kielimallikutsuja.
USE SCHEMA LIIGA.MEDIA;

-- Joukkueen tunnistus otsikosta, kun lähde ei kerro joukkuetta (vartalo kattaa taivutusmuodot: Lukon, Ilveksen, Kärppien).
CREATE OR REPLACE VIEW LIIGA.MEDIA.V_TEAM_PATTERNS
  COMMENT = 'Liigajoukkue ja sen nimen vartalo otsikkotunnistukseen (EXTRACT_MEDIA_EVENTS)'
AS
SELECT t.team, COALESCE(p.stem, t.team) AS stem
  FROM (SELECT DISTINCT home_team AS team FROM LIIGA.RAW.RAW_GAMES
         WHERE season = (SELECT MAX(season) FROM LIIGA.RAW.RAW_GAMES)) t
  -- 23.11.2026 (katselmointi m5): yksiselitteiset kotikaupungit (taivutukset vartalolla). Tampere (Ilves, Tappara)
  -- ja Helsinki (HIFK, Jokerit) jätetään pois: kaksi joukkuetta, kaupunki ei kerro kumpi.
  LEFT JOIN (SELECT column1 AS team, column2 AS stem FROM VALUES
      ('Ilves', 'Ilve(s|k)'), ('Kärpät', 'Kärp|Oulu'), ('Ässät', 'Äss|Pori'), ('Lukko', 'Luko(n|ssa|lle)|Lukko|Rauma'),
      ('Jokerit', 'Joker(i|e)'), ('K-Espoo', 'K-Espoo|Kiekko-Espoo|Espoo'), ('Pelicans', 'Pelican'), ('Tappara', 'Tappara'),
      ('KalPa', 'KalPa|Kuopio'), ('Jukurit', 'Jukuri|Mikkel'), ('SaiPa', 'SaiPa|Lappeenran'), ('Sport', 'Sport(i|in| )|Vaasa'),
      ('JYP', 'JYP|Jyväskyl'), ('HPK', 'HPK|Hämeenlinn'), ('KooKoo', 'KooKoo|Kouvol'), ('TPS', 'TPS|Turku|Turu(n|ssa|sta|lla)')) p
    ON p.team = t.team;

-- Kaupunkien lisäys (m5) koskee myös vanhoja rivejä: joukkueet uudelleen kaikille (ei kielimallia).
CALL LIIGA.MEDIA.ASSIGN_MEDIA_TEAMS('1970-01-01'::TIMESTAMP_TZ);

-- Agentin haku: otsikko (+ ingressi) + kuka + mitä; linkki, lähde ja aika palautetaan lähteeksi.
-- 22.11.2026: kattaa molemmat lähdetyypit (source_kind); suodatettavat: source, source_kind, event_type ja
-- team_list (ARRAY, @contains: myös usean joukkueen otsikot; teams-merkkijono vain näyttöön).
-- 23.11.2026: published_date (DATE, suodatettava @gte: tuoreus; ei CURRENT_TIMESTAMPia lähteessä, jotta päivitys
-- pysyy inkrementaalisena); TARGET_LAG 7 days,
-- koska EXTRACT_MEDIA_EVENTS päivittää haun itse (REFRESH), kun uutta tulee.
CREATE OR REPLACE CORTEX SEARCH SERVICE LIIGA.MEDIA.LIIGA_MEDIA_SEARCH
  ON search_text
  ATTRIBUTES source, source_kind, teams, team_list, event_type, published_date
  WAREHOUSE = LIIGA_WH
  TARGET_LAG = '7 days'
  COMMENT = 'Liiga-uutiset tapahtumineen agentille: IS, IL, MTV (otsikot) sekä seurat, Yle ja Sport (otsikko + ingressi). Pelikiellot, loukkaantumiset, siirrot, valmentajat.'
AS
SELECT url, title, COALESCE(summary, '') AS summary, source, source_kind, COALESCE(teams, '') AS teams,
       IFF(NULLIF(teams, '') IS NULL, [], SPLIT(teams, ', ')) AS team_list, event_type,
       TO_VARCHAR(published, 'YYYY-MM-DD HH24:MI') AS published,
       TO_DATE(CONVERT_TIMEZONE('UTC', COALESCE(published, extracted_at))) AS published_date,
       ARRAY_TO_STRING(players, ', ') AS players, ARRAY_TO_STRING(coaches, ', ') AS coaches,
       title || IFF(summary IS NULL, '', ' | ' || summary) || ' | joukkueet: ' || COALESCE(teams, '-')
         || ' | pelaajat: ' || ARRAY_TO_STRING(players, ', ') || ' | valmentajat: ' || ARRAY_TO_STRING(coaches, ', ')
         || ' | tyyppi: ' || event_type || ' | ' || TO_VARCHAR(published, 'YYYY-MM-DD') AS search_text
  FROM LIIGA.MEDIA.MEDIA_EVENTS
 -- 23.11.2026 (katselmointi m5): kentän ulkopuoliset (off-ice) ja luokittelemattomat (other) eivät agentin hakuun.
 WHERE COALESCE(event_type, 'other') NOT IN ('other', 'off-ice');
GRANT USAGE ON CORTEX SEARCH SERVICE LIIGA.MEDIA.LIIGA_MEDIA_SEARCH TO ROLE LIIGA_APP;
GRANT USAGE ON CORTEX SEARCH SERVICE LIIGA.MEDIA.LIIGA_MEDIA_SEARCH TO ROLE LIIGA_AGENT_OWNER;
GRANT USAGE ON CORTEX SEARCH SERVICE LIIGA.MEDIA.LIIGA_MEDIA_SEARCH TO ROLE LIIGA_AGENT_USER;
GRANT SELECT ON VIEW LIIGA.MEDIA.V_TEAM_PATTERNS TO ROLE LIIGA_APP;
