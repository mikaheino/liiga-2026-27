"""Sijaintijakauman historia ja skenaariopaneelin JSON (6.11.2026).

- pipeline.persist() tallentaa jakauman päivittäin ja korvaa saman päivän rivit
  (idempotentti kuten prediction_history) -- etusivun kelaus lukee tätä.
- backfill_position_history: git-versioista luku, saman päivän uusin ajo ja
  kirjoitus, joka ei koske putken jo tallentamiin päiviin.
- skenaario.py --json: sovelluksen skenaariopaneelin rakenteinen tulos samasta
  moottorista kuin agentin liiga_skenaario.
"""
import importlib.util
import json
from pathlib import Path

import duckdb
import pandas as pd
import pytest

from liiga.pipeline import POSITION_HISTORY_COLUMNS, persist

ROOT = Path(__file__).resolve().parents[1]
RANKS = [f"rank_{k}" for k in range(1, 18)]


def _load(name: str, rel: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


backfill = _load("backfill_position_history", "scripts/tools/backfill_position_history.py")


def _pos(teams=("KooKoo", "Tappara")) -> pd.DataFrame:
    rows = []
    for i, t in enumerate(teams):
        p = [0.0] * 17
        p[16 - i] = 1.0
        rows.append({"team": t, **dict(zip(RANKS, p, strict=True))})
    return pd.DataFrame(rows)


def _res(today: str, played: int) -> dict:
    pos = _pos()
    ph = pos.copy()
    ph.insert(0, "snapshot_date", today)
    ph.insert(1, "games_played", played)
    hist = pd.DataFrame([{"snapshot_date": today, "games_played": played, "proj_rank": 1, "team": "KooKoo",
                          "mean_points": 70.0, "p_title": 0.0, "p_top_playoff": 0.0}])
    return {"today": today, "history": hist, "games": pd.DataFrame(columns=["snapshot_date"]),
            "standings": pd.DataFrame([{"team": "KooKoo", "proj_rank": 1}]), "position": pos,
            "meta": pd.DataFrame([{"updated_at": f"{today}T05:30:00+00:00", "games_played": played}]),
            "position_history": ph,
            "line_history": pd.DataFrame([{"snapshot_date": today, "games_played": played, "line_rank": 14,
                                           "line_likely": 78.0, "line_safe": 85.0}])}


def test_persist_keeps_one_snapshot_per_day():
    con = duckdb.connect(":memory:")
    persist(_res("2026-11-05", 160), con)
    persist(_res("2026-11-05", 161), con)            # uusinta samana päivänä korvaa
    persist(_res("2026-11-06", 161), con)
    df = con.execute("SELECT * FROM position_distribution_history ORDER BY snapshot_date, team").df()
    assert list(df.columns) == POSITION_HISTORY_COLUMNS
    assert df.groupby("snapshot_date").size().to_dict() == {"2026-11-05": 2, "2026-11-06": 2}
    assert set(df[df.snapshot_date == "2026-11-05"].games_played) == {161}
    lines = con.execute("SELECT snapshot_date, games_played, line_likely FROM line_history ORDER BY 1").fetchall()
    assert lines == [("2026-11-05", 161, 78.0), ("2026-11-06", 161, 78.0)]


def _version(path: Path, updated_at: str, played: int, with_pos: bool = True) -> Path:
    con = duckdb.connect(str(path))
    con.execute("CREATE TABLE prediction_meta AS SELECT ? AS updated_at, ? AS games_played", [updated_at, played])
    if with_pos:
        con.register("p", _pos())
        con.execute("CREATE TABLE position_distribution_2026_27 AS SELECT * FROM p")
    con.close()
    return path


def test_read_snapshot(tmp_path):
    got = backfill.read_snapshot(_version(tmp_path / "a.duckdb", "2026-10-02T05:30:07+00:00", 70))
    assert got is not None
    updated_at, df = got
    assert updated_at.startswith("2026-10-02")
    assert list(df.columns) == backfill.COLUMNS
    assert set(df.snapshot_date) == {"2026-10-02"} and set(df.games_played) == {70}
    assert backfill.read_snapshot(_version(tmp_path / "b.duckdb", "2026-08-01T00:00:00", 0, with_pos=False)) is None


def test_latest_per_day_and_write_skip_existing(tmp_path):
    early = backfill.read_snapshot(_version(tmp_path / "1.duckdb", "2026-10-09T05:00:00+00:00", 86))
    late = backfill.read_snapshot(_version(tmp_path / "2.duckdb", "2026-10-09T18:00:00+00:00", 88))
    other = backfill.read_snapshot(_version(tmp_path / "3.duckdb", "2026-10-10T05:30:00+00:00", 94))
    best = backfill.latest_per_day([early, late, other])
    assert set(best) == {"2026-10-09", "2026-10-10"}
    assert best["2026-10-09"][0].startswith("2026-10-09T18")      # saman päivän uusin ajo

    con = duckdb.connect(":memory:")
    assert backfill.write(con, {"2026-10-09": best["2026-10-09"]}) == ["2026-10-09"]
    assert backfill.write(con, best, dry=True) == ["2026-10-10"]     # kuivaharjoitus ei kirjoita
    assert backfill.write(con, best) == ["2026-10-10"]               # olemassa oleva päivä ohitetaan
    assert backfill.write(con, best) == []
    n = con.execute("SELECT snapshot_date, MAX(games_played) FROM position_distribution_history GROUP BY 1 ORDER BY 1").fetchall()
    assert n == [("2026-10-09", 88), ("2026-10-10", 94)]


@pytest.fixture(scope="module")
def skenaario():
    return _load("skenaario", "scripts/tools/skenaario.py")


def test_scenario_json(skenaario):
    out = json.loads(skenaario.run_json('[{"team": "KooKoo", "goal": "avoid_relegation"}]'))
    req = out["requirements"][0]
    assert 0.0 <= req["p"] <= 1.0
    assert req["limit"] == 14 and req["remaining"] > 0
    assert {"0.5", "0.8", "0.95"} <= set(req["need"])
    assert out["forecast_date"]


def test_scenario_json_error(skenaario):
    out = json.loads(skenaario.run_json('[{"team": "Eiole", "goal": "top6"}]'))
    assert "error" in out


# --- Puuttuvien päivien uudelleenlaskenta (rebuild_position_history.py) -------------

rebuild = _load("rebuild_position_history", "scripts/tools/rebuild_position_history.py")


def test_run_time_follows_finnish_clock():
    assert rebuild.run_time("2026-10-02").strftime("%H:%M") == "05:30"     # kesäaika (UTC+3)
    assert rebuild.run_time("2026-10-27").strftime("%H:%M") == "06:30"     # talviaika (UTC+2)


def _out(points: dict[str, float], played: int = 70) -> dict:
    pos = [{"team": t, **{r: (1.0 if i == k else 0.0) for k, r in enumerate(RANKS)}} for i, t in enumerate(points)]
    st = [{"team": t, "proj_rank": i + 1, "mean_points": p} for i, (t, p) in enumerate(points.items())]
    return {"n_played": played, "position": pos, "standings": st}


def test_compare_exact_and_off():
    hist = pd.DataFrame([{"team": "Lukko", "games_played": 70, "proj_rank": 1, "mean_points": 110.0},
                         {"team": "KooKoo", "games_played": 70, "proj_rank": 2, "mean_points": 70.0}])
    dist = pd.DataFrame(_out({"Lukko": 110.0, "KooKoo": 70.0})["position"])
    ok = rebuild.compare(_out({"Lukko": 110.0, "KooKoo": 70.0}), hist, dist)
    assert ok["ok"] and ok["max_points_diff"] == 0.0 and ok["max_cell_diff_pp"] == 0.0
    off = rebuild.compare(_out({"Lukko": 110.2, "KooKoo": 70.0}), hist, None)
    assert not off["ok"] and off["max_points_diff"] == pytest.approx(0.2)
    wrong_n = rebuild.compare(_out({"Lukko": 110.0, "KooKoo": 70.0}, played=69), hist, None)
    assert not wrong_n["ok"]


def _games_db(path: Path, ended: list[int], all_games=(1, 2, 3, 4)) -> Path:
    con = duckdb.connect(str(path))
    con.execute("CREATE TABLE raw_games (season INT, game_id INT, start_time VARCHAR, ended BOOLEAN, home_goals INT)")
    for g in all_games:
        con.execute("INSERT INTO raw_games VALUES (2027, ?, ?, ?, ?)", [g, f"2026-10-0{g}T16:30:00", g in ended, 3 if g in ended else None])
    con.execute("CREATE TABLE raw_goal_events (season INT, game_id INT, player_id INT)")
    for g in ended:
        con.execute("INSERT INTO raw_goal_events VALUES (2027, ?, 7)", [g])
    con.close()
    return path


def test_advance_adds_games_played_by_then(tmp_path, monkeypatch):
    monkeypatch.setattr(rebuild, "DB", _games_db(tmp_path / "now.duckdb", ended=[1, 2, 3, 4]))
    wt = _games_db(tmp_path / "then.duckdb", ended=[1])
    assert rebuild.advance(wt, 3) == 2                          # ottelut 2 ja 3 lisätään, 4 ei
    con = duckdb.connect(str(wt), read_only=True)
    assert [r[0] for r in con.execute("SELECT game_id FROM raw_games WHERE ended ORDER BY 1").fetchall()] == [1, 2, 3]
    assert con.execute("SELECT COUNT(*) FROM raw_goal_events").fetchone()[0] == 3
    con.close()
    assert rebuild.advance(wt, 3) == 0                          # toinen kerta: ei mitään
    with pytest.raises(SystemExit):
        rebuild.advance(wt, 2)                                  # kanta jo pidemmällä kuin D


def _line_db(path: Path) -> Path:
    con = duckdb.connect(str(path))
    con.execute("CREATE TABLE prediction_meta AS SELECT '2026-11-06T05:30:00+00:00' AS updated_at")
    con.execute("CREATE TABLE position_distribution_history (snapshot_date VARCHAR, games_played INT, team VARCHAR)")
    for d, gp in [("2026-08-30", 0), ("2026-10-02", 70), ("2026-10-20", 117), ("2026-11-06", 161)]:
        con.execute("INSERT INTO position_distribution_history VALUES (?, ?, 'KooKoo')", [d, gp])
    con.close()
    return path


def test_line_days_and_write_line(tmp_path, monkeypatch):
    monkeypatch.setattr(rebuild, "DB", _line_db(tmp_path / "now.duckdb"))
    assert rebuild.line_days() == ["2026-10-02", "2026-10-20"]          # ei esikautta eikä tätä päivää
    assert rebuild.write_line("2026-10-02", {"n_played": 70, "line": {"line_rank": 14, "line_likely": None}}) is False
    line = {"line_rank": 14, "line_likely": 80, "line_safe": 86}
    assert rebuild.write_line("2026-10-02", {"n_played": 70, "line": line}) is True
    assert rebuild.write_line("2026-10-02", {"n_played": 70, "line": line}) is True   # uusinta korvaa
    assert rebuild.line_days() == ["2026-10-20"]
    con = duckdb.connect(str(rebuild.DB), read_only=True)
    assert con.execute("SELECT snapshot_date, games_played, line_likely, line_safe FROM line_history").fetchall() == [("2026-10-02", 70, 80, 86)]
    con.close()
