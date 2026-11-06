"""Mitä jos? -simulaattori paikallisesti: sama koodi ja sama vastaus kuin Snowflake-
agentin työkalulla liiga_skenaario, mutta data paikallisesta DuckDB:stä.

    .venv/bin/python scripts/tools/skenaario.py '[{"injury": "Maxime Fortier"}]'
    .venv/bin/python scripts/tools/skenaario.py '[{"team": "KooKoo", "goal": "avoid_relegation"}]'
    .venv/bin/python scripts/tools/skenaario.py '[{"team": "Ilves", "result": "win", "games": 2}]'
    .venv/bin/python scripts/tools/skenaario.py --json '<JSON>'   # rakenteinen tulos (sovellus)
    .venv/bin/python scripts/tools/skenaario.py --json --today 2026-10-27 '<JSON>'   # injektoitu päivä
    printf '%s\n' '[]' '[{"stakes": {"days": 7}}]' | .venv/bin/python scripts/tools/skenaario.py --batch
        # JSONL: yksi skenaario per rivi, yksi lataus ja yksi perustaso (Pages-käännös)

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
    games = [dict(zip(["date", "iso", "game_id", "home_team", "away_team", "p_home_reg", "p_overtime", "p_home_ot_win"], r))
             for r in con.execute("""
        SELECT strftime(CAST(s.start_ts AS TIMESTAMPTZ) AT TIME ZONE 'Europe/Helsinki', '%d.%m.'),
               strftime(CAST(s.start_ts AS TIMESTAMPTZ) AT TIME ZONE 'Europe/Helsinki', '%Y-%m-%d'),
               CAST(p.game_id AS BIGINT), p.home_team, p.away_team, p.p_home_reg, p.p_overtime, p.p_home_ot_win
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
                              sum(row[f"rank_{i}"] for i in range(n - 2, n + 1)),
                              sum(row[f"rank_{i}"] for i in range(1, 11)))
    published = {t: {"points": pts, "p_title": pt, "p_top6": zones[t][0], "p_relegation": zones[t][1],
                     "p_top10": zones[t][2]}
                 for t, pts, pt in con.execute("SELECT team, mean_points, p_title FROM standings_2026_27").fetchall()}
    w = con.execute("SELECT crowd_weight_eff FROM prediction_meta").fetchone()[0] or 0.0
    return games, banked, published, float(w), str(snap), played


def load_model(con, today: str | None = None) -> dict:
    players = con.execute("SELECT name, team, position_group, projected_goals_per_game, player_id FROM player_rates") \
        .df().to_dict("records")
    goalies = [{**g, "proj_save_pct": None if g["proj_save_pct"] != g["proj_save_pct"] else g["proj_save_pct"]}
               for g in con.execute("SELECT team, name, proj_save_pct, wt FROM team_goalie_weights").df().to_dict("records")]
    strength = {r[0]: {"off_rating": r[1], "def_rating": r[2]}
                for r in con.execute("SELECT team, off_rating, def_rating FROM team_strength").fetchall()}
    import datetime as dt
    from zoneinfo import ZoneInfo
    today = today or dt.datetime.now(ZoneInfo("Europe/Helsinki")).date().isoformat()
    return {"players": players, "goalies": goalies, "strength": strength, "today": today}


def _connect():
    return duckdb.connect(str(ROOT / "data/liiga.duckdb"), read_only=True)


def run_json(scenario: str, today: str | None = None) -> str:
    """Sama laskenta rakenteisena (6.11.2026): sovelluksen skenaariopaneeli
    (app/api/skenaario) piirtää tuloksen itse, agentti saa saman tekstinä."""
    return next(iter(run_batch([scenario], today)))


def run_batch(scenarios, today: str | None = None):
    """Monta skenaariota yhdellä latauksella ja yhdellä perustasolla (JSON-rivit)."""
    import json
    con = _connect()
    try:
        games, banked, published, w, snap, played = load(con)
        model = None
        base = sim.simulate(games, banked, sorted(published))
        for scenario in scenarios:
            try:
                sc = sim.parse(scenario, allow_empty=True)
                if model is None and sim.needs_model(sc):
                    model = load_model(con, today)
                res = sim.compute(sc, games, banked, published, w, played,
                                  model if sim.needs_model(sc) else None, base=base, today=today)
                yield sim.to_json(res, str(snap))
            except sim.ScenarioError as exc:
                yield json.dumps({"error": str(exc)}, ensure_ascii=False)
    finally:
        con.close()


def run_panel(request: str, today: str | None = None) -> str:
    """Joukkuesivun skenaariopaneeli (app/api/skenaario): sama muoto kuin Snowflaken
    MODE 'panel' ja Pagesin esilaskettu tiedosto."""
    import json
    con = _connect()
    try:
        games, banked, published, w, snap, played = load(con)
        team, goal, streak = sim.panel_request(json.loads(request), sorted(published))
        res = sim.panel(team, (goal,), streak, games, banked, published, w, played, today=today)[goal]
        return sim.to_json({**res, "forecastDate": str(snap)}, str(snap))
    except (sim.ScenarioError, ValueError) as exc:
        return json.dumps({"error": str(exc)}, ensure_ascii=False)
    finally:
        con.close()


def load_lineups(con) -> list[dict]:
    sql = sim.LINEUP_SQL.format(lineups="game_lineups", games="stg_games")
    return [dict(zip(["team", "game_key", "player_id", "name"], r)) for r in con.execute(sql).fetchall()]


def run_absence(request: str, today: str | None = None) -> str:
    """Joukkuesivun poissaolokortti: sama muoto kuin Snowflaken MODE 'absence'."""
    import json
    con = _connect()
    try:
        games, banked, published, w, snap, played = load(con)
        team = sim._team_of({t.lower(): t for t in published}, json.loads(request).get("team"))
        res = sim.absence(team, load_lineups(con), games, banked, published, w, played, load_model(con, today),
                          today=today)
        return sim.to_json({**res, "forecastDate": str(snap)}, str(snap))
    except (sim.ScenarioError, ValueError) as exc:
        return json.dumps({"error": str(exc)}, ensure_ascii=False)
    finally:
        con.close()


def run(scenario: str) -> str:
    con = _connect()
    try:
        sc = sim.parse(scenario)
        games, banked, published, w, snap, played = load(con)
        model = load_model(con) if sim.needs_model(sc) else None
        d = f"{int(snap[8:10])}.{int(snap[5:7])}.{snap[:4]}"
        return sim.render(sim.compute(sc, games, banked, published, w, played, model), d)
    except sim.ScenarioError as exc:
        return f"SKENAARIOTA EI VOITU AJAA: {exc}"
    finally:
        con.close()


def main(argv: list[str]) -> None:
    today = None
    if "--today" in argv:
        i = argv.index("--today")
        today = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    if argv and argv[0] == "--batch":
        for out in run_batch((ln for ln in sys.stdin if ln.strip()), today):
            print(out, flush=True)
    elif argv and argv[0] == "--absence":
        print(run_absence(argv[1], today))
    elif argv and argv[0] == "--panel":
        print(run_panel(argv[1], today))
    elif argv and argv[0] == "--json":
        print(run_json(argv[1] if len(argv) > 1 else "[]", today))
    else:
        print(run(argv[0] if argv else '[{"injury": "Maxime Fortier"}]'))


if __name__ == "__main__":
    main(sys.argv[1:])
