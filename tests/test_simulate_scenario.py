"""Mitä jos? -simulaattori (snowflake/LIIGA/MODEL/procedures/SIMULATE_SCENARIO/simulate_scenario.py) paikallista
DuckDB:tä vasten: ilman lukittuja otteluita sen pitää toistaa julkaistu ennuste,
ja lukitun voiton pitää näkyä oikeaan suuntaan."""
import importlib.util
from pathlib import Path

import duckdb
import pytest

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location(
    "simulate_scenario", ROOT / "snowflake/LIIGA/MODEL/procedures/SIMULATE_SCENARIO/simulate_scenario.py")
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
    # verrataan todennäköisyyksiin, joihin yleisö ei vaikuta.
    #
    # Toleranssi on sidottu Monte Carlon omaan hajontaan eikä vakioon (31.10.2026).
    # Molemmat simulaatiot arpovat 10 000 kautta siemenellä 42, mutta ne ovat eri
    # toteutuksia, joten arvontajärjestys eroaa ja estimaatit ovat riippumattomia:
    # kahden estimaatin erolla on keskivirhe sqrt(2*p*(1-p)/N). Kiinteä 1,5 pp oli
    # kärkijoukkueelle noin 2 sigmaa, joten se kaatui ennemmin tai myöhemmin
    # sattumalta -- 147 -> 154 pelattua ottelua riitti (Lukko p=0,57, ero 1,61 pp,
    # mediaani kaikista joukkueista 0,07 pp). 4 sigmaa on yhä tiukka: aito ajautuma
    # siirtäisi useaa joukkuetta samaan suuntaan, ei yhtä.
    n = sim.N_SIMS
    for i, t in enumerate(teams):
        p = std[t][1]
        tol = max(0.01, 4 * (2 * p * (1 - p) / n) ** 0.5)
        assert abs(base["p_title"][i] - p) < tol, f"{t}: ero {abs(base['p_title'][i] - p):.4f} > {tol:.4f}"


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


def test_charts_match_table_and_mark_locked_games():
    """Kuvaajadata (7.11.2026): jakauma summautuu ykköseen, pistekäyrä päättyy taulukon lukuihin
    ja lukitut ottelut on merkitty; tyhjä skenaario ei tuota kuvaajia."""
    games, banked, pub, w, _ = _load()
    team = games[0]["home_team"]
    res = sim.compute([{"team": team, "result": "reg_win", "games": 3}], games, banked, pub, w)
    c = res["charts"]
    assert team in c["focus"] and len(c["focus"]) <= sim.CHART_TEAMS
    assert abs(sum(c["dist"][team]["scenario"]) - 1) < 1e-9 and len(c["dist"][team]["now"]) == len(pub)
    row = next(r for r in res["teams"] if r["team"] == team)
    end = c["points"][team][-1]
    assert abs(end["now"] - row["points_now"]) < 1e-6 and abs(end["scenario"] - row["points_scenario"]) < 1e-6
    assert sum(pt["locked"] for pt in c["points"][team]) == 3
    assert sim.compute([], games, banked, pub, w)["charts"] is None


@pytest.mark.skipif(not DB.exists(), reason="ei paikallista kantaa")
def test_injury_weakens_team():
    import sys
    sys.path.insert(0, str(ROOT / "scripts" / "tools"))
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


# --- Moottorin laajennus (6.11.2026, docs/claude/skenaario.md V1) -------------------

@pytest.fixture(scope="module")
def loaded():
    import sys
    sys.path.insert(0, str(ROOT / "scripts" / "tools"))
    import skenaario
    con = duckdb.connect(str(DB), read_only=True)
    games, banked, pub, w, snap, played = skenaario.load(con)
    model = skenaario.load_model(con)
    con.close()
    return games, banked, pub, w, played, model, sim.simulate(games, banked, sorted(pub))


needs_db = pytest.mark.skipif(not DB.exists(), reason="ei paikallista kantaa")


@needs_db
def test_empty_scenario_is_published(loaded):
    games, banked, pub, w, played, model, base = loaded
    res = sim.compute(sim.parse("[]", allow_empty=True), games, banked, pub, w, played, base=base)
    for r in res["teams"]:
        for k in ("p_title", "p_top6", "p_top10", "p_relegation"):
            assert r[f"{k}_scenario"] == pytest.approx(r[f"{k}_now"], abs=1e-12)
        assert r["points_scenario"] == pytest.approx(r["points_now"])
    assert res["scenario_canonical"] == [] and res["plausibility"] is None
    with pytest.raises(sim.ScenarioError):
        sim.parse("[]")                                   # tekstitila (agentti): tyhjä on virhe


@needs_db
def test_requirement_is_anchored_to_published(loaded):
    games, banked, pub, w, played, model, base = loaded
    team = sorted(pub)[0]
    req = sim.compute([{"team": team, "goal": "avoid_relegation"}], games, banked, pub, w, played,
                      base=base)["requirements"][0]
    assert req["p"] == pytest.approx(1 - pub[team]["p_relegation"], abs=1e-9)   # yksi luku per asia


@needs_db
def test_game_id_lock_equals_team_lock_and_same_sha(loaded):
    games, banked, pub, w, played, model, base = loaded
    g = games[0]
    a = sim.compute([{"team": g["home_team"], "result": "win"}], games, banked, pub, w, base=base)
    b = sim.compute([{"game_id": g["game_id"], "result": "home_win"}], games, banked, pub, w, base=base)
    c = sim.compute([{"game_id": g["game_id"], "team": g["away_team"], "result": "loss"}], games, banked, pub, w,
                    base=base)
    assert a["scenario_sha"] == b["scenario_sha"] == c["scenario_sha"]
    assert a["teams"] == b["teams"]
    p = sim._outcome_probs(g)
    assert b["plausibility"] == pytest.approx(p["home_reg"] + p["home_ot"])
    # kanoninen lista kelpaa sellaisenaan syötteeksi (sovelluksen sirut)
    again = sim.compute(b["scenario_canonical"], games, banked, pub, w, base=base)
    assert again["scenario_sha"] == b["scenario_sha"]


@needs_db
def test_window_lock_until_inclusive(loaded):
    games, banked, pub, w, played, model, base = loaded
    team = games[0]["home_team"]
    mine = [g for g in games if team in (g["home_team"], g["away_team"])]
    lo, hi = mine[1]["iso"], mine[3]["iso"]
    res = sim.compute([{"team": team, "result": "loss", "from": lo, "until": hi}], games, banked, pub, w, base=base)
    want = [g for g in mine if lo <= g["iso"] <= hi]
    assert len(res["locked_games"]) == len(want) >= 2
    with pytest.raises(sim.ScenarioError):
        sim.compute([{"team": team, "result": "loss", "from": "2030-01-01", "until": "2030-02-01"}],
                    games, banked, pub, w, base=base)


@needs_db
def test_stake_matches_explicit_lock(loaded):
    """Panos (ehdollistus samoista kausista) = lukitun ottelun simulaatio kahden keskivirheen sisällä."""
    games, banked, pub, w, played, model, base = loaded
    res = sim.compute([{"stakes": {"days": 7}}], games, banked, pub, w, base=base)
    assert res["stakes"]
    for st in res["stakes"][:5]:
        top = st["top"]
        locked = sim.compute([{"game_id": st["game_id"], "result": "home_win"},
                              {"team": top["team"], "goal": top["goal"]}], games, banked, pub, w, base=base)
        assert abs(locked["requirements"][0]["p"] - top["p_home_win"]) <= max(2 * top["se"], 0.005)


@needs_db
def test_injury_by_player_id_and_text_mode_unchanged_shape(loaded):
    games, banked, pub, w, played, model, base = loaded
    top = max((p for p in model["players"] if p["position_group"] != "G" and p.get("player_id") == p.get("player_id")),
              key=lambda p: p["projected_goals_per_game"])
    by_name = sim.compute([{"injury": top["name"], "games": 5}], games, banked, pub, w, played, model, base=base)
    by_id = sim.compute([{"injury": int(top["player_id"]), "games": 5}], games, banked, pub, w, played, model,
                        base=base)
    assert by_name["scenario_sha"] == by_id["scenario_sha"]
    assert by_name["scenario_canonical"][0]["injury"] == int(top["player_id"])    # ei nimeä tunnisteeksi
    txt = sim.render(by_name, "6.11.2026")
    assert txt.startswith("SKENAARIO") and "LOUKKAANTUMINEN" in txt


@needs_db
def test_panel_same_in_all_three_shapes(loaded):
    """Paikallinen reitti (--panel), Snowflaken MODE 'panel' ja Pagesin tiedosto: sama funktio."""
    import json
    import sys
    sys.path.insert(0, str(ROOT / "scripts" / "deploy"))
    import scenario_static
    import skenaario
    one = json.loads(skenaario.run_panel('{"team": "KooKoo", "goal": "top10", "streak": 5}'))
    con = skenaario._connect()
    try:
        files = scenario_static.build(con)
    finally:
        con.close()
    static = json.loads(sim.to_json(files["KooKoo"]["panels"]["top10:5"], "x"))
    assert one["base"]["p"] == static["base"]["p"] and one["streak"]["req"]["p"] == static["streak"]["req"]["p"]
    assert set(files) == set(loaded[2]) and len(files["KooKoo"]["panels"]) == 16
    assert "error" in json.loads(skenaario.run_panel('{"team": "KooKoo", "goal": "x", "streak": 5}'))


def test_missing_regulars_and_baseline():
    """Vakio = 7/10 edellisestä; puuttuvat viimeisimmästä; perustaso samalla säännöllä."""
    rows = []
    for g in range(12):
        key = f"2026-10-{g + 10:02d}|{g}"
        squad = [1, 2, 3, 4] + ([5] if g < 11 else [])            # pelaaja 5 puuttuu viimeisestä
        squad += [6] if g % 2 else []                                # 6 pelaa puolet: ei vakio
        rows += [{"team": "A", "game_key": key, "player_id": p, "name": f"P{p}"} for p in squad]
    missing, baseline = sim.missing_regulars(rows, "A")
    assert [m["player_id"] for m in missing] == [5]
    assert baseline == 0.0
    assert sim.missing_regulars(rows[:10], "A") == ([], 0.0)         # liian vähän otteluita


@needs_db
def test_absence_card_shape(loaded):
    import sys
    sys.path.insert(0, str(ROOT / "scripts" / "tools"))
    import json

    import skenaario
    out = json.loads(skenaario.run_absence('{"team": "Lukko"}'))
    assert set(out) >= {"team", "goal", "missing", "baseline", "durations", "show", "forecastDate"}
    if out["missing"]:
        assert set(out["durations"]) == {"week", "month", "season"}
        d = out["durations"]["season"]
        assert 0 <= d["p"] <= 1 and 0 <= d["p_now"] <= 1
    assert "error" in json.loads(skenaario.run_absence('{"team": "Eiole"}'))


def test_team_xg_share_shift_moves_team_and_is_canonical():
    """Joukkueen muutos (7.11.2026, valmentajanvaihto): positiivinen xG-osuuden siirto nostaa
    joukkuetta, rajan yli virhe, ja kanoninen rivi kelpaa sellaisenaan syötteeksi."""
    games, banked, pub, w, _ = _load()
    games = [{**g, "iso": g.get("iso") or "2026-12-01"} for g in games]     # testiaineistossa ei päiviä
    team = games[0]["home_team"]
    s = {"off_rating": 1.0, "def_rating": 1.0}
    model = {"players": [], "goalies": [], "strength": {t: dict(s) for t in pub}, "today": "2026-12-01"}
    res = sim.compute([{"team": team, "xg_share": 0.06}], games, banked, pub, w, model=model)
    row = next(r for r in res["teams"] if r["team"] == team)
    assert row["points_scenario"] > row["points_now"]
    assert res["shifts"][0]["n_games"] > 0 and abs(res["shifts"][0]["share_after"] - 0.56) < 1e-9
    canon = res["scenario_canonical"]
    assert canon[0]["team"] == team and canon[0]["xg_share"] == 0.06 and "xG-osuus +6" in canon[0]["label"]
    again = sim.compute([{k: v for k, v in canon[0].items() if k != "label"}], games, banked, pub, w, model=model)
    assert abs(next(r for r in again["teams"] if r["team"] == team)["points_scenario"] - row["points_scenario"]) < 1e-9
    with pytest.raises(sim.ScenarioError):
        sim.compute([{"team": team, "xg_share": 0.3}], games, banked, pub, w, model=model)


def test_overtime_and_point_locks():
    """Jatkoaika ja pisteet (7.11.2026): "menee jatkoajalle" ja "vähintään piste" lukitsevat oikeat
    tulokset, kanoninen rivi kelpaa syötteeksi, ja todennäköisyys on osatulosten summa."""
    games, banked, pub, w, _ = _load()
    g = games[0]
    ot = sim.compute([{"team": g["home_team"], "result": "ot", "games": 1}], games, banked, pub, w)   # testiaineistossa ei game_id:tä
    assert ot["scenario_canonical"][0]["result"] == "overtime" and "jatkoajalle" in ot["scenario_canonical"][0]["label"]
    p = sim._outcome_probs(g)
    assert abs(ot["plausibility"] - (p["home_ot"] + p["away_ot"])) < 1e-9
    pt = sim.compute([{"team": g["away_team"], "result": "point", "games": 1}], games, banked, pub, w)
    assert pt["scenario_canonical"][0]["result"] == "away_point"
    assert abs(pt["plausibility"] - (1 - p["home_reg"])) < 1e-9


def test_injury_from_date_is_one_game():
    """Ottelukohtainen poissaolo (7.11.2026): from/until rajaa poissaolon yhteen myöhempään otteluun."""
    import inspect
    src = inspect.getsource(sim.apply_injuries)
    assert 'it.get("from")' in src            # alkupäivä suodattaa joukkueen ottelut
    canon = inspect.getsource(sim.canonical)
    assert '"from"' in canon                  # ja säilyy kanonisessa rivissä
