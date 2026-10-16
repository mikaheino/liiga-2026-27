-- Miksi ennuste muuttui? (2026-10-16). Joukkueen ennustettujen loppupisteiden
-- muutos jaettuna kolmeen osaan, kolmella aikaikkunalla:
--   ESIKAUSI   julkaistuun esikauden ennusteeseen (games_played = 0)
--   VIIKKO     viimeisimpään ennusteeseen viikko sitten tai aiemmin
--   EDELLINEN  edelliseen päivittäiseen ajoon
-- Osat summautuvat rakenteen vuoksi täsmälleen kokonaismuutokseen:
--   RESULTS_VS_EXPECTED  ikkunassa pelattujen otteluiden pisteet miinus se,
--                        mitä vertailuhetken ennuste odotti JUURI NIISTÄ
--                        otteluista (prediction_games, 3/2/1/0)
--   ROSTER_CHANGES       kokoonpanomuutosten vaikutus (ROSTER_IMPACT: sama
--                        esikauden malli, vain rosteri vaihtuu), versiot
--                        jotka commitoitiin ikkunan aikana
--   MODEL_REVISION       loput: malli muutti odotustaan JÄLJELLÄ OLEVISTA
--                        otteluista (Elo oppii tuloksista; mukana myös
--                        datakorjaukset ja yleisöpainon hiipuminen)
-- Menetelmä on sama kuin 11.10. LinkedIn-tekstin tarkistuksessa (KooKoo
-- −27,9 = −16,9 tuloksista + −11,0 loppukaudesta).
CREATE OR REPLACE VIEW LIIGA.MODEL.V_FORECAST_CHANGE
  COMMENT = 'Miksi ennuste muuttui: muutos = tulokset vs. odotus + kokoonpanot + mallin uusi arvio, ikkunat ESIKAUSI / VIIKKO / EDELLINEN.'
AS
WITH snaps AS (
  SELECT DISTINCT snapshot_date::DATE AS d, games_played FROM LIIGA.MODEL.PREDICTION_HISTORY),
latest AS (SELECT MAX(d) AS d FROM snaps),
win AS (
  SELECT 'ESIKAUSI' AS comparison, (SELECT MAX(d) FROM snaps WHERE games_played = 0) AS base_d
  UNION ALL
  SELECT 'VIIKKO', (SELECT MAX(d) FROM snaps WHERE d <= (SELECT DATEADD(day, -7, d) FROM latest))
  UNION ALL
  SELECT 'EDELLINEN', (SELECT MAX(d) FROM snaps WHERE d < (SELECT d FROM latest))),
h AS (SELECT snapshot_date::DATE AS d, team, mean_points, proj_rank, p_title
      FROM LIIGA.MODEL.PREDICTION_HISTORY),
-- ikkunassa pelatut: olivat pelaamatta vertailuhetken ennusteessa, nyt pelattu
played AS (
  SELECT w.comparison, s.home_team, s.away_team, s.home_points, s.away_points,
         p.p_home_reg AS h3, p.p_away_reg AS a3,
         p.p_overtime * p.p_home_ot_win AS h2, p.p_overtime * (1 - p.p_home_ot_win) AS a2
  FROM win w
  JOIN LIIGA.MODEL.PREDICTION_GAMES p ON p.snapshot_date::DATE = w.base_d
  JOIN LIIGA.MODEL.STG_GAMES s ON s.season = 2027 AND s.game_id = p.game_id AND s.ended),
per_team AS (
  SELECT comparison, home_team AS team, home_points AS pts, 3*h3 + 2*h2 + a2 AS xp FROM played
  UNION ALL
  SELECT comparison, away_team, away_points, 3*a3 + 2*a2 + h2 FROM played),
res AS (
  SELECT comparison, team, COUNT(*) AS games_in_window, SUM(pts) AS points_earned, SUM(xp) AS points_expected
  FROM per_team GROUP BY comparison, team),
ri AS (SELECT version, date::DATE AS d, team, points FROM LIIGA.MODEL.ROSTER_IMPACT),
ri_at AS (  -- rosteriversion pisteet annettuna päivänä = viimeisin versio siihen mennessä
  SELECT w.comparison, r.team,
         MAX_BY(r.points, IFF(r.d <= w.base_d, r.version, NULL)) AS roster_before,
         MAX_BY(r.points, IFF(r.d <= (SELECT d FROM latest), r.version, NULL)) AS roster_now
  FROM win w CROSS JOIN ri r GROUP BY w.comparison, r.team)
SELECT w.comparison,
       w.base_d AS compared_to_date,
       (SELECT d FROM latest) AS forecast_date,
       n.team,
       b.proj_rank AS rank_before, n.proj_rank AS rank_now,
       ROUND(b.mean_points, 1) AS points_before, ROUND(n.mean_points, 1) AS points_now,
       ROUND(n.mean_points - b.mean_points, 1) AS points_change,
       COALESCE(r.games_in_window, 0) AS games_in_window,
       COALESCE(r.points_earned, 0) AS points_earned,
       ROUND(COALESCE(r.points_expected, 0), 1) AS points_expected,
       ROUND(COALESCE(r.points_earned - r.points_expected, 0), 1) AS results_vs_expected,
       ROUND(COALESCE(a.roster_now - a.roster_before, 0), 1) AS roster_changes,
       ROUND((n.mean_points - b.mean_points) - COALESCE(r.points_earned - r.points_expected, 0)
             - COALESCE(a.roster_now - a.roster_before, 0), 1) AS model_revision,
       ROUND(b.p_title * 100, 1) AS p_title_before_pct, ROUND(n.p_title * 100, 1) AS p_title_now_pct
FROM win w
JOIN h n ON n.d = (SELECT d FROM latest)
JOIN h b ON b.d = w.base_d AND b.team = n.team
LEFT JOIN res r ON r.comparison = w.comparison AND r.team = n.team
LEFT JOIN ri_at a ON a.comparison = w.comparison AND a.team = n.team;
