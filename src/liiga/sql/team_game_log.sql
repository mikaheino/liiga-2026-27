-- Long format: exactly two rows per played game (one per team), with the
-- team's goals for/against, points, and home flag. Basis for team-season
-- aggregates and the Elo / team-history component.
CREATE OR REPLACE TABLE team_game_log AS
SELECT game_id, season, game_week, start_ts,
       home_team AS team, away_team AS opponent, TRUE  AS is_home,
       home_goals AS goals_for, away_goals AS goals_against,
       home_points AS points, home_win AS won, result_category,
       home_xg AS xg_for, away_xg AS xg_against,
       home_pp_goals AS pp_goals, home_pp_instances AS pp_instances,
       home_sh_goals AS sh_goals, home_sh_instances AS sh_instances,
       -- Goals conceded while short-handed = what the opponent scored on the
       -- power play. That is the numerator of the penalty-kill percentage.
       away_pp_goals AS pp_goals_against
FROM stg_games WHERE ended
UNION ALL
SELECT game_id, season, game_week, start_ts,
       away_team AS team, home_team AS opponent, FALSE AS is_home,
       away_goals AS goals_for, home_goals AS goals_against,
       away_points AS points, (1 - home_win) AS won, result_category,
       away_xg AS xg_for, home_xg AS xg_against,
       away_pp_goals AS pp_goals, away_pp_instances AS pp_instances,
       away_sh_goals AS sh_goals, away_sh_instances AS sh_instances,
       home_pp_goals AS pp_goals_against
FROM stg_games WHERE ended;
