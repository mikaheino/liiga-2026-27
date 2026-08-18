-- Per player per season scoring, the raw material for production rates.
--   goals   : real goals only (shootout winners and own-goals excluded)
--   assists : from the exploded assist table
--   points  : goals + assists
--   team    : the team the player produced most for that season (handles trades)
-- player_id = 0 is the liiga.fi sentinel for own-goals/unattributed -> dropped.
CREATE OR REPLACE TABLE player_season_scoring AS
WITH goals AS (
    SELECT player_id, season, team,
           MAX(first_name) AS first_name, MAX(last_name) AS last_name,
           COUNT(*) AS goals
    FROM raw_goal_events
    WHERE player_id IS NOT NULL AND player_id <> 0 AND NOT is_shootout
    GROUP BY player_id, season, team
),
assists AS (
    SELECT player_id, season, team, COUNT(*) AS assists
    FROM raw_assists
    WHERE player_id IS NOT NULL AND player_id <> 0
    GROUP BY player_id, season, team
),
-- combine goals + assists at the player/season/team grain
combined AS (
    SELECT
        COALESCE(g.player_id, a.player_id)       AS player_id,
        COALESCE(g.season,    a.season)          AS season,
        COALESCE(g.team,      a.team)            AS team,
        g.first_name, g.last_name,
        COALESCE(g.goals, 0)                     AS goals,
        COALESCE(a.assists, 0)                   AS assists
    FROM goals g
    FULL OUTER JOIN assists a
      ON g.player_id = a.player_id AND g.season = a.season AND g.team = a.team
),
-- pick each player's primary team per season (most points produced)
ranked AS (
    SELECT *, (goals + assists) AS points,
           ROW_NUMBER() OVER (
               PARTITION BY player_id, season
               ORDER BY (goals + assists) DESC, goals DESC
           ) AS rn
    FROM combined
),
primary_team AS (
    SELECT player_id, season,
           SUM(goals)   AS goals,
           SUM(assists) AS assists,
           SUM(points)  AS points,
           MAX(first_name) AS first_name,
           MAX(last_name)  AS last_name,
           MAX(CASE WHEN rn = 1 THEN team END) AS team
    FROM ranked
    GROUP BY player_id, season
)
SELECT
    p.player_id, p.season, p.team,
    p.first_name, p.last_name,
    p.goals, p.assists, p.points,
    ts.games_played                          AS team_games,
    p.goals::DOUBLE  / ts.games_played       AS goals_per_team_game,
    p.points::DOUBLE / ts.games_played       AS points_per_team_game
FROM primary_team p
JOIN team_season ts ON ts.team = p.team AND ts.season = p.season;
