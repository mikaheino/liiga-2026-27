"""Smoke tests for the prediction pipeline.

These assume the DuckDB has been populated (run notebook 01 or `python -m
liiga.ingest` first). They check the invariants that matter most: leakage-free
structure, schedule integrity, and that the simulation conserves points.
"""
import numpy as np
import pytest

from liiga.config import load_config
from liiga.db import get_connection, query_df
from liiga.model import matchup_probs


@pytest.fixture(scope="module")
def con():
    c = get_connection()
    yield c
    c.close()


def test_target_schedule_consistent(con):
    """Valid pre-season AND in-season: schedule exists, unplayed games have no
    winner, played games carry goals."""
    cfg = load_config()
    target = cfg["ingestion"]["target_season"]
    df = query_df(
        con,
        f"SELECT ended, winner, home_goals, away_goals FROM raw_games WHERE season={target}",
    )
    assert len(df) > 0
    unplayed = df[~df["ended"]]
    assert unplayed["winner"].isna().all(), "unplayed games must have no winner"
    played = df[df["ended"]]
    if not played.empty:
        assert played["home_goals"].notna().all() and played["away_goals"].notna().all()


def test_banked_points_plus_simulated_conserved(con):
    """Mid-season invariant: banked points + 3 pts per remaining game."""
    import numpy as np
    from liiga.model import predict_games
    from liiga.simulate import simulate, banked_points

    cfg = load_config()
    target = cfg["ingestion"]["target_season"]
    banked = banked_points(con, target)
    remaining = query_df(
        con,
        f"SELECT home_team, away_team FROM stg_games WHERE season = {target} AND NOT ended LIMIT 40",
    )
    ratings = query_df(con, "SELECT * FROM team_strength")
    pred = predict_games(remaining, ratings, cfg)
    base = dict(banked) or {"Tappara": 7.0, "Sport": 2.0}   # exercise the path pre-season too
    res = simulate(con=con, pred=pred, base_points=base)
    total = res["standings"]["mean_points"].sum()
    expected = sum(base.values()) + 3 * len(pred)
    assert np.isclose(total, expected, atol=1e-6)


def test_two_rows_per_played_game(con):
    g = query_df(con, "SELECT COUNT(*) c FROM stg_games WHERE ended")["c"][0]
    log = query_df(con, "SELECT COUNT(*) c FROM team_game_log")["c"][0]
    assert log == 2 * g


def test_no_sentinel_scorer_in_rates(con):
    # player_id 0 (own goals) must never appear in scoring
    n = query_df(con, "SELECT COUNT(*) c FROM player_season_scoring WHERE player_id=0")["c"][0]
    assert n == 0


def test_matchup_probabilities_sum_to_one():
    cfg = load_config()
    p = matchup_probs(1.2, 0.95, 0.9, 1.05, cfg)
    total = p["p_home_reg"] + p["p_away_reg"] + p["p_overtime"]
    assert abs(total - 1.0) < 1e-6


def test_simulation_conserves_points():
    # every game awards exactly 3 points total (3+0 or 2+1)
    from liiga.simulate import simulate
    res = simulate()
    n_games = len(res["predictions"])
    assert abs(res["standings"]["mean_points"].sum() - 3 * n_games) < 1.0


def test_goaltending_covers_every_team(con):
    # every team with a roster must get a goalie multiplier (no team left neutral
    # by accident), and the multipliers must be sane (centred near 1, not zero).
    teams = set(query_df(con, "SELECT DISTINCT team FROM roster_2026_27")["team"])
    g = query_df(con, "SELECT team, goalie_mult FROM team_goaltending")
    assert teams.issubset(set(g["team"])), "some team has no goaltending multiplier"
    assert g["goalie_mult"].between(0.5, 1.5).all()


def test_goaltending_feeds_team_strength(con):
    # def_rating must actually reflect goaltending: the goalie_mult column is
    # present and the defensive ratings vary across teams (not a flat constant).
    ts = query_df(con, "SELECT goalie_mult, def_rating FROM team_strength")
    assert ts["goalie_mult"].notna().all()
    assert ts["def_rating"].std() > 0.01, "def_rating is flat -> goaltending not wired in"
