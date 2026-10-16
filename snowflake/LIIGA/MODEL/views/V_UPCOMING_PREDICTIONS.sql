-- Tulevat ottelut viimeisimmällä ennusteella. Agentin ei tarvitse itse
-- etsiä MAX(snapshot_date):a 50 000 rivin historiasta -- se oli
-- yleisin syy pitkiin, monivaiheisiin kyselyihin.
CREATE OR REPLACE VIEW LIIGA.MODEL.V_UPCOMING_PREDICTIONS
  COMMENT = 'Pelaamattomat ottelut ja niiden voittotodennäköisyydet uusimmasta ennusteesta.'
AS
WITH last AS (SELECT MAX(snapshot_date) AS d FROM LIIGA.MODEL.PREDICTION_GAMES)
SELECT g.game_id, g.game_date, g.start_time_fi, g.home_team, g.away_team,
       p.p_home_win, 1 - p.p_home_win AS p_away_win,
       p.p_home_reg AS p_home_regulation_win, p.p_away_reg AS p_away_regulation_win,
       p.p_overtime,
       IFF(p.p_home_win >= 0.5, g.home_team, g.away_team) AS predicted_winner,
       GREATEST(p.p_home_win, 1 - p.p_home_win) AS confidence,
       p.snapshot_date AS prediction_date,
       -- Ottelukohtainen maaliodottama mallin Poisson-osasta (model.matchup_probs):
       -- liigan keskiarvo 2,9 x hyökkäys x vastustajan puolustus (x kotietu 1,08).
       -- Sama kaava kuin simulaattorissa; vakiot testattu config.yaml:ia vasten.
       2.9 * sh.off_rating * sa.def_rating * 1.08 AS expected_goals_home,
       2.9 * sa.off_rating * sh.def_rating AS expected_goals_away
FROM LIIGA.MODEL.V_GAMES_NOW g
JOIN LIIGA.MODEL.PREDICTION_GAMES p
  ON p.game_id = g.game_id AND p.snapshot_date = (SELECT d FROM last)
LEFT JOIN LIIGA.MODEL.TEAM_STRENGTH sh ON sh.team = g.home_team
LEFT JOIN LIIGA.MODEL.TEAM_STRENGTH sa ON sa.team = g.away_team
WHERE NOT g.ended;


