-- Pelaajan Liiga-kaudet 2021-22 alkaen (6.11.2026). Agentti ei nähnyt pelaajien
-- aiempia kausia lainkaan -- vain kuluvan (V_PLAYER_SEASON_NOW) ja mallin nykyisen
-- ennusteen (PLAYER_RATES) -- vaikka malli rakentuu juuri niistä. Yksi rivi per
-- pelaaja, kausi ja joukkue (kesken kauden siirtynyt = kaksi riviä).
--
-- Maalit kuten V_PLAYER_SEASON_NOW: tapahtumista ilman voittolaukausmaaleja
-- (is_shootout, VL jaksossa 5 -- ne eivät ole pelaajan maaleja), epäonnistuneita
-- rangaistuslaukauksia (RL0) ja videolla hylättyjä (VT0). Syötöt
-- PLAYER_SEASON_SCORINGista; sen omaa goals-saraketta ei käytetä, koska se laskee
-- RL0:t maaleiksi (docs/claude/data.md, avoin bugi mallin syötteessä).
-- Aiemmilta kausilta EI ole kokoonpanoja (RAW.GAME_LINEUPS vain kuluva kausi),
-- joten tahti on per JOUKKUEEN ottelu -- sama mittari jolla malli pelaajat laskee.
-- Mallin pelaajaennuste (PLAYER_RATES_UNIFIED) ja jäädytetty esikauden odotus
-- toistuvat pelaajan jokaisella rivillä.
CREATE OR REPLACE VIEW LIIGA.MODEL.V_PLAYER_SEASONS
  COMMENT = 'Pelaajan Liiga-kaudet 2021-22 alkaen: maalit, syötöt, pisteet ja tahti joukkueen ottelua kohden, sekä mallin pelaajaennuste ja sen pohja.'
AS
WITH cur AS (SELECT MAX(season) AS s FROM LIIGA.MODEL.STG_GAMES),
goals AS (
  SELECT e.season, e.player_id, e.team, COUNT(*) AS goals
  FROM LIIGA.RAW.RAW_GOAL_EVENTS e
  WHERE e.player_id <> 0
    AND NOT COALESCE(e.is_shootout, FALSE)
    AND COALESCE(e.goal_types, '') NOT LIKE '%RL0%'
    AND COALESCE(e.goal_types, '') NOT LIKE '%VT0%'
  GROUP BY e.season, e.player_id, e.team),
names AS (
  -- Uusimman kauden nimi; vanhoissa kausissa nimet ovat versaalilla.
  SELECT player_id,
         MAX_BY(first_name || ' ' || last_name, season) AS nm
  FROM LIIGA.MODEL.PLAYER_SEASON_SCORING GROUP BY player_id),
model AS (
  SELECT player_id, MAX(projected_points_per_game) AS ppg, MAX(n_seasons) AS n_seasons,
         MAX(rate_source) AS rate_source
  FROM LIIGA.MODEL.PLAYER_RATES_UNIFIED WHERE player_id IS NOT NULL GROUP BY player_id),
pre AS (
  SELECT player_id, MAX(ppg) AS ppg
  FROM LIIGA.RAW.PRESEASON_PLAYER_RATES WHERE player_id IS NOT NULL GROUP BY player_id)
SELECT s.player_id,
       IFF(n.nm = UPPER(n.nm), INITCAP(n.nm), n.nm) AS player_name,
       s.season,
       (s.season - 1)::STRING || '-' || RIGHT(s.season::STRING, 2) AS season_label,
       s.season = (SELECT s FROM cur) AS is_current_season,
       s.team,
       COALESCE(g.goals, 0) AS goals,
       COALESCE(s.assists, 0) AS assists,
       COALESCE(g.goals, 0) + COALESCE(s.assists, 0) AS points,
       s.team_games,
       (COALESCE(g.goals, 0) + COALESCE(s.assists, 0)) / NULLIF(s.team_games, 0) AS points_per_team_game,
       m.ppg AS model_points_per_game,
       m.n_seasons AS model_seasons_used,
       m.rate_source AS model_source,
       p.ppg AS preseason_points_per_game
FROM LIIGA.MODEL.PLAYER_SEASON_SCORING s
JOIN names n ON n.player_id = s.player_id
LEFT JOIN goals g ON g.season = s.season AND g.player_id = s.player_id AND g.team = s.team
LEFT JOIN model m ON m.player_id = s.player_id
LEFT JOIN pre p ON p.player_id = s.player_id;
