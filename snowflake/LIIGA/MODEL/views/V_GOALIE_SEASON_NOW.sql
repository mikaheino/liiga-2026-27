-- Maalivahdit kuluvalla kaudella. Vertailut vain otteluista, joissa pelasi
-- yksi maalivahti (peliaikaa ei ole, joten jaettua ottelua ei voi jakaa).
CREATE OR REPLACE VIEW LIIGA.MODEL.V_GOALIE_SEASON_NOW
  COMMENT = 'Maalivahdin kausi nyt: päästetyt vs. keskivertomaalivahti ja vs. oma esikauden torjuntaennuste samoista maalipaikoista.'
AS
WITH cur AS (SELECT MAX(season) AS s FROM LIIGA.MODEL.STG_GAMES),
gg AS (SELECT * FROM LIIGA.RAW.GAME_GOALIES
       WHERE season = (SELECT s FROM cur) AND played),
solo AS (SELECT game_id, team FROM gg GROUP BY game_id, team HAVING COUNT(*) = 1),
s AS (
  SELECT g.player_id, g.team, g.goals_against, l.xg_against
  FROM gg g
  JOIN solo o ON o.game_id = g.game_id AND o.team = g.team
  JOIN LIIGA.MODEL.TEAM_GAME_LOG l
    ON l.season = g.season AND l.game_id = g.game_id AND l.team = g.team),
scale AS (SELECT SUM(goals_against) / NULLIF(SUM(xg_against), 0) AS r FROM s),
tot AS (
  SELECT player_id, MAX(first_name) AS first_name, MAX(last_name) AS last_name,
         MAX(team) AS team, COUNT(*) AS games_played, COUNT_IF(started) AS starts
  FROM gg GROUP BY player_id),
agg AS (SELECT player_id, COUNT(*) AS solo_games, SUM(goals_against) AS goals_against,
               SUM(xg_against) AS xg_against FROM s GROUP BY player_id),
pre AS (SELECT LOWER(name) AS nm, team, proj_save_pct
        FROM LIIGA.RAW.PRESEASON_PLAYER_RATES WHERE position_group = 'G')
SELECT t.player_id, t.first_name || ' ' || t.last_name AS goalie_name, t.last_name,
       t.team, t.games_played, t.starts,
       a.solo_games, a.goals_against, a.xg_against,
       a.goals_against / NULLIF(a.solo_games, 0) AS goals_against_per_game,
       a.xg_against * (SELECT r FROM scale) AS expected_ga_average_goalie,
       a.xg_against * (SELECT r FROM scale) - a.goals_against AS goals_saved_vs_average,
       p.proj_save_pct AS preseason_save_pct,
       a.xg_against * (SELECT r FROM scale) * (1 - p.proj_save_pct) / (1 - 0.908)
         AS expected_ga_own_projection,
       a.xg_against * (SELECT r FROM scale) * (1 - p.proj_save_pct) / (1 - 0.908)
         - a.goals_against AS goals_saved_vs_preseason
FROM tot t
LEFT JOIN agg a ON a.player_id = t.player_id
LEFT JOIN pre p ON p.nm = LOWER(t.first_name || ' ' || t.last_name) AND p.team = t.team;


