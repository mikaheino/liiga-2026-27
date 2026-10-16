"""Mitä jos? -simulaattori (snowflake/procedures/simulate_scenario.py) paikallista
DuckDB:tä vasten: ilman lukittuja otteluita sen pitää toistaa julkaistu ennuste,
ja lukitun voiton pitää näkyä oikeaan suuntaan."""
import importlib.util
from pathlib import Path

import duckdb
import pytest

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location(
    "simulate_scenario", ROOT / "snowflake/procedures/simulate_scenario.py")
sim = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sim)
DB = ROOT / "data/liiga.duckdb"


def test_constants_match_config():
    import yaml
    cfg = yaml.safe_load((ROOT / "config.yaml").read_text())
    ts, mm = cfg["team_strength"], cfg["match_model"]
    assert sim.TEAM_WEIGHT == ts["team_weight"]
    assert sim.GOALIE_WEIGHT == ts["goalie_weight"]
    assert sim.LEAGUE_AVG == ts["league_avg_goals_per_game"]
    assert sim.TOP_SKATERS == ts["top_skaters"]
    assert sim.HOME_ICE == mm["home_ice"]
    assert sim.OT_LEAN == mm["ot_favourite_lean"]
    assert sim.LEAGUE_SV == cfg["goaltending"]["league_avg_save_pct"]
    from liiga.pipeline import POISSON_WEIGHT
    assert sim.POISSON_WEIGHT == POISSON_WEIGHT


def _load():
    c = duckdb.connect(str(DB), read_only=True)
    snap = c.execute("SELECT MAX(snapshot_date) FROM prediction_games").fetchone()[0]
    games = [dict(zip(["date", "home_team", "away_team", "p_home_reg", "p_overtime", "p_home_ot_win"], r))
             for r in c.execute("""
        SELECT strftime(CAST(s.start_ts AS TIMESTAMPTZ) AT TIME ZONE 'Europe/Helsinki', '%d.%m.'),
               p.home_team, p.away_team, p.p_home_reg, p.p_overtime, p.p_home_ot_win
        FROM prediction_games p JOIN stg_games s ON s.season = 2027 AND s.game_id = p.game_id
        WHERE p.snapshot_date = ? AND NOT s.ended
        ORDER BY CAST(s.start_ts AS TIMESTAMPTZ), p.game_id""", [snap]).fetchall()]
    banked = {}
    for h, a, hp, ap in c.execute("""SELECT home_team, away_team, home_points, away_points
                                     FROM stg_games WHERE season = 2027 AND ended""").fetchall():
        banked[h] = banked.get(h, 0) + hp
        banked[a] = banked.get(a, 0) + ap
    pub = {}
    for t, pts, pt in c.execute("SELECT team, mean_points, p_title FROM standings_2026_27").fetchall():
        pub[t] = {"points": pts, "p_title": pt, "p_top6": 0.5, "p_relegation": 0.1}
    w = c.execute("SELECT crowd_weight_eff FROM prediction_meta").fetchone()[0]
    std = {t: (pts, pt) for t, pts, pt in c.execute("SELECT team, mean_points, p_title FROM standings_2026_27").fetchall()}
    c.close()
    return games, banked, pub, w, std


@pytest.mark.skipif(not DB.exists(), reason="ei paikallista kantaa")
def test_baseline_reproduces_published_simulation():
    games, banked, pub, w, std = _load()
    teams = sorted(pub)
    base = sim.simulate(games, banked, teams)
    # mallin oma simulaatio ennen yleisöpainoa: mean = (1-w)*sim + w*crowd, joten
    # verrataan todennäköisyyksiin, joihin yleisö ei vaikuta (Monte Carlo ±1,5 pp)
    for i, t in enumerate(teams):
        assert abs(base["p_title"][i] - std[t][1]) < 0.015, t


@pytest.mark.skipif(not DB.exists(), reason="ei paikallista kantaa")
def test_locked_win_moves_team_up_and_empty_change_is_zero():
    games, banked, pub, w, _ = _load()
    team = games[0]["home_team"]
    res = sim.compute([{"team": team, "result": "reg_win", "games": 3}], games, banked, pub, w)
    row = next(r for r in res["teams"] if r["team"] == team)
    assert row["points_scenario"] > row["points_now"]
    assert len(res["locked_games"]) == 3
    req = sim.compute([{"team": team, "goal": "avoid_relegation"}], games, banked, pub, w)["requirements"][0]
    n50, n95 = req["need"][0.5], req["need"][0.95]
    assert n50 is None or n95 is None or n50 <= n95       # enemmän varmuutta vaatii enemmän pisteitä
    assert 0.0 <= req["p"] <= 1.0
    with pytest.raises(sim.ScenarioError):
        sim.compute([{"team": "Kiekko-Vantaa", "result": "win"}], games, banked, pub, w)


@pytest.mark.skipif(not DB.exists(), reason="ei paikallista kantaa")
def test_injury_weakens_team():
    import sys
    sys.path.insert(0, str(ROOT / "scripts"))
    import skenaario
    con = duckdb.connect(str(DB), read_only=True)
    games, banked, pub, w, snap, played = skenaario.load(con)
    model = skenaario.load_model(con)
    con.close()
    # kokoonpanon paras maalintekijä
    top = max((p for p in model["players"] if p["position_group"] != "G"),
              key=lambda p: p["projected_goals_per_game"])
    res = sim.compute([{"injury": top["name"]}], games, banked, pub, w, played, model)
    inj = res["injuries"][0]
    assert inj["d_goals_for"] < 0 and inj["win_after"] < inj["win_before"]
    row = next(r for r in res["teams"] if r["team"] == top["team"])
    assert row["points_scenario"] < row["points_now"]
