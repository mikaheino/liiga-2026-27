-- Kenttäpelaajat kuluvalla kaudella.
CREATE OR REPLACE VIEW LIIGA.MODEL.V_PLAYER_SEASON_NOW
  COMMENT = 'Kenttäpelaajan kausi nyt: ottelut kokoonpanoista, maalit ilman epäonnistuneita rangaistuslaukauksia, ero esikauden ennusteeseen.'
AS
WITH cur AS (SELECT MAX(season) AS s FROM LIIGA.MODEL.STG_GAMES),
gp AS (
  SELECT l.player_id,
         MAX(l.first_name) AS first_name, MAX(l.last_name) AS last_name,
         MAX(l.team) AS team, MAX(l.position_group) AS position_group,
         COUNT(DISTINCT l.game_id) AS games_played
  FROM LIIGA.RAW.GAME_LINEUPS l
  JOIN LIIGA.MODEL.V_GAMES_NOW g ON g.game_id = l.game_id AND g.ended
  WHERE l.season = (SELECT s FROM cur) AND l.position_group <> 'G'
    AND NOT COALESCE(l.removed, FALSE)
  GROUP BY l.player_id),
goals AS (
  SELECT e.player_id,
         COUNT(*) AS goals,
         COUNT_IF(e.is_powerplay) AS pp_goals,
         COUNT_IF(e.is_winning_goal) AS game_winning_goals
  FROM LIIGA.RAW.RAW_GOAL_EVENTS e
  WHERE e.season = (SELECT s FROM cur) AND e.player_id <> 0
    AND COALESCE(e.goal_types, '') NOT LIKE '%RL0%'
    AND COALESCE(e.goal_types, '') NOT LIKE '%VT0%'
  GROUP BY e.player_id),
pss AS (SELECT player_id, assists FROM LIIGA.MODEL.PLAYER_SEASON_SCORING
        WHERE season = (SELECT s FROM cur)),
pre_id AS (SELECT player_id, ppg FROM LIIGA.RAW.PRESEASON_PLAYER_RATES
           WHERE player_id IS NOT NULL),
pre_nm AS (SELECT LOWER(name) AS nm, team, ppg FROM LIIGA.RAW.PRESEASON_PLAYER_RATES)
SELECT gp.player_id,
       gp.first_name || ' ' || gp.last_name AS player_name,
       gp.last_name, gp.team,
       IFF(gp.position_group = 'D', 'Puolustaja', 'Hyökkääjä') AS position,
       gp.games_played,
       COALESCE(gl.goals, 0) AS goals,
       COALESCE(s.assists, 0) AS assists,
       COALESCE(gl.goals, 0) + COALESCE(s.assists, 0) AS points,
       (COALESCE(gl.goals, 0) + COALESCE(s.assists, 0)) / NULLIF(gp.games_played, 0) AS points_per_game,
       COALESCE(gl.pp_goals, 0) AS pp_goals,
       COALESCE(gl.game_winning_goals, 0) AS game_winning_goals,
       COALESCE(pi.ppg, pn.ppg) AS preseason_points_per_game,
       COALESCE(pi.ppg, pn.ppg) * gp.games_played AS preseason_expected_points,
       COALESCE(gl.goals, 0) + COALESCE(s.assists, 0)
         - COALESCE(pi.ppg, pn.ppg) * gp.games_played AS points_vs_preseason
FROM gp
LEFT JOIN goals gl ON gl.player_id = gp.player_id
LEFT JOIN pss s ON s.player_id = gp.player_id
LEFT JOIN pre_id pi ON pi.player_id = gp.player_id
LEFT JOIN pre_nm pn ON pn.nm = LOWER(gp.first_name || ' ' || gp.last_name)
                   AND pn.team = gp.team;


