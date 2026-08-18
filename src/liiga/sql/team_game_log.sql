-- Long format: exactly two rows per played game (one per team), with the
-- team's goals for/against, points, and home flag. Basis for team-season
-- aggregates and the Elo / team-history component.
CREATE OR REPLACE TABLE team_game_log AS
SELECT game_id, season, game_week, start_ts,
       home_team AS team, away_team AS opponent, TRUE  AS is_home,
       home_goals AS goals_for, away_goals AS goals_against,
       home_points AS points, home_win AS won, result_category
FROM stg_games WHERE ended
UNION ALL
SELECT game_id, season, game_week, start_ts,
       away_team AS team, home_team AS opponent, FALSE AS is_home,
       away_goals AS goals_for, home_goals AS goals_against,
       away_points AS points, (1 - home_win) AS won, result_category
FROM stg_games WHERE ended;
