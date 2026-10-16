-- Kunkin joukkueen viimeisimmän pelatun ottelun kokoonpano, maalivahdit
-- mukaan lukien. Todennäköisin kokoonpano seuraavaan otteluun.
CREATE OR REPLACE VIEW LIIGA.MODEL.V_LATEST_LINEUPS
  COMMENT = 'Joukkueen viimeisimmän pelatun ottelun kokoonpano: ketju, pelipaikka, pelaaja. Maalivahdilla started = aloitti.'
AS
WITH last AS (
  SELECT team, game_id, game_date, opponent FROM (
    SELECT g.home_team AS team, g.game_id, g.game_date, g.away_team AS opponent
    FROM LIIGA.MODEL.V_GAMES_NOW g WHERE g.ended
    UNION ALL
    SELECT g.away_team, g.game_id, g.game_date, g.home_team
    FROM LIIGA.MODEL.V_GAMES_NOW g WHERE g.ended)
  QUALIFY ROW_NUMBER() OVER (PARTITION BY team ORDER BY game_date DESC, game_id DESC) = 1)
SELECT l.team, la.game_date, la.opponent,
       l.line,
       CASE l.role WHEN 'CENTER' THEN 'Keskushyökkääjä' WHEN 'LEFT_WING' THEN 'Vasen laitahyökkääjä'
                   WHEN 'RIGHT_WING' THEN 'Oikea laitahyökkääjä' WHEN 'LEFT_DEFENSEMAN' THEN 'Vasen puolustaja'
                   WHEN 'RIGHT_DEFENSEMAN' THEN 'Oikea puolustaja' WHEN 'GOALIE' THEN 'Maalivahti'
                   WHEN 'STRIKER' THEN 'Hyökkääjä' WHEN 'DEFENSEMAN' THEN 'Puolustaja'
                   WHEN 'THIRTEENTH_STRIKER' THEN '13. hyökkääjä'
                   WHEN 'FOURTEENTH_STRIKER' THEN '14. hyökkääjä'
                   WHEN 'SEVENTH_DEFENSEMAN' THEN '7. puolustaja'
                   WHEN 'EIGHTH_DEFENSEMAN' THEN '8. puolustaja'
                   ELSE l.role END AS role_fi,
       l.position_group,
       l.first_name || ' ' || l.last_name AS player_name,
       l.jersey, l.captain, l.alternate_captain,
       gg.started AS goalie_started
FROM last la
JOIN LIIGA.RAW.GAME_LINEUPS l ON l.game_id = la.game_id AND l.team = la.team
LEFT JOIN LIIGA.RAW.GAME_GOALIES gg
       ON gg.game_id = l.game_id AND gg.player_id = l.player_id
WHERE NOT COALESCE(l.removed, FALSE);


