-- Kuluvan kauden ottelut. STG_GAMES sisältää kaudet 2022-27, ja game_id
-- EI ole yksilöllinen kausien yli (1 055 id:tä 2 852 ottelulle), joten
-- pelkkä GAME_ID ei kelpaa pääavaimeksi sille. Tässä se kelpaa.
CREATE OR REPLACE VIEW LIIGA.MODEL.V_GAMES_NOW
  COMMENT = 'Kuluvan kauden ottelut, yksi rivi per ottelu. GAME_ID on yksilöllinen tässä.'
AS
SELECT g.game_id,
       g.season,
       TO_TIMESTAMP_TZ(g.start_ts) AS start_ts_utc,
       TO_DATE(CONVERT_TIMEZONE('Europe/Helsinki', TO_TIMESTAMP_TZ(g.start_ts))) AS game_date,
       TO_CHAR(CONVERT_TIMEZONE('Europe/Helsinki', TO_TIMESTAMP_TZ(g.start_ts)), 'HH24:MI') AS start_time_fi,
       g.home_team, g.away_team, g.ended,
       g.home_goals, g.away_goals,
       g.result_category,
       CASE WHEN NOT g.ended THEN NULL
            WHEN g.winner = 'home' THEN g.home_team ELSE g.away_team END AS winner_team,
       g.home_points, g.away_points,
       g.home_xg, g.away_xg,
       g.home_pp_goals, g.away_pp_goals, g.home_pp_instances, g.away_pp_instances,
       g.spectators
FROM LIIGA.MODEL.STG_GAMES g
WHERE g.season = (SELECT MAX(season) FROM LIIGA.MODEL.STG_GAMES);


