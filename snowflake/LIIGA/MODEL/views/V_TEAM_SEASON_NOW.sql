-- Joukkueet tällä hetkellä: oikea sarjataulukko, vire, xG,
-- varjosarjataulukko ja ero esikauden ennusteeseen.
CREATE OR REPLACE VIEW LIIGA.MODEL.V_TEAM_SEASON_NOW
  COMMENT = 'Joukkueen toteutunut kausi nyt: sarjasija, pisteet, maalit, xG, varjosarjataulukko, vire ja ero esikauden ennusteeseen.'
AS
WITH cur AS (SELECT MAX(season) AS s FROM LIIGA.MODEL.STG_GAMES),
teams AS (SELECT DISTINCT team FROM LIIGA.RAW.ROSTER_2026_27),
log AS (
  SELECT l.*, ROW_NUMBER() OVER (PARTITION BY l.team ORDER BY l.start_ts DESC) AS rn
  FROM LIIGA.MODEL.TEAM_GAME_LOG l WHERE l.season = (SELECT s FROM cur)),
k AS (SELECT ROW_NUMBER() OVER (ORDER BY SEQ4()) - 1 AS k
      FROM TABLE(GENERATOR(ROWCOUNT => 13))),
-- Odotetut pisteet maalipaikoista: Poisson kummallekin, voitto 3, tasan 1,5.
shadow AS (
  SELECT l.game_id, l.team,
         SUM(CASE WHEN a.k > b.k THEN 3 WHEN a.k = b.k THEN 1.5 ELSE 0 END
             * EXP(-l.xg_for) * POWER(l.xg_for, a.k) / FACTORIAL(a.k)
             * EXP(-l.xg_against) * POWER(l.xg_against, b.k) / FACTORIAL(b.k)) AS xpts
  FROM log l CROSS JOIN k a CROSS JOIN k b
  WHERE l.xg_for IS NOT NULL AND l.xg_against IS NOT NULL
  GROUP BY l.game_id, l.team),
pre AS (SELECT MAX(snapshot_date) AS d FROM LIIGA.MODEL.PREDICTION_HISTORY WHERE games_played = 0),
pg AS (SELECT p.* FROM LIIGA.MODEL.PREDICTION_GAMES p WHERE p.snapshot_date = (SELECT d FROM pre)),
expect AS (
  SELECT g.home_team AS team, g.game_id,
         3 * pg.p_home_reg + 2 * pg.p_overtime * pg.p_home_ot_win
           + pg.p_overtime * (1 - pg.p_home_ot_win) AS xp
  FROM LIIGA.MODEL.V_GAMES_NOW g JOIN pg ON pg.game_id = g.game_id WHERE g.ended
  UNION ALL
  SELECT g.away_team, g.game_id,
         3 * pg.p_away_reg + 2 * pg.p_overtime * (1 - pg.p_home_ot_win)
           + pg.p_overtime * pg.p_home_ot_win
  FROM LIIGA.MODEL.V_GAMES_NOW g JOIN pg ON pg.game_id = g.game_id WHERE g.ended),
agg AS (
  SELECT t.team,
         COUNT(l.game_id) AS games_played,
         COALESCE(SUM(l.points), 0) AS points,
         COUNT_IF(l.points = 3) AS regulation_wins,
         COUNT_IF(l.points = 2) AS overtime_wins,
         COUNT_IF(l.points = 1) AS overtime_losses,
         COUNT_IF(l.points = 0) AS regulation_losses,
         COALESCE(SUM(l.goals_for), 0) AS goals_for,
         COALESCE(SUM(l.goals_against), 0) AS goals_against,
         SUM(l.xg_for) AS xg_for,
         SUM(l.xg_against) AS xg_against,
         SUM(IFF(l.rn <= 5, l.points, NULL)) AS last5_points,
         SUM(IFF(l.is_home, l.points, NULL)) AS home_points,
         SUM(IFF(NOT l.is_home, l.points, NULL)) AS away_points,
         SUM(l.pp_goals) AS pp_goals, SUM(l.pp_instances) AS pp_instances,
         SUM(l.pp_goals_against) AS pp_goals_against, SUM(l.sh_instances) AS sh_instances
  FROM teams t LEFT JOIN log l ON l.team = t.team
  GROUP BY t.team)
SELECT a.team,
       RANK() OVER (ORDER BY a.points DESC, a.goals_for - a.goals_against DESC,
                             a.goals_for DESC) AS table_rank,
       a.games_played, a.points,
       a.regulation_wins, a.overtime_wins, a.overtime_losses, a.regulation_losses,
       a.goals_for, a.goals_against, a.goals_for - a.goals_against AS goal_diff,
       a.points / NULLIF(a.games_played, 0) AS points_per_game,
       a.last5_points, a.home_points, a.away_points,
       a.xg_for, a.xg_against, a.xg_for - a.xg_against AS xg_diff,
       a.goals_for - a.xg_for AS finishing_over_xg,
       s.shadow_points,
       a.points - s.shadow_points AS points_over_shadow,
       e.preseason_expected_points,
       a.points - e.preseason_expected_points AS points_vs_preseason,
       a.pp_goals / NULLIF(a.pp_instances, 0) AS pp_pct,
       1 - a.pp_goals_against / NULLIF(a.sh_instances, 0) AS pk_pct,
       -- Summat mukana, jotta liigatason prosentti lasketaan SUM/SUM eikä
       -- joukkueprosenttien keskiarvona (semanttisen mallin metriikat).
       a.pp_goals, a.pp_instances, a.pp_goals_against, a.sh_instances
FROM agg a
LEFT JOIN (SELECT team, SUM(xpts) AS shadow_points FROM shadow GROUP BY team) s
       ON s.team = a.team
LEFT JOIN (SELECT team, SUM(xp) AS preseason_expected_points FROM expect GROUP BY team) e
       ON e.team = a.team;


