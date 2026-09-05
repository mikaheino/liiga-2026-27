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
    AVG(goals_against)      AS ga_per_game,
    SUM(xg_for)             AS xg_for,
    SUM(xg_against)         AS xg_against,
    SUM(pp_goals)           AS pp_goals,
    SUM(pp_instances)       AS pp_instances,
    SUM(sh_goals)           AS sh_goals,
    SUM(sh_instances)       AS sh_instances,
    -- Power play and penalty kill as the league states them. NULLIF guards a
    -- team that never had the situation; a division by zero would poison the
    -- whole row.
    SUM(pp_goals) * 1.0 / NULLIF(SUM(pp_instances), 0)          AS pp_pct,
    1.0 - SUM(pp_goals_against) * 1.0 / NULLIF(SUM(sh_instances), 0) AS pk_pct,
    -- Share of the expected goals in a team's own games. The closest thing to
    -- a territorial measure the API allows: it counts chance quality, NOT
    -- possession, which liiga.fi does not publish at all.
    SUM(xg_for) / NULLIF(SUM(xg_for) + SUM(xg_against), 0)      AS xg_share
FROM team_game_log
GROUP BY team, season;
