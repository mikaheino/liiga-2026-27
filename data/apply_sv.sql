-- Generated from data/semantic_view_backup.yaml. Do not hand-edit:
-- regenerate instead, or the two drift and re-running this file
-- silently drops whatever the backup has that this one does not.
SELECT SYSTEM$CREATE_SEMANTIC_VIEW_FROM_YAML('LIIGA.MODEL.LIIGA_ENNUSTAJA_SV', $$
name: LIIGA_ENNUSTAJA_SV
description: "Pelaajalähtöinen Monte Carlo -simulaatiomalli Liigan 2026-27 kaudelle. Tarkka (10 000 simulaatiota per ottelu) ja ajantasainen (päivittyvät snapshot-ennusteet). Rajoitteet: vain Liiga ja runkosarja, kokoonpanodata viimeisimmistä peleistä, ei huomioi pelaajasiirtoja automaattisesti."
tables:
  - name: GAME_PREDICTIONS
    description: Per-game win probabilities from Monte Carlo simulation. Join with SCHEDULE on GAME_ID to get game dates and times.
    base_table:
      database: LIIGA
      schema: MODEL
      table: PREDICTION_GAMES
    primary_key:
      columns:
        - GAME_ID
        - SNAPSHOT_DATE
    dimensions:
      - name: AWAY_TEAM
        synonyms:
          - vierasjoukkue
        description: Away team
        expr: AWAY_TEAM
        data_type: VARCHAR(16777216)
        access_modifier: public_access
        is_enum: true
        sample_values:
          - Tappara
          - HIFK
          - Jokerit
          - KooKoo
          - Lukko
      - name: GAME_ID
        description: Game ID
        expr: GAME_ID
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: HOME_TEAM
        synonyms:
          - kotijoukkue
        description: Home team
        expr: HOME_TEAM
        data_type: VARCHAR(16777216)
        access_modifier: public_access
        is_enum: true
        sample_values:
          - Tappara
          - HIFK
          - Jokerit
          - KooKoo
          - Lukko
      - name: SNAPSHOT_DATE
        description: Prediction date
        expr: SNAPSHOT_DATE
        data_type: VARCHAR(16777216)
        access_modifier: public_access
    facts:
      - name: AWAY_REG_WIN_PROB
        description: Away regulation win probability
        expr: P_AWAY_REG
        data_type: FLOAT
        access_modifier: public_access
      - name: HOME_OT_WIN_PROB
        description: Home OT win probability
        expr: P_HOME_OT_WIN
        data_type: FLOAT
        access_modifier: public_access
      - name: HOME_REG_WIN_PROB
        description: Home regulation win probability
        expr: P_HOME_REG
        data_type: FLOAT
        access_modifier: public_access
      - name: HOME_WIN_PROB
        description: Total home win probability
        expr: P_HOME_WIN
        data_type: FLOAT
        access_modifier: public_access
      - name: OVERTIME_PROB
        description: Overtime probability
        expr: P_OVERTIME
        data_type: FLOAT
        access_modifier: public_access
    metrics:
      - name: AVG_HOME_WIN_PROB
        description: Average home win probability
        expr: AVG(P_HOME_WIN)
        access_modifier: public_access
  - name: GOALTENDING
    description: Team goaltending quality
    base_table:
      database: LIIGA
      schema: MODEL
      table: TEAM_GOALTENDING
    primary_key:
      columns:
        - TEAM
    dimensions:
      - name: TEAM
        description: Team
        expr: TEAM
        data_type: VARCHAR(16777216)
        access_modifier: public_access
        is_enum: true
        sample_values:
          - Tappara
          - HIFK
          - Jokerit
          - KooKoo
          - Lukko
    facts:
      - name: GOALIE_MULT
        description: Goalie multiplier
        expr: GOALIE_MULT
        data_type: FLOAT
        access_modifier: public_access
      - name: TEAM_SAVE_PCT
        description: Projected save pct
        expr: TEAM_SAVE_PCT
        data_type: FLOAT
        access_modifier: public_access
  - name: PLAYER_PROJECTIONS
    description: Player goal and point projections for 2026-27
    base_table:
      database: LIIGA
      schema: MODEL
      table: PLAYER_RATES
    dimensions:
      - name: PLAYER_NAME
        synonyms:
          - pelaaja
        description: Player name
        expr: NAME
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: POSITION_GROUP
        synonyms:
          - pelipaikka
        description: "Position: F, D, G"
        expr: POSITION_GROUP
        data_type: VARCHAR(16777216)
        access_modifier: public_access
        is_enum: true
        sample_values:
          - F
          - D
          - G
      - name: RATE_SOURCE
        description: liiga or external
        expr: RATE_SOURCE
        data_type: VARCHAR(16777216)
        access_modifier: public_access
        is_enum: true
        sample_values:
          - liiga
          - external
      - name: TEAM
        synonyms:
          - joukkue
        description: Team
        expr: TEAM
        data_type: VARCHAR(16777216)
        access_modifier: public_access
        is_enum: true
        sample_values:
          - Tappara
          - HIFK
          - Jokerit
          - KooKoo
          - Lukko
    facts:
      - name: PROJECTED_GOALS_PER_GAME
        description: Projected goals per game
        expr: PROJECTED_GOALS_PER_GAME
        data_type: FLOAT
        access_modifier: public_access
      - name: PROJECTED_POINTS_PER_GAME
        description: Projected points per game
        expr: PROJECTED_POINTS_PER_GAME
        data_type: FLOAT
        access_modifier: public_access
    metrics:
      - name: TOTAL_PLAYERS
        description: Player count
        expr: COUNT(*)
        access_modifier: public_access
  - name: PLAYER_SEASON_HISTORY
    description: Historical player scoring by season
    base_table:
      database: LIIGA
      schema: MODEL
      table: PLAYER_SEASON_SCORING
    dimensions:
      - name: FIRST_NAME
        description: First name
        expr: FIRST_NAME
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: LAST_NAME
        description: Last name
        expr: LAST_NAME
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: PLAYER_ID
        description: Player ID
        expr: PLAYER_ID
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: SEASON
        synonyms:
          - kausi
        description: Season year
        expr: SEASON
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: TEAM
        description: Team
        expr: TEAM
        data_type: VARCHAR(16777216)
        access_modifier: public_access
    facts:
      - name: ASSISTS
        description: Assists
        expr: ASSISTS
        data_type: "NUMBER(30,0)"
        access_modifier: public_access
      - name: GOALS
        synonyms:
          - maalit
        description: Goals
        expr: GOALS
        data_type: "NUMBER(30,0)"
        access_modifier: public_access
      - name: GOALS_PER_GAME
        description: Goals per game
        expr: GOALS_PER_TEAM_GAME
        data_type: FLOAT
        access_modifier: public_access
      - name: POINTS
        synonyms:
          - pisteet
        description: Points
        expr: POINTS
        data_type: "NUMBER(31,0)"
        access_modifier: public_access
      - name: POINTS_PER_GAME
        description: Points per game
        expr: POINTS_PER_TEAM_GAME
        data_type: FLOAT
        access_modifier: public_access
      - name: TEAM_GAMES
        description: Team games
        expr: TEAM_GAMES
        data_type: "NUMBER(18,0)"
        access_modifier: public_access
    metrics:
      - name: TOTAL_GOALS
        description: Total goals
        expr: SUM(GOALS)
        access_modifier: public_access
      - name: TOTAL_POINTS
        description: Total points
        expr: SUM(POINTS)
        access_modifier: public_access
  - name: PREDICTION_HISTORY
    description: Prediction snapshots over time
    base_table:
      database: LIIGA
      schema: MODEL
      table: PREDICTION_HISTORY
    dimensions:
      - name: PROJ_RANK
        description: Projected rank
        expr: PROJ_RANK
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: SNAPSHOT_DATE
        description: Snapshot date
        expr: SNAPSHOT_DATE
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: TEAM
        description: Team
        expr: TEAM
        data_type: VARCHAR(16777216)
        access_modifier: public_access
    facts:
      - name: GAMES_PLAYED
        description: Games played when this snapshot was taken
        expr: GAMES_PLAYED
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: MEAN_POINTS
        description: Mean predicted points
        expr: MEAN_POINTS
        data_type: FLOAT
        access_modifier: public_access
      - name: TITLE_PROB
        description: Title probability
        expr: P_TITLE
        data_type: FLOAT
        access_modifier: public_access
      - name: TOP_PLAYOFF_PROB
        description: Top playoff probability
        expr: P_TOP_PLAYOFF
        data_type: FLOAT
        access_modifier: public_access
  - name: SCHEDULE
    description: Full game schedule with dates and times
    base_table:
      database: LIIGA
      schema: MODEL
      table: STG_GAMES
    primary_key:
      columns:
        - GAME_ID
    dimensions:
      - name: GAME_DATE
        synonyms:
          - pelipäivä
          - ottelupäivä
          - päivämäärä
        description: Game date derived from start timestamp. Use TO_DATE(START_TS) to filter games by date. For today's games use WHERE TO_DATE(START_TS) = CURRENT_DATE.
        expr: TO_DATE(START_TS)
        data_type: DATE
        access_modifier: public_access
      - name: START_TS
        synonyms:
          - alkamisaika
          - otteluaika
        description: Game start timestamp as string (YYYY-MM-DDTHH:MM:SS)
        expr: START_TS
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: AWAY_TEAM
        description: Away team
        expr: AWAY_TEAM
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: ENDED
        description: Game ended
        expr: ENDED
        data_type: BOOLEAN
        access_modifier: public_access
      - name: GAME_ID
        description: Game ID
        expr: GAME_ID
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: GAME_WEEK
        description: Game week
        expr: GAME_WEEK
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: HOME_TEAM
        description: Home team
        expr: HOME_TEAM
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: RESULT_CATEGORY
        description: Result type
        expr: RESULT_CATEGORY
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: SEASON
        description: Season
        expr: SEASON
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: WINNER
        description: Winner
        expr: WINNER
        data_type: VARCHAR(16777216)
        access_modifier: public_access
    facts:
      - name: HOME_XG
        synonyms:
          - kotijoukkueen odotetut maalit
          - home expected goals
        description: Expected goals for the home team (liiga.fi model)
        expr: HOME_XG
        data_type: FLOAT
        access_modifier: public_access
      - name: AWAY_XG
        synonyms:
          - vierasjoukkueen odotetut maalit
          - away expected goals
        description: Expected goals for the away team (liiga.fi model)
        expr: AWAY_XG
        data_type: FLOAT
        access_modifier: public_access
      - name: HOME_PP_INSTANCES
        synonyms:
          - kotijoukkueen ylivoimat
        description: Times the home team was on the power play
        expr: HOME_PP_INSTANCES
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: AWAY_PP_INSTANCES
        synonyms:
          - vierasjoukkueen ylivoimat
        description: Times the away team was on the power play
        expr: AWAY_PP_INSTANCES
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: HOME_PP_GOALS
        description: Home team power-play goals
        expr: HOME_PP_GOALS
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: AWAY_PP_GOALS
        description: Away team power-play goals
        expr: AWAY_PP_GOALS
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: AWAY_GOALS
        description: Away goals
        expr: AWAY_GOALS
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: HOME_GOALS
        description: Home goals
        expr: HOME_GOALS
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: SPECTATORS
        description: Spectators
        expr: SPECTATORS
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
    metrics:
      - name: AVG_SPECTATORS
        description: Avg spectators
        expr: AVG(SPECTATORS)
        access_modifier: public_access
      - name: TOTAL_GAMES
        description: Total games
        expr: COUNT(*)
        access_modifier: public_access
  - name: STANDINGS
    description: Predicted standings for 2026-27
    base_table:
      database: LIIGA
      schema: MODEL
      table: STANDINGS_2026_27
    primary_key:
      columns:
        - TEAM
    dimensions:
      - name: PROJECTED_RANK
        synonyms:
          - ennustettu sijoitus
          - ranking
        description: Predicted final rank (1=champion)
        expr: PROJ_RANK
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: TEAM
        synonyms:
          - joukkue
          - seura
          - club
        description: Team name
        expr: TEAM
        data_type: VARCHAR(16777216)
        access_modifier: public_access
        is_enum: true
        sample_values:
          - Tappara
          - HIFK
          - Jokerit
          - KooKoo
          - Lukko
          - Ilves
          - JYP
          - SaiPa
          - K-Espoo
          - KalPa
          - Pelicans
          - TPS
          - Sport
          - HPK
          - Jukurit
          - Kärpät
          - Ässät
    facts:
      - name: CROWD_MEAN_RANK
        description: Crowd mean rank
        expr: CROWD_MEAN_RANK
        data_type: FLOAT
        access_modifier: public_access
      - name: CROWD_POINTS
        description: Crowd predicted points
        expr: CROWD_PTS
        data_type: FLOAT
        access_modifier: public_access
      - name: CROWD_RANK
        description: Crowd predicted rank
        expr: CROWD_RANK
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: MEAN_POINTS
        synonyms:
          - keskipisteet
          - predicted points
        description: Mean predicted points from 10000 simulations
        expr: MEAN_POINTS
        data_type: FLOAT
        access_modifier: public_access
      - name: MEAN_RANK
        description: Mean rank
        expr: MEAN_RANK
        data_type: FLOAT
        access_modifier: public_access
      - name: P05_POINTS
        description: 5th percentile points
        expr: P05_POINTS
        data_type: FLOAT
        access_modifier: public_access
      - name: P95_POINTS
        description: 95th percentile points
        expr: P95_POINTS
        data_type: FLOAT
        access_modifier: public_access
      - name: TITLE_PROBABILITY
        synonyms:
          - mestaruustodennakoisyys
          - championship probability
        description: Title win probability (0-1)
        expr: P_TITLE
        data_type: FLOAT
        access_modifier: public_access
      - name: TOP_PLAYOFF_PROBABILITY
        synonyms:
          - playoff probability
        description: Top playoff probability (0-1)
        expr: P_TOP_PLAYOFF
        data_type: FLOAT
        access_modifier: public_access
    metrics:
      - name: AVG_PREDICTED_POINTS
        description: Average predicted points
        expr: AVG(MEAN_POINTS)
        access_modifier: public_access
  - name: TEAM_GAME_LOG
    description: Per-game team results
    base_table:
      database: LIIGA
      schema: MODEL
      table: TEAM_GAME_LOG
    dimensions:
      - name: GAME_ID
        description: Game ID
        expr: GAME_ID
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: GAME_WEEK
        synonyms:
          - kierros
        description: Game week
        expr: GAME_WEEK
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: IS_HOME
        description: Home game
        expr: IS_HOME
        data_type: BOOLEAN
        access_modifier: public_access
      - name: OPPONENT
        synonyms:
          - vastustaja
        description: Opponent
        expr: OPPONENT
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: RESULT_CATEGORY
        description: "regulation, overtime, shootout"
        expr: RESULT_CATEGORY
        data_type: VARCHAR(16777216)
        access_modifier: public_access
        is_enum: true
        sample_values:
          - regulation
          - overtime
          - shootout
      - name: SEASON
        description: Season
        expr: SEASON
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: TEAM
        synonyms:
          - joukkue
        description: Team
        expr: TEAM
        data_type: VARCHAR(16777216)
        access_modifier: public_access
    facts:
      - name: GAME_POINTS
        description: Points earned
        expr: POINTS
        data_type: "NUMBER(1,0)"
        access_modifier: public_access
      - name: GOALS_AGAINST
        description: Goals conceded
        expr: GOALS_AGAINST
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: GOALS_FOR
        description: Goals scored
        expr: GOALS_FOR
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: WON
        description: "1=won, 0=lost"
        expr: WON
        data_type: "NUMBER(2,0)"
        access_modifier: public_access
    metrics:
      - name: TOTAL_GAME_POINTS
        description: Total points
        expr: SUM(POINTS)
        access_modifier: public_access
      - name: TOTAL_WINS
        description: Total wins
        expr: SUM(WON)
        access_modifier: public_access
      - name: WIN_RATE
        description: Win rate
        expr: AVG(WON)
        access_modifier: public_access
  - name: TEAM_SEASONS
    description: Team stats per season
    base_table:
      database: LIIGA
      schema: MODEL
      table: TEAM_SEASON
    dimensions:
      - name: SEASON
        description: Season
        expr: SEASON
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: TEAM
        description: Team
        expr: TEAM
        data_type: VARCHAR(16777216)
        access_modifier: public_access
    facts:
      - name: GAMES_PLAYED
        description: Games played
        expr: GAMES_PLAYED
        data_type: "NUMBER(18,0)"
        access_modifier: public_access
      - name: SEASON_GOALS_AGAINST
        description: Goals conceded
        expr: GOALS_AGAINST
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: SEASON_GOALS_FOR
        description: Goals scored
        expr: GOALS_FOR
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: SEASON_POINTS
        synonyms:
          - kauden pisteet
        description: Points
        expr: POINTS
        data_type: "NUMBER(13,0)"
        access_modifier: public_access
      - name: SEASON_WINS
        description: Wins
        expr: WINS
        data_type: "NUMBER(14,0)"
        access_modifier: public_access
  - name: TEAM_STRENGTH
    description: Team strength ratings
    base_table:
      database: LIIGA
      schema: MODEL
      table: TEAM_STRENGTH
    primary_key:
      columns:
        - TEAM
    dimensions:
      - name: TEAM
        synonyms:
          - joukkue
        description: Team name
        expr: TEAM
        data_type: VARCHAR(16777216)
        access_modifier: public_access
        is_enum: true
        sample_values:
          - Tappara
          - HIFK
          - Jokerit
          - KooKoo
          - Lukko
    facts:
      - name: CONTINUITY_SCORE
        description: Roster continuity
        expr: CONTINUITY_SCORE
        data_type: FLOAT
        access_modifier: public_access
      - name: DEF_RATING
        synonyms:
          - defensive rating
        description: Defensive rating (lower=better)
        expr: DEF_RATING
        data_type: FLOAT
        access_modifier: public_access
      - name: EXP_GF_PLAYER
        description: Expected goals from player model
        expr: EXP_GF_PLAYER
        data_type: FLOAT
        access_modifier: public_access
      - name: GOALIE_MULT
        description: Goalie multiplier (lower=better)
        expr: GOALIE_MULT
        data_type: FLOAT
        access_modifier: public_access
      - name: OFF_RATING
        synonyms:
          - offensive rating
        description: Offensive rating (higher=better)
        expr: OFF_RATING
        data_type: FLOAT
        access_modifier: public_access
  - name: GAME_LINEUPS
    description: Player lineups per game. Each row is one skater in one game with their role, line assignment, and status. Use to find probable lineups for upcoming games based on most recent game.
    base_table:
      database: LIIGA
      schema: RAW
      table: GAME_LINEUPS
    primary_key:
      columns:
        - GAME_ID
        - PLAYER_ID
    dimensions:
      - name: GAME_ID
        description: Game ID
        expr: GAME_ID
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: SEASON
        description: Season
        expr: SEASON
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: TEAM
        synonyms:
          - joukkue
        description: Team
        expr: TEAM
        data_type: VARCHAR(16777216)
        access_modifier: public_access
        is_enum: true
        sample_values:
          - Tappara
          - HIFK
          - Jokerit
          - KooKoo
          - Lukko
      - name: IS_HOME
        description: Home team flag
        expr: IS_HOME
        data_type: BOOLEAN
        access_modifier: public_access
      - name: PLAYER_ID
        description: Player ID
        expr: PLAYER_ID
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: PLAYER_NAME
        synonyms:
          - pelaaja
        description: Full player name
        expr: "FIRST_NAME || ' ' || LAST_NAME"
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: FIRST_NAME
        description: First name
        expr: FIRST_NAME
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: LAST_NAME
        description: Last name
        expr: LAST_NAME
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: ROLE
        synonyms:
          - rooli
          - pelipaikka
        description: "Lineup role: CENTER, LEFT_WING, RIGHT_WING, LEFT_DEFENSEMAN, RIGHT_DEFENSEMAN, STRIKER, DEFENSEMAN, SEVENTH_DEFENSEMAN, EIGHTH_DEFENSEMAN, THIRTEENTH_STRIKER, GOALIE"
        expr: ROLE
        data_type: VARCHAR(16777216)
        access_modifier: public_access
        is_enum: true
        sample_values:
          - CENTER
          - LEFT_WING
          - RIGHT_WING
          - LEFT_DEFENSEMAN
          - RIGHT_DEFENSEMAN
          - STRIKER
          - DEFENSEMAN
          - GOALIE
      - name: POSITION_GROUP
        description: "Position group: F (forward), D (defenseman)"
        expr: POSITION_GROUP
        data_type: VARCHAR(16777216)
        access_modifier: public_access
        is_enum: true
        sample_values:
          - F
          - D
      - name: LINE
        synonyms:
          - ketju
          - kenttä
        description: "Line number (1=first line, 2=second, 3=third, 4=fourth/extra)"
        expr: LINE
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: JERSEY
        synonyms:
          - pelinumero
        description: Jersey number
        expr: JERSEY
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: CAPTAIN
        description: Team captain flag
        expr: CAPTAIN
        data_type: BOOLEAN
        access_modifier: public_access
      - name: INJURED
        synonyms:
          - loukkaantunut
        description: Injured flag
        expr: INJURED
        data_type: BOOLEAN
        access_modifier: public_access
      - name: REMOVED
        description: Removed from lineup flag
        expr: REMOVED
        data_type: BOOLEAN
        access_modifier: public_access
    metrics:
      - name: LINEUP_PLAYER_COUNT
        description: Number of players in lineup
        expr: COUNT(*)
        access_modifier: public_access
  - name: GAME_GOALIES
    description: Goaltender assignments per game. Shows which goalies were assigned, who started, who played, goals against and empty net time.
    base_table:
      database: LIIGA
      schema: RAW
      table: GAME_GOALIES
    primary_key:
      columns:
        - GAME_ID
        - PLAYER_ID
    dimensions:
      - name: GAME_ID
        description: Game ID
        expr: GAME_ID
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: SEASON
        description: Season
        expr: SEASON
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: TEAM
        description: Team
        expr: TEAM
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: IS_HOME
        description: Home team flag
        expr: IS_HOME
        data_type: BOOLEAN
        access_modifier: public_access
      - name: PLAYER_ID
        description: Player ID
        expr: PLAYER_ID
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: GOALIE_NAME
        synonyms:
          - maalivahti
          - veskari
        description: Full goalie name
        expr: "FIRST_NAME || ' ' || LAST_NAME"
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: FIRST_NAME
        description: First name
        expr: FIRST_NAME
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: LAST_NAME
        description: Last name
        expr: LAST_NAME
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: JERSEY
        description: Jersey number
        expr: JERSEY
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: DEPTH
        description: "Goalie depth (1=starter, 2=backup)"
        expr: DEPTH
        data_type: FLOAT
        access_modifier: public_access
      - name: STARTED
        description: Started the game
        expr: STARTED
        data_type: BOOLEAN
        access_modifier: public_access
      - name: PLAYED
        description: Played in the game
        expr: PLAYED
        data_type: BOOLEAN
        access_modifier: public_access
    facts:
      - name: GOALS_AGAINST
        synonyms:
          - päästetyt maalit
        description: Goals conceded by this goalie
        expr: GOALS_AGAINST
        data_type: FLOAT
        access_modifier: public_access
      - name: EMPTY_NET_SECONDS
        description: Seconds of empty net time
        expr: EMPTY_NET_SECONDS
        data_type: FLOAT
        access_modifier: public_access
  - name: GAME_PENALTIES
    description: "Penalties per game. NOTE: the API files a penalty under the OPPONENT's team object, so PENALISED_TEAM is the side that committed it and DREW_TEAM is the side that got the power play. SERVER_PLAYER_ID is who serves the penalty, NOT who was fouled -- the API does not carry the fouled player at all."
    base_table:
      database: LIIGA
      schema: RAW
      table: GAME_PENALTIES
    primary_key:
      columns:
        - GAME_ID
        - EVENT_ID
    dimensions:
      - name: GAME_ID
        description: Game ID
        expr: GAME_ID
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: PENALISED_TEAM
        synonyms:
          - rikkonut joukkue
          - rangaistu joukkue
        description: Team that committed the penalty
        expr: PENALISED_TEAM
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: DREW_TEAM
        synonyms:
          - ylivoiman saanut joukkue
        description: Team that was awarded the power play
        expr: DREW_TEAM
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: PLAYER_ID
        synonyms:
          - rikkoja
        description: Player who committed the penalty (0 for a bench penalty)
        expr: PLAYER_ID
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: FAULT
        synonyms:
          - rike
          - rangaistuksen syy
        description: Penalty name in Finnish, e.g. Koukkaaminen, Kampitus
        expr: FAULT
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: FAULT_TYPE
        description: Penalty code, e.g. KOU, KAM, EST
        expr: FAULT_TYPE
        data_type: VARCHAR(16777216)
        access_modifier: public_access
      - name: PERIOD
        synonyms:
          - erä
        description: Period the penalty was called in
        expr: PERIOD
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
    facts:
      - name: MINUTES
        synonyms:
          - rangaistusminuutit
        description: Penalty minutes
        expr: MINUTES
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: BEGIN_TIME
        description: Second of the game the penalty started
        expr: BEGIN_TIME
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
      - name: END_TIME
        description: Second of the game the penalty ended
        expr: END_TIME
        data_type: "NUMBER(38,0)"
        access_modifier: public_access
    metrics:
      - name: TOTAL_PENALTY_MINUTES
        synonyms:
          - rangaistusminuutit yhteensä
        description: Total penalty minutes
        expr: SUM(MINUTES)
        access_modifier: public_access
      - name: PENALTY_COUNT
        description: Number of penalties
        expr: COUNT(*)
        access_modifier: public_access
relationships:
  - name: PENALTIES_TO_SCHEDULE
    left_table: GAME_PENALTIES
    right_table: SCHEDULE
    relationship_columns:
      - left_column: GAME_ID
        right_column: GAME_ID
    relationship_type: many_to_one
  - name: PLAYER_PROJ_TO_STANDINGS
    left_table: PLAYER_PROJECTIONS
    right_table: STANDINGS
    relationship_columns:
      - left_column: TEAM
        right_column: TEAM
  - name: PLAYER_PROJ_TO_STRENGTH
    left_table: PLAYER_PROJECTIONS
    right_table: TEAM_STRENGTH
    relationship_columns:
      - left_column: TEAM
        right_column: TEAM
  - name: STANDINGS_TO_GOALTENDING
    left_table: STANDINGS
    right_table: GOALTENDING
    relationship_columns:
      - left_column: TEAM
        right_column: TEAM
  - name: STANDINGS_TO_STRENGTH
    left_table: STANDINGS
    right_table: TEAM_STRENGTH
    relationship_columns:
      - left_column: TEAM
        right_column: TEAM
  - name: PREDICTIONS_TO_SCHEDULE
    left_table: GAME_PREDICTIONS
    right_table: SCHEDULE
    relationship_columns:
      - left_column: GAME_ID
        right_column: GAME_ID
  - name: LINEUPS_TO_SCHEDULE
    left_table: GAME_LINEUPS
    right_table: SCHEDULE
    relationship_columns:
      - left_column: GAME_ID
        right_column: GAME_ID
  - name: GOALIES_TO_SCHEDULE
    left_table: GAME_GOALIES
    right_table: SCHEDULE
    relationship_columns:
      - left_column: GAME_ID
        right_column: GAME_ID
module_custom_instructions:
  sql_generation: |
    Liiga 2026-27 prediction model. Team names are exact strings.
    Probabilities are 0-1 fractions - display as percentages (multiply by 100).
    OFF_RATING higher=better. DEF_RATING lower=better. GOALIE_MULT lower=better.
    SEASON 2025 means 2025-26 season. Points: 3 reg win, 2 OT win, 1 OT loss, 0 reg loss.
    Round to 1-2 decimals. Compare teams side by side.

    IMPORTANT - today's games / daily match predictions:
    To find games for a specific date, join SCHEDULE with GAME_PREDICTIONS on GAME_ID.
    Filter SCHEDULE by TO_DATE(START_TS) = <date> (use CURRENT_DATE for today).
    Always filter GAME_PREDICTIONS by snapshot_date = (SELECT MAX(gp2.snapshot_date) FROM __game_predictions gp2) to get the latest predictions.
    Show home_team, away_team, home win %, away win %, overtime %, and predicted winner.

    LINEUPS - probable/expected lineups:
    __game_lineups contains actual lineups from played games. To find probable lineups for upcoming games, use the most recent game for each team.
    Join __game_lineups to __schedule on game_id to get game dates.
    Filter by the latest game_id per team to get current lineup.
    __game_goalies has goaltender data with depth (1=starter, 2=backup), started, played flags.
    Group by line number (1-4) and show role (CENTER, LEFT_WING, RIGHT_WING, LEFT_DEFENSEMAN, RIGHT_DEFENSEMAN) for each line.
  question_categorization: |
    Covers Liiga 2026-27 regular season only.
    Reject NHL/KHL/SHL/Mestis questions.
    Reject playoff bracket/round predictions - model covers regular season only.
    Lineup data is from most recent played games - note it may not reflect pending trades or injuries not yet in the data.
    If asked about player transfers during the season, note that the model does not automatically track mid-season trades.
verified_queries:
  - name: PREDICTED_STANDINGS
    sql: |
      SELECT team, projected_rank, ROUND(mean_points, 1) AS mean_points,
             ROUND(title_probability * 100, 1) AS title_pct,
             ROUND(top_playoff_probability * 100, 1) AS playoff_pct
      FROM __standings
      ORDER BY projected_rank
    question: What are the predicted standings?
    verified_at: 1725019200
    verified_by: mheino
    use_as_onboarding_question: true
  - name: TEAM_LATEST_LINEUP
    sql: |
      WITH latest_game AS (
        SELECT gl.team, MAX(gl.game_id) AS last_game_id
        FROM __game_lineups gl
        GROUP BY gl.team
      )
      SELECT
        gl.team,
        gl.line,
        gl.role,
        gl.player_name,
        gl.jersey,
        gl.captain,
        gl.injured
      FROM __game_lineups gl
      JOIN latest_game lg ON gl.team = lg.team AND gl.game_id = lg.last_game_id
      WHERE gl.role NOT IN ('GOALIE')
        AND gl.injured = FALSE AND gl.removed = FALSE
      ORDER BY gl.team, gl.line, gl.role
    question: "Mik\u00e4 on joukkueen todenn\u00e4k\u00f6inen kokoonpano?"
    verified_at: 1725019200
    verified_by: mheino
    use_as_onboarding_question: true
  - name: TEAM_STARTING_GOALIES
    sql: |
      WITH latest_game AS (
        SELECT gg.team, MAX(gg.game_id) AS last_game_id
        FROM __game_goalies gg
        GROUP BY gg.team
      )
      SELECT
        gg.team,
        gg.goalie_name,
        gg.jersey,
        gg.depth,
        gg.started,
        gg.played,
        gg.goals_against
      FROM __game_goalies gg
      JOIN latest_game lg ON gg.team = lg.team AND gg.game_id = lg.last_game_id
      ORDER BY gg.team, gg.depth
    question: "Ketkä ovat joukkueiden aloitusmaalivahdit?"
    verified_at: 1725019200
    verified_by: mheino
    use_as_onboarding_question: false
  - name: CHAMPIONSHIP_FAVORITES
    sql: |
      SELECT team, ROUND(title_probability * 100, 1) AS title_pct,
             ROUND(mean_points, 1) AS mean_points, projected_rank
      FROM __standings
      WHERE title_probability > 0.01
      ORDER BY title_probability DESC
    question: Who wins the championship?
    verified_at: 1725019200
    verified_by: mheino
    use_as_onboarding_question: true
  - name: BEST_SCORERS
    sql: |
      SELECT team, player_name, position_group,
             ROUND(projected_goals_per_game, 3) AS goals_per_game,
             ROUND(projected_points_per_game, 3) AS points_per_game
      FROM __player_projections
      WHERE position_group = 'F'
      ORDER BY projected_goals_per_game DESC
      LIMIT 20
    question: Who are the top scorers?
    verified_at: 1725019200
    verified_by: mheino
    use_as_onboarding_question: true
  - name: TEAM_OFFENSIVE_RANKING
    sql: |
      SELECT team, ROUND(off_rating, 3) AS off_rating,
             ROUND(exp_gf_player, 2) AS exp_goals_per_game
      FROM __team_strength
      ORDER BY off_rating DESC
    question: Which team has best offense?
    verified_at: 1725019200
    verified_by: mheino
    use_as_onboarding_question: false
  - name: TEAM_DEFENSIVE_RANKING
    sql: |
      SELECT ts.team, ROUND(ts.def_rating, 3) AS def_rating,
             ROUND(tg.team_save_pct, 3) AS save_pct
      FROM __team_strength ts
      JOIN __goaltending tg ON ts.team = tg.team
      ORDER BY ts.def_rating ASC
    question: Which team has best defense?
    verified_at: 1725019200
    verified_by: mheino
    use_as_onboarding_question: false
  - name: LAST_SEASON
    sql: |
      SELECT team, season, season_points, season_wins, games_played,
             season_goals_for, season_goals_against
      FROM __team_seasons
      WHERE season = 2025
      ORDER BY season_points DESC
    question: How did teams do last season?
    verified_at: 1725019200
    verified_by: mheino
    use_as_onboarding_question: false
  - name: CROWD_VS_MODEL
    sql: |
      SELECT team, projected_rank AS model_rank, crowd_rank,
             ROUND(mean_points, 1) AS model_points,
             ROUND(crowd_points, 1) AS crowd_points
      FROM __standings
      ORDER BY ABS(projected_rank - crowd_rank) DESC
    question: How does model differ from crowd prediction?
    verified_at: 1725019200
    verified_by: mheino
    use_as_onboarding_question: false
  - name: TODAYS_MATCH_PREDICTIONS
    sql: |
      SELECT
        s.game_id,
        s.start_ts,
        s.game_date,
        s.home_team,
        s.away_team,
        ROUND(gp.home_win_prob * 100, 1) AS home_win_pct,
        ROUND((1 - gp.home_win_prob) * 100, 1) AS away_win_pct,
        ROUND(gp.home_reg_win_prob * 100, 1) AS home_reg_win_pct,
        ROUND(gp.away_reg_win_prob * 100, 1) AS away_reg_win_pct,
        ROUND(gp.overtime_prob * 100, 1) AS overtime_pct,
        CASE WHEN gp.home_win_prob >= 0.5 THEN s.home_team ELSE s.away_team END AS predicted_winner
      FROM __game_predictions gp
      JOIN __schedule s ON gp.game_id = s.game_id
      WHERE s.game_date = CURRENT_DATE
        AND gp.snapshot_date = (SELECT MAX(gp2.snapshot_date) FROM __game_predictions gp2)
      ORDER BY s.start_ts ASC
    question: Miten tämän päivän pelit päättyvät?
    verified_at: 1725019200
    verified_by: mheino
    use_as_onboarding_question: true
$$);
