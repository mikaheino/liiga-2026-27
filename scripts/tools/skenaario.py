"""Mitä jos? -simulaattori paikallisesti: sama koodi ja sama vastaus kuin Snowflake-
agentin työkalulla liiga_skenaario, mutta data paikallisesta DuckDB:stä.

    .venv/bin/python scripts/tools/skenaario.py '[{"injury": "Maxime Fortier"}]'
    .venv/bin/python scripts/tools/skenaario.py '[{"team": "KooKoo", "goal": "avoid_relegation"}]'
    .venv/bin/python scripts/tools/skenaario.py '[{"team": "Ilves", "result": "win", "games": 2}]'

Lähde: snowflake/LIIGA/MODEL/procedures/SIMULATE_SCENARIO/simulate_scenario.py (tiedoston ohje kertoo muodon).
Paikallinen kanta on kehitysympäristö: luvut vastaavat Snowflakea kun molemmat
ovat samasta aamun ajosta.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location(
    "simulate_scenario", ROOT / "snowflake/LIIGA/MODEL/procedures/SIMULATE_SCENARIO/simulate_scenario.py")
sim = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sim)


def load(con) -> tuple:
    snap = con.execute("SELECT MAX(snapshot_date) FROM prediction_games").fetchone()[0]
    games = [dict(zip(["date", "iso", "home_team", "away_team", "p_home_reg", "p_overtime", "p_home_ot_win"], r))
             for r in con.execute("""
        SELECT strftime(CAST(s.start_ts AS TIMESTAMPTZ) AT TIME ZONE 'Europe/Helsinki', '%d.%m.'),
               strftime(CAST(s.start_ts AS TIMESTAMPTZ) AT TIME ZONE 'Europe/Helsinki', '%Y-%m-%d'),
               p.home_team, p.away_team, p.p_home_reg, p.p_overtime, p.p_home_ot_win
        FROM prediction_games p JOIN stg_games s ON s.season = 2027 AND s.game_id = p.game_id
        WHERE p.snapshot_date = ? AND NOT s.ended
        ORDER BY CAST(s.start_ts AS TIMESTAMPTZ), p.game_id""", [snap]).fetchall()]
    banked, played = {}, {}
    for h, a, hp, ap in con.execute("""SELECT home_team, away_team, home_points, away_points
                                       FROM stg_games WHERE season = 2027 AND ended""").fetchall():
        banked[h] = banked.get(h, 0) + hp
        banked[a] = banked.get(a, 0) + ap
        played[h] = played.get(h, 0) + 1
        played[a] = played.get(a, 0) + 1
    zones = {}
    for row in con.execute("SELECT * FROM position_distribution_2026_27").df().to_dict("records"):
        n = len([k for k in row if k.startswith("rank_")])
        zones[row["team"]] = (sum(row[f"rank_{i}"] for i in range(1, 7)),
                              sum(row[f"rank_{i}"] for i in range(n - 2, n + 1)))
    published = {t: {"points": pts, "p_title": pt, "p_top6": zones[t][0], "p_relegation": zones[t][1]}
                 for t, pts, pt in con.execute("SELECT team, mean_points, p_title FROM standings_2026_27").fetchall()}
    w = con.execute("SELECT crowd_weight_eff FROM prediction_meta").fetchone()[0] or 0.0
    return games, banked, published, float(w), str(snap), played


def load_model(con) -> dict:
    players = con.execute("SELECT name, team, position_group, projected_goals_per_game FROM player_rates") \
        .df().to_dict("records")
    goalies = [{**g, "proj_save_pct": None if g["proj_save_pct"] != g["proj_save_pct"] else g["proj_save_pct"]}
               for g in con.execute("SELECT team, name, proj_save_pct, wt FROM team_goalie_weights").df().to_dict("records")]
    strength = {r[0]: {"off_rating": r[1], "def_rating": r[2]}
                for r in con.execute("SELECT team, off_rating, def_rating FROM team_strength").fetchall()}
    import datetime as dt
    from zoneinfo import ZoneInfo
    today = dt.datetime.now(ZoneInfo("Europe/Helsinki")).date().isoformat()
    return {"players": players, "goalies": goalies, "strength": strength, "today": today}


def run(scenario: str) -> str:
    con = duckdb.connect(str(ROOT / "data/liiga.duckdb"), read_only=True)
    try:
        sc = sim.parse(scenario)
        games, banked, published, w, snap, played = load(con)
        model = load_model(con) if any(it.get("injury") for it in sc) else None
        d = f"{int(snap[8:10])}.{int(snap[5:7])}.{snap[:4]}"
        return sim.render(sim.compute(sc, games, banked, published, w, played, model), d)
    except sim.ScenarioError as exc:
        return f"SKENAARIOTA EI VOITU AJAA: {exc}"
    finally:
        con.close()


if __name__ == "__main__":
    print(run(sys.argv[1] if len(sys.argv) > 1 else '[{"injury": "Maxime Fortier"}]'))
