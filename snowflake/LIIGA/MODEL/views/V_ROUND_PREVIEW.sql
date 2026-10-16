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


