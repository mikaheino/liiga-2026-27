"""Haastajamallin (liiga.inseason) sulatus: painot ja reunatapaukset."""
import pandas as pd
import pytest

from liiga.inseason import observed_rates, thaw_ratings

PRIOR = pd.DataFrame({"team": ["A", "B", "C"],
                      "off_rating": [1.2, 0.8, 1.0],
                      "def_rating": [0.9, 1.1, 1.0]})
PLAYED = pd.DataFrame({"home_team": ["A", "B"], "away_team": ["B", "A"],
                       "home_goals": [4, 1], "away_goals": [2, 3],
                       "home_xg": [3.0, None], "away_xg": [1.0, None]})


def test_observed_rates_are_league_relative():
    obs = observed_rates(PLAYED, "goals").set_index("team")
    # A: 7 for, 3 against in 2 games; league 2.5/game
    assert obs.loc["A", "n"] == 2
    assert obs.loc["A", "off_obs"] == pytest.approx(3.5 / 2.5)
    assert obs.loc["B", "def_obs"] == pytest.approx(3.5 / 2.5)


def test_xg_falls_back_to_goals_when_missing():
    obs = observed_rates(PLAYED, "xg").set_index("team")
    # A: xG 3 + goals 3 (fallback) = 6 for; league (3+1+1+3)/4 = 2
    assert obs.loc["A", "off_obs"] == pytest.approx(3.0 / 2.0)


def test_thaw_weight_grows_with_games():
    t = thaw_ratings(PRIOR, PLAYED, n0=2.0, signal="goals").set_index("team")
    w = 2 / (2 + 2.0)
    assert t.loc["A", "off_rating"] == pytest.approx((1 - w) * 1.2 + w * 1.4)
    # C has played nothing: prior unchanged
    assert t.loc["C", "off_rating"] == pytest.approx(1.0)
    assert list(t.columns) == ["off_rating", "def_rating"]


def test_thaw_before_season_returns_prior():
    t = thaw_ratings(PRIOR, PLAYED.iloc[0:0])
    pd.testing.assert_frame_equal(t, PRIOR)


def test_opponent_adjust_keeps_league_mean_at_one():
    obs = observed_rates(PLAYED, "goals", opp_adjust=True)
    assert obs["off_obs"].mean() == pytest.approx(1.0)
    assert obs["def_obs"].mean() == pytest.approx(1.0)


def test_split_n0_shrinks_defence_separately():
    t = thaw_ratings(PRIOR, PLAYED, n0=2.0, n0_def=1e9, signal="goals").set_index("team")
    assert t.loc["A", "def_rating"] == pytest.approx(0.9, abs=1e-6)
    assert t.loc["A", "off_rating"] != pytest.approx(1.2)


def test_elo_input_xg_margin():
    from liiga.inseason import elo_input
    g = elo_input(PLAYED, "xg", scale=2.0)
    assert list(g["home_goals"]) == [6.0, 2.0]       # xG*2, goals*2 where xG missing
    assert elo_input(PLAYED, "goals") is PLAYED


def test_goaltending_signal_raises_leaky_defence():
    base = thaw_ratings(PRIOR, PLAYED, n0=2.0, signal="xg").set_index("team")
    gk = thaw_ratings(PRIOR, PLAYED, n0=2.0, signal="xg", n0_gk=2.0).set_index("team")
    # xG game only: A allowed 2 on 1.0 xG (2.0), league 6 on 4.0 (1.5) -> A leakier,
    # B (4 on 3.0) better than league
    assert gk.loc["A", "def_rating"] > base.loc["A", "def_rating"]
    assert gk.loc["B", "def_rating"] < base.loc["B", "def_rating"]
    assert gk.loc["C", "def_rating"] == pytest.approx(base.loc["C", "def_rating"])


def test_train_elo_continues_from_given_ratings():
    from liiga.elo import train_elo
    games = pd.DataFrame({"home_team": ["A"], "away_team": ["B"], "home_win": [1],
                          "result_category": ["regulation"], "season": [2027],
                          "home_goals": [3], "away_goals": [1]})
    start = {"A": 1600.0, "B": 1400.0}
    r = train_elo(games, ratings=start)
    assert start == {"A": 1600.0, "B": 1400.0}          # not mutated
    assert r["A"] > 1600.0 and r["B"] < 1400.0
    assert train_elo(games)["A"] < r["A"]
