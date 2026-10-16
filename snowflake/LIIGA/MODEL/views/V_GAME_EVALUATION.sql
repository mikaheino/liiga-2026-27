-- Jokainen pelattu ottelu sitä ennustetta vasten, joka annettiin ennen
-- kiekon pudotusta.
CREATE OR REPLACE VIEW LIIGA.MODEL.V_GAME_EVALUATION
  COMMENT = 'Pelatut ottelut vs. mallin viimeisin ennuste ennen ottelua: osuma, log-loss, Brier, vertailu aina kotijoukkue -tasoon.'
AS
WITH g AS (SELECT * FROM LIIGA.MODEL.V_GAMES_NOW WHERE ended),
p AS (
  SELECT g.game_id, MAX(p.snapshot_date) AS snapshot_date
  FROM g JOIN LIIGA.MODEL.PREDICTION_GAMES p
    ON p.game_id = g.game_id AND p.snapshot_date <= TO_CHAR(g.game_date, 'YYYY-MM-DD')
  GROUP BY g.game_id)
SELECT g.game_id, g.game_date, g.home_team, g.away_team,
       g.home_goals, g.away_goals, g.result_category, g.winner_team,
       p.snapshot_date AS prediction_date,
       pg.p_home_win AS p_home_win,
       1 - pg.p_home_win AS p_away_win,
       pg.p_overtime AS p_overtime,
       CASE WHEN pg.p_home_win >= 0.5 THEN g.home_team ELSE g.away_team END AS predicted_winner,
       IFF(g.winner_team = g.home_team, pg.p_home_win, 1 - pg.p_home_win) AS p_given_to_winner,
       IFF(IFF(pg.p_home_win >= 0.5, g.home_team, g.away_team) = g.winner_team, 1, 0) AS model_correct,
       IFF(g.winner_team = g.home_team, 1, 0) AS home_team_won,
       GREATEST(pg.p_home_win, 1 - pg.p_home_win) AS model_confidence,
       -LN(GREATEST(IFF(g.winner_team = g.home_team, pg.p_home_win, 1 - pg.p_home_win), 1e-6)) AS log_loss,
       POWER(pg.p_home_win - IFF(g.winner_team = g.home_team, 1, 0), 2) AS brier
FROM g
JOIN p ON p.game_id = g.game_id
JOIN LIIGA.MODEL.PREDICTION_GAMES pg
  ON pg.game_id = p.game_id AND pg.snapshot_date = p.snapshot_date;


