-- One clean, analysis-ready row per game, with Liiga points for each side.
-- Points (since 2020): regulation win 3 / loss 0; OT or shootout win 2 / loss 1.
-- Portable SQL: works on both DuckDB and Snowflake.
CREATE OR REPLACE TABLE stg_games AS
SELECT
    game_id,
    season,
    game_week,
    start_time                          AS start_ts,
    started,
    ended,
    home_team,
    away_team,
    home_goals,
    away_goals,
    result_category,                    -- regulation / overtime / shootout
    winner,                             -- home / away (NULL if not played)
    CASE WHEN winner = 'home' THEN 1 ELSE 0 END AS home_win,
    -- points awarded
    CASE
        WHEN winner = 'home' AND result_category = 'regulation' THEN 3
        WHEN winner = 'home'                                    THEN 2
        WHEN winner = 'away' AND result_category = 'regulation' THEN 0
        WHEN winner = 'away'                                    THEN 1
    END AS home_points,
    CASE
        WHEN winner = 'away' AND result_category = 'regulation' THEN 3
        WHEN winner = 'away'                                    THEN 2
        WHEN winner = 'home' AND result_category = 'regulation' THEN 0
        WHEN winner = 'home'                                    THEN 1
    END AS away_points,
    spectators,
    -- Straight from the API: expected goals and special-teams counts. Carried
    -- through so team_season can derive PK%, PP% and xG share without
    -- reaching back into raw_games.
    home_xg,
    away_xg,
    home_pp_goals,
    away_pp_goals,
    home_pp_instances,
    away_pp_instances,
    home_sh_goals,
    away_sh_goals,
    home_sh_instances,
    away_sh_instances
FROM raw_games;
