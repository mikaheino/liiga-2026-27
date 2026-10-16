-- Sama esikatselu valmiiksi muotoiltuina suomenkielisinä riveinä. Agentti
-- kopioi rivit sellaisenaan: 20 nimetöntä saraketta rivissä sai sen poimimaan
-- väärän luvun (Jukurit 2. ja Kärpät 5. ristiin, 10.10.), ja valmis teksti on
-- myös lyhyempi vastata. Desimaalipilkku ja oikea miinusmerkki tehdään tässä.
CREATE OR REPLACE VIEW LIIGA.MODEL.V_ROUND_PREVIEW_TEXT
  COMMENT = 'Kierroksen esikatselu valmiina suomenkielisinä riveinä, yksi rivi per ottelu.'
AS
WITH f AS (
  SELECT p.*,
         REPLACE(TO_CHAR(p.p_home_win * 100, 'FM990.0'), '.', ',') AS ph,
         REPLACE(TO_CHAR(p.p_away_win * 100, 'FM990.0'), '.', ',') AS pa,
         REPLACE(TO_CHAR(p.p_overtime * 100, 'FM990.0'), '.', ',') AS po,
         REPLACE(REPLACE(TO_CHAR(p.home_goalie_saved_vs_avg, 'FMS990.0'), '.', ','), '-', '−') AS gh,
         REPLACE(REPLACE(TO_CHAR(p.away_goalie_saved_vs_avg, 'FMS990.0'), '.', ','), '-', '−') AS ga
  FROM LIIGA.MODEL.V_ROUND_PREVIEW p)
SELECT game_id, game_date, start_time_fi, home_team, away_team,
       start_time_fi || ' ' || home_team || ' – ' || away_team AS ottelu,
       'Ennuste: ' || home_team || ' ' || ph || ' % · ' || away_team || ' ' || pa
         || ' % (jatkoaika ' || po || ' %)' AS ennuste,
       'Tilanne: ' || home_team || ' ' || home_rank || '. (' || home_points || ' p, vire '
         || home_last5_points || '/15) · ' || away_team || ' ' || away_rank || '. ('
         || away_points || ' p, vire ' || away_last5_points || '/15)' AS tilanne,
       'Todennäköiset maalivahdit: ' || COALESCE(home_likely_goalie, '?')
         || COALESCE(' (' || gh || ')', '') || ' – ' || COALESCE(away_likely_goalie, '?')
         || COALESCE(' (' || ga || ')', '') AS maalivahdit,
       IFF(meetings_this_season > 0,
           'Keskinäiset tällä kaudella: ' || home_team || ' ' || h2h_home_team_wins
             || '–' || h2h_away_team_wins || ' ' || away_team, NULL) AS keskinaiset,
       IFF(confidence < 0.55, 'tasainen', predicted_winner) AS suosikki,
       ROUND(confidence * 100, 1) AS suosikin_pct,
       home_last5_points - away_last5_points AS vire_ero
FROM f;

