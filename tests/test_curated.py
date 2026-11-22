"""liiga.curated (22.-23.11.2026): sisällön mukainen omaksuminen, poikkeaman lataus, alustusmerkki,
transaktiot (taulu + tila samassa) ja player_bion täydennys."""
from __future__ import annotations

from types import SimpleNamespace

import duckdb
import pandas as pd
import pytest

from liiga import curated

LF = "league,goals_factor,notes\nSHL,0.9,a\nDEL,0.8,b\n"


@pytest.fixture
def env(monkeypatch, tmp_path):
    files = {"data/league_factors.csv": tmp_path / "lf.csv", "data/transfers.txt": tmp_path / "t.txt"}
    files["data/league_factors.csv"].write_text(LF, encoding="utf-8")
    files["data/transfers.txt"].write_text("x", encoding="utf-8")
    monkeypatch.setattr(curated, "resolve_path", lambda f: files[f])
    monkeypatch.setattr(curated, "CSV_TABLES", {"league_factors": "data/league_factors.csv"})
    monkeypatch.setattr(curated, "LOADER_FILES", {})
    monkeypatch.setattr(curated, "RATE_FILES", ["data/transfers.txt"])
    monkeypatch.setattr(curated, "load_config", lambda: {"players": {"k": 1}, "ingestion": {"target_season": 2027}})
    c = duckdb.connect()
    c.execute("CREATE TABLE league_factors (LEAGUE VARCHAR, GOALS_FACTOR DOUBLE NOT NULL, NOTES VARCHAR)")
    c.execute("INSERT INTO league_factors VALUES ('SHL', 0.9, 'a'), ('DEL', 0.8, 'b')")
    for t in curated.RATE_TABLES:
        c.execute(f"CREATE TABLE {t} (V INTEGER)")
        c.execute(f"INSERT INTO {t} VALUES (0)")
    c.execute("CREATE TABLE player_bio (player_id BIGINT, season BIGINT, first_name VARCHAR, last_name VARCHAR, "
              "date_of_birth VARCHAR, position_group VARCHAR, role VARCHAR, nationality VARCHAR)")
    c.execute("CREATE TABLE game_lineups (game_id BIGINT, season BIGINT, player_id BIGINT, first_name VARCHAR, "
              "last_name VARCHAR, date_of_birth VARCHAR, position_group VARCHAR, role VARCHAR, nationality VARCHAR)")
    rebuilds = []

    def fake_rates(con):
        rebuilds.append(1)
        return {t: pd.DataFrame({"v": [len(rebuilds)]}) for t in curated.RATE_TABLES}

    monkeypatch.setattr(curated, "compute_rates", fake_rates)
    return SimpleNamespace(db=c, files=files, rebuilds=rebuilds)


def lf(env):
    return sorted(env.db.execute("SELECT league, goals_factor FROM league_factors").fetchall())


def test_first_run_adopts_equal_content_and_marks_initialized(env):
    out = curated.sync(env.db)
    assert out["league_factors"] == "adopted" and out[curated.RATES] == "adopted" and env.rebuilds == []
    assert curated.SENTINEL in curated.read_state(env.db)
    assert curated.sync(env.db) == {"player_bio": "+0"}        # ei muutoksia -> ei kirjoituksia


def test_first_run_loads_drifted_table_and_logs_it(env):
    env.db.execute("DELETE FROM league_factors WHERE league = 'DEL'")
    out = curated.sync(env.db)
    assert out["league_factors"].endswith("(drift)") and lf(env) == [("DEL", 0.8), ("SHL", 0.9)]
    assert env.db.execute("SELECT status FROM pipeline_checks").fetchall() == [("DRIFT",)]
    assert curated.sync(env.db) == {"player_bio": "+0"}


def test_already_adopted_but_drifted_is_reverified_once(env):
    curated.write_state(env.db, "league_factors", curated.fingerprint(["data/league_factors.csv"]), "adopted")
    env.db.execute("UPDATE league_factors SET goals_factor = 0.7 WHERE league = 'DEL'")
    assert curated.sync(env.db)["league_factors"].endswith("(drift)") and lf(env) == [("DEL", 0.8), ("SHL", 0.9)]


def test_after_initialization_missing_state_row_means_load_not_adopt(env):
    curated.sync(env.db)
    env.db.execute("DELETE FROM pipeline_state WHERE name = 'league_factors'")
    env.db.execute("UPDATE league_factors SET goals_factor = 0.1")
    assert curated.sync(env.db)["league_factors"].endswith("(state row missing)") and lf(env)[0][1] == 0.8


def test_file_change_and_rate_inputs_rebuild_atomically(env):
    curated.sync(env.db)
    env.files["data/league_factors.csv"].write_text(LF.replace("0.8", "0.85"), encoding="utf-8")
    env.files["data/transfers.txt"].write_text("y", encoding="utf-8")
    out = curated.sync(env.db)
    assert out["league_factors"].endswith("(file changed)") and lf(env) == [("DEL", 0.85), ("SHL", 0.9)]
    assert env.rebuilds == [1] and out[curated.RATES].startswith("rebuilt")
    assert all(env.db.execute(f"SELECT v FROM {t}").fetchall() == [(1,)] for t in curated.RATE_TABLES)
    # NOT NULL säilyy (DELETE + INSERT, ei CREATE OR REPLACE)
    with pytest.raises(duckdb.ConstraintException):
        env.db.execute("INSERT INTO league_factors VALUES ('X', NULL, '')")


def test_failed_write_rolls_back_table_and_state(env, monkeypatch):
    curated.sync(env.db)
    fp_before = curated.read_state(env.db)["league_factors"]
    bad = pd.DataFrame({"league": ["X"], "goals_factor": [None], "notes": ["n"]})   # rikkoo NOT NULLin
    with pytest.raises(duckdb.ConstraintException):
        curated.replace_tables(env.db, {"league_factors": bad}, [("league_factors", "new", "x")])
    assert lf(env) == [("DEL", 0.8), ("SHL", 0.9)] and curated.read_state(env.db)["league_factors"] == fp_before


def test_bios_append_and_fill_from_latest_non_null(env):
    env.db.execute("INSERT INTO player_bio VALUES (1, 2026, 'A', 'A', NULL, 'F', 'CENTER', 'FIN')")
    env.db.execute("INSERT INTO game_lineups VALUES (5, 2027, 1, 'Z', 'Z', '1999-01-01', 'D', 'X', 'SWE'), "
                   "(6, 2027, 2, 'B', 'B', '2001-01-01', 'D', NULL, 'FIN'), "
                   "(4, 2027, 2, 'B', 'B', '2001-01-01', 'D', 'LEFT_DEFENSEMAN', 'FIN')")
    assert curated.append_missing_bios(env.db) == 1
    rows = env.db.execute("SELECT player_id, first_name, date_of_birth, role FROM player_bio ORDER BY 1").fetchall()
    # 1: vain puuttuva syntymäaika täytetään, muut ennallaan; 2: rooli viimeisimmästä ottelusta, jossa se annettiin
    assert rows == [(1, "A", "1999-01-01", "CENTER"), (2, "B", "2001-01-01", "LEFT_DEFENSEMAN")]
    assert curated.append_missing_bios(env.db) == 0
