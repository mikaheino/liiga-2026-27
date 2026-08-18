-- Per team per season totals. games_played is the denominator we use to turn a
-- player's season goal count into "goals per team-game".
CREATE OR REPLACE TABLE team_season AS
SELECT
    team,
    season,
    COUNT(*)                AS games_played,
    SUM(goals_for)          AS goals_for,
    SUM(goals_against)      AS goals_against,
    SUM(points)             AS points,
    SUM(won)                AS wins,
    AVG(goals_for)          AS gf_per_game,
    AVG(goals_against)      AS ga_per_game
FROM team_game_log
GROUP BY team, season;
