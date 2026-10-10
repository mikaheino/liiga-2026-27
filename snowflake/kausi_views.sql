-- Näkymät semanttisille malleille LIIGA_KAUSI_SV (toteuma + mallin osuvuus)
-- ja LIIGA_ENNUSTAJA_SV (vyöhyketodennäköisyydet, kuluvan kauden ottelut).
--
-- Näkymiä, ei tauluja: notebook LIIGA_DAILY korvaa pohjataulut joka aamu
-- (CREATE OR REPLACE TABLE), ja näkymä nimellä viitattuna seuraa mukana.
-- Siksi mitään ei tarvitse ajastaa eikä mikään voi jäädä jälkeen.
--
-- Kaikki logiikka toistaa sovelluksen ja diojen laskennan (CLAUDE.md):
--   * sarjajärjestys pisteet -> maaliero -> tehdyt maalit (liiga.fi)
--   * ottelun ennuste = viimeisin snapshot ottelupäivänä tai ennen sitä
--     (sama ehto kuin streamlit_app.py, joten osumaprosentti täsmää)
--   * esikauden ennuste = viimeisin snapshot jossa games_played = 0
--   * RL0 (epäonnistunut rangaistuslaukaus) EI ole maali
--   * maalivahti: omat päästetyt vain yksin pelatuista otteluista
--
-- Aja: snow sql -c CONTAINER_SERVICES --role ACCOUNTADMIN -f snowflake/kausi_views.sql
-- (ACCOUNTADMIN omistaa pohjataulut -- sync luo ne sillä -- eikä SYSADMIN
-- saa luoda näkymiä LIIGA.MODELiin.)
-- (ei Scripting-lohkoja, joten -f toimii).

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


-- Kenttäpelaajat kuluvalla kaudella.
CREATE OR REPLACE VIEW LIIGA.MODEL.V_PLAYER_SEASON_NOW
  COMMENT = 'Kenttäpelaajan kausi nyt: ottelut kokoonpanoista, maalit ilman epäonnistuneita rangaistuslaukauksia, ero esikauden ennusteeseen.'
AS
WITH cur AS (SELECT MAX(season) AS s FROM LIIGA.MODEL.STG_GAMES),
gp AS (
  SELECT l.player_id,
         MAX(l.first_name) AS first_name, MAX(l.last_name) AS last_name,
         MAX(l.team) AS team, MAX(l.position_group) AS position_group,
         COUNT(DISTINCT l.game_id) AS games_played
  FROM LIIGA.RAW.GAME_LINEUPS l
  JOIN LIIGA.MODEL.V_GAMES_NOW g ON g.game_id = l.game_id AND g.ended
  WHERE l.season = (SELECT s FROM cur) AND l.position_group <> 'G'
    AND NOT COALESCE(l.removed, FALSE)
  GROUP BY l.player_id),
goals AS (
  SELECT e.player_id,
         COUNT(*) AS goals,
         COUNT_IF(e.is_powerplay) AS pp_goals,
         COUNT_IF(e.is_winning_goal) AS game_winning_goals
  FROM LIIGA.RAW.RAW_GOAL_EVENTS e
  WHERE e.season = (SELECT s FROM cur) AND e.player_id <> 0
    AND COALESCE(e.goal_types, '') NOT LIKE '%RL0%'
    AND COALESCE(e.goal_types, '') NOT LIKE '%VT0%'
  GROUP BY e.player_id),
pss AS (SELECT player_id, assists FROM LIIGA.MODEL.PLAYER_SEASON_SCORING
        WHERE season = (SELECT s FROM cur)),
pre_id AS (SELECT player_id, ppg FROM LIIGA.RAW.PRESEASON_PLAYER_RATES
           WHERE player_id IS NOT NULL),
pre_nm AS (SELECT LOWER(name) AS nm, team, ppg FROM LIIGA.RAW.PRESEASON_PLAYER_RATES)
SELECT gp.player_id,
       gp.first_name || ' ' || gp.last_name AS player_name,
       gp.last_name, gp.team,
       IFF(gp.position_group = 'D', 'Puolustaja', 'Hyökkääjä') AS position,
       gp.games_played,
       COALESCE(gl.goals, 0) AS goals,
       COALESCE(s.assists, 0) AS assists,
       COALESCE(gl.goals, 0) + COALESCE(s.assists, 0) AS points,
       (COALESCE(gl.goals, 0) + COALESCE(s.assists, 0)) / NULLIF(gp.games_played, 0) AS points_per_game,
       COALESCE(gl.pp_goals, 0) AS pp_goals,
       COALESCE(gl.game_winning_goals, 0) AS game_winning_goals,
       COALESCE(pi.ppg, pn.ppg) AS preseason_points_per_game,
       COALESCE(pi.ppg, pn.ppg) * gp.games_played AS preseason_expected_points,
       COALESCE(gl.goals, 0) + COALESCE(s.assists, 0)
         - COALESCE(pi.ppg, pn.ppg) * gp.games_played AS points_vs_preseason
FROM gp
LEFT JOIN goals gl ON gl.player_id = gp.player_id
LEFT JOIN pss s ON s.player_id = gp.player_id
LEFT JOIN pre_id pi ON pi.player_id = gp.player_id
LEFT JOIN pre_nm pn ON pn.nm = LOWER(gp.first_name || ' ' || gp.last_name)
                   AND pn.team = gp.team;


-- Maalivahdit kuluvalla kaudella. Vertailut vain otteluista, joissa pelasi
-- yksi maalivahti (peliaikaa ei ole, joten jaettua ottelua ei voi jakaa).
CREATE OR REPLACE VIEW LIIGA.MODEL.V_GOALIE_SEASON_NOW
  COMMENT = 'Maalivahdin kausi nyt: päästetyt vs. keskivertomaalivahti ja vs. oma esikauden torjuntaennuste samoista maalipaikoista.'
AS
WITH cur AS (SELECT MAX(season) AS s FROM LIIGA.MODEL.STG_GAMES),
gg AS (SELECT * FROM LIIGA.RAW.GAME_GOALIES
       WHERE season = (SELECT s FROM cur) AND played),
solo AS (SELECT game_id, team FROM gg GROUP BY game_id, team HAVING COUNT(*) = 1),
s AS (
  SELECT g.player_id, g.team, g.goals_against, l.xg_against
  FROM gg g
  JOIN solo o ON o.game_id = g.game_id AND o.team = g.team
  JOIN LIIGA.MODEL.TEAM_GAME_LOG l
    ON l.season = g.season AND l.game_id = g.game_id AND l.team = g.team),
scale AS (SELECT SUM(goals_against) / NULLIF(SUM(xg_against), 0) AS r FROM s),
tot AS (
  SELECT player_id, MAX(first_name) AS first_name, MAX(last_name) AS last_name,
         MAX(team) AS team, COUNT(*) AS games_played, COUNT_IF(started) AS starts
  FROM gg GROUP BY player_id),
agg AS (SELECT player_id, COUNT(*) AS solo_games, SUM(goals_against) AS goals_against,
               SUM(xg_against) AS xg_against FROM s GROUP BY player_id),
pre AS (SELECT LOWER(name) AS nm, team, proj_save_pct
        FROM LIIGA.RAW.PRESEASON_PLAYER_RATES WHERE position_group = 'G')
SELECT t.player_id, t.first_name || ' ' || t.last_name AS goalie_name, t.last_name,
       t.team, t.games_played, t.starts,
       a.solo_games, a.goals_against, a.xg_against,
       a.goals_against / NULLIF(a.solo_games, 0) AS goals_against_per_game,
       a.xg_against * (SELECT r FROM scale) AS expected_ga_average_goalie,
       a.xg_against * (SELECT r FROM scale) - a.goals_against AS goals_saved_vs_average,
       p.proj_save_pct AS preseason_save_pct,
       a.xg_against * (SELECT r FROM scale) * (1 - p.proj_save_pct) / (1 - 0.908)
         AS expected_ga_own_projection,
       a.xg_against * (SELECT r FROM scale) * (1 - p.proj_save_pct) / (1 - 0.908)
         - a.goals_against AS goals_saved_vs_preseason
FROM tot t
LEFT JOIN agg a ON a.player_id = t.player_id
LEFT JOIN pre p ON p.nm = LOWER(t.first_name || ' ' || t.last_name) AND p.team = t.team;


-- Ennusteen sijavyöhykkeet (ENNUSTAJA_SV). 1.-6. suoraan puolivälieriin,
-- 7.-10. karsintaan, 15.-17. putoaa B-sarjaan (uutta 2026-27).
CREATE OR REPLACE VIEW LIIGA.MODEL.V_ZONE_PROBABILITIES
  COMMENT = 'Ennusteen todennäköisyys kullekin sarjavyöhykkeelle 10 000 simulaatiosta.'
AS
SELECT team,
       rank_1 AS p_regular_season_win,
       rank_1 + rank_2 + rank_3 + rank_4 + rank_5 + rank_6 AS p_top6_quarterfinal,
       rank_7 + rank_8 + rank_9 + rank_10 AS p_7_10_playoff_qualifier,
       rank_1 + rank_2 + rank_3 + rank_4 + rank_5 + rank_6
         + rank_7 + rank_8 + rank_9 + rank_10 AS p_playoffs_any,
       rank_11 + rank_12 + rank_13 + rank_14 AS p_11_14_out,
       rank_15 + rank_16 + rank_17 AS p_relegation_15_17
FROM LIIGA.MODEL.POSITION_DISTRIBUTION_2026_27;


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
       p.snapshot_date AS prediction_date
FROM LIIGA.MODEL.V_GAMES_NOW g
JOIN LIIGA.MODEL.PREDICTION_GAMES p
  ON p.game_id = g.game_id AND p.snapshot_date = (SELECT d FROM last)
WHERE NOT g.ended;


-- Kunkin joukkueen viimeisimmän pelatun ottelun kokoonpano, maalivahdit
-- mukaan lukien. Todennäköisin kokoonpano seuraavaan otteluun.
CREATE OR REPLACE VIEW LIIGA.MODEL.V_LATEST_LINEUPS
  COMMENT = 'Joukkueen viimeisimmän pelatun ottelun kokoonpano: ketju, pelipaikka, pelaaja. Maalivahdilla started = aloitti.'
AS
WITH last AS (
  SELECT team, game_id, game_date, opponent FROM (
    SELECT g.home_team AS team, g.game_id, g.game_date, g.away_team AS opponent
    FROM LIIGA.MODEL.V_GAMES_NOW g WHERE g.ended
    UNION ALL
    SELECT g.away_team, g.game_id, g.game_date, g.home_team
    FROM LIIGA.MODEL.V_GAMES_NOW g WHERE g.ended)
  QUALIFY ROW_NUMBER() OVER (PARTITION BY team ORDER BY game_date DESC, game_id DESC) = 1)
SELECT l.team, la.game_date, la.opponent,
       l.line,
       CASE l.role WHEN 'CENTER' THEN 'Keskushyökkääjä' WHEN 'LEFT_WING' THEN 'Vasen laitahyökkääjä'
                   WHEN 'RIGHT_WING' THEN 'Oikea laitahyökkääjä' WHEN 'LEFT_DEFENSEMAN' THEN 'Vasen puolustaja'
                   WHEN 'RIGHT_DEFENSEMAN' THEN 'Oikea puolustaja' WHEN 'GOALIE' THEN 'Maalivahti'
                   WHEN 'STRIKER' THEN 'Hyökkääjä' WHEN 'DEFENSEMAN' THEN 'Puolustaja'
                   WHEN 'THIRTEENTH_STRIKER' THEN '13. hyökkääjä'
                   WHEN 'FOURTEENTH_STRIKER' THEN '14. hyökkääjä'
                   WHEN 'SEVENTH_DEFENSEMAN' THEN '7. puolustaja'
                   WHEN 'EIGHTH_DEFENSEMAN' THEN '8. puolustaja'
                   ELSE l.role END AS role_fi,
       l.position_group,
       l.first_name || ' ' || l.last_name AS player_name,
       l.jersey, l.captain, l.alternate_captain,
       gg.started AS goalie_started
FROM last la
JOIN LIIGA.RAW.GAME_LINEUPS l ON l.game_id = la.game_id AND l.team = la.team
LEFT JOIN LIIGA.RAW.GAME_GOALIES gg
       ON gg.game_id = l.game_id AND gg.player_id = l.player_id
WHERE NOT COALESCE(l.removed, FALSE);


-- Kierroksen esikatselu yhdellä rivillä per ottelu: ennuste, molempien
-- joukkueiden tilanne ja vire, todennäköinen maalivahti ja keskinäiset
-- ottelut tällä kaudella. Agentin skill "kierroksen-esikatselu" lukee tämän
-- yhdellä kutsulla -- ilman näkymää se vaatisi 3-4 kutsua kahteen malliin.
CREATE OR REPLACE VIEW LIIGA.MODEL.V_ROUND_PREVIEW
  COMMENT = 'Tulevat ottelut esikatseluna: ennuste, joukkueiden sija/pisteet/vire, todennäköinen maalivahti ja keskinäiset ottelut.'
AS
WITH gk AS (
  SELECT l.team, l.player_name AS goalie_name, g.goals_saved_vs_average, g.solo_games
  FROM LIIGA.MODEL.V_LATEST_LINEUPS l
  LEFT JOIN LIIGA.MODEL.V_GOALIE_SEASON_NOW g
         ON g.team = l.team AND g.goalie_name = l.player_name
  WHERE l.position_group = 'G' AND l.goalie_started
  QUALIFY ROW_NUMBER() OVER (PARTITION BY l.team ORDER BY l.player_name) = 1),
h2h AS (
  SELECT u.game_id,
         COUNT(g.game_id) AS meetings,
         COUNT_IF(g.winner_team = u.home_team) AS home_team_wins,
         COUNT_IF(g.winner_team = u.away_team) AS away_team_wins
  FROM LIIGA.MODEL.V_UPCOMING_PREDICTIONS u
  LEFT JOIN LIIGA.MODEL.V_GAMES_NOW g
         ON g.ended AND ((g.home_team = u.home_team AND g.away_team = u.away_team)
                      OR (g.home_team = u.away_team AND g.away_team = u.home_team))
  GROUP BY u.game_id)
SELECT u.game_id, u.game_date, u.start_time_fi, u.home_team, u.away_team,
       u.p_home_win, u.p_away_win, u.p_overtime, u.predicted_winner, u.confidence,
       th.table_rank AS home_rank, th.points AS home_points, th.games_played AS home_games,
       th.last5_points AS home_last5_points, th.goal_diff AS home_goal_diff,
       ta.table_rank AS away_rank, ta.points AS away_points, ta.games_played AS away_games,
       ta.last5_points AS away_last5_points, ta.goal_diff AS away_goal_diff,
       gh.goalie_name AS home_likely_goalie, gh.goals_saved_vs_average AS home_goalie_saved_vs_avg,
       ga.goalie_name AS away_likely_goalie, ga.goals_saved_vs_average AS away_goalie_saved_vs_avg,
       h.meetings AS meetings_this_season, h.home_team_wins AS h2h_home_team_wins,
       h.away_team_wins AS h2h_away_team_wins
FROM LIIGA.MODEL.V_UPCOMING_PREDICTIONS u
LEFT JOIN LIIGA.MODEL.V_TEAM_SEASON_NOW th ON th.team = u.home_team
LEFT JOIN LIIGA.MODEL.V_TEAM_SEASON_NOW ta ON ta.team = u.away_team
LEFT JOIN gk gh ON gh.team = u.home_team
LEFT JOIN gk ga ON ga.team = u.away_team
LEFT JOIN h2h h ON h.game_id = u.game_id;


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
