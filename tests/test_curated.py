"""liiga.curated (22.11.2026): sormenjälki ratkaisee, kirjoitetaanko; ensimmäinen ajo vain kirjaa."""
from __future__ import annotations

from types import SimpleNamespace

import duckdb
import pytest

from liiga import curated


@pytest.fixture
def con(monkeypatch, tmp_path):
    files = {f: tmp_path / f.split("/")[-1] for f in [*curated.CSV_TABLES.values(), *curated.LOADER_FILES.values(),
                                                       *curated.RATE_FILES]}
    for p in files.values():
        p.write_text("league,goals_factor,notes\nX,1.0,a\n", encoding="utf-8")
    monkeypatch.setattr(curated, "resolve_path", lambda f: files[f])
    monkeypatch.setattr(curated, "load_config", lambda: {"players": {"k": 1}, "ingestion": {"target_season": 2027}})
    c = duckdb.connect()
    c.execute("CREATE TABLE player_bio (player_id BIGINT, season BIGINT, first_name VARCHAR, last_name VARCHAR, "
              "date_of_birth VARCHAR, position_group VARCHAR, role VARCHAR, nationality VARCHAR)")
    c.execute("INSERT INTO player_bio VALUES (1, 2026, 'A', 'A', '2000-01-01', 'F', 'CENTER', 'FIN')")
    c.execute("CREATE TABLE game_lineups (game_id BIGINT, season BIGINT, player_id BIGINT, first_name VARCHAR, "
              "last_name VARCHAR, date_of_birth VARCHAR, position_group VARCHAR, role VARCHAR, nationality VARCHAR)")
    c.execute("INSERT INTO game_lineups VALUES (5, 2027, 1, 'Z', 'Z', '1999-01-01', 'D', 'X', 'SWE'), "
              "(6, 2027, 2, 'B', 'B', '2001-01-01', 'D', 'LEFT_DEFENSEMAN', 'FIN'), "
              "(4, 2026, 2, 'B', 'B', '2001-01-01', 'F', 'old', 'FIN')")
    loads, rebuilds = [], []
    monkeypatch.setattr(curated, "_load", lambda con, t: loads.append(t) or 1)
    monkeypatch.setattr(curated, "rebuild_rates", lambda con: rebuilds.append(1) or {"player_rates": 1})
    return SimpleNamespace(db=c, files=files, loads=loads, rebuilds=rebuilds)


def test_first_run_adopts_then_only_changes_write(con):
    first = curated.sync(con.db)
    assert con.loads == [] and con.rebuilds == []                  # ensimmäinen ajo ei kirjoita tauluja
    assert first["league_factors"] == first["player_rates"] == "adopted"
    assert curated.sync(con.db) == {"player_bio": "+0"}                # ei muutoksia -> ei kirjoituksia
    con.files["data/league_factors.csv"].write_text("league,goals_factor,notes\nX,0.9,b\n", encoding="utf-8")
    out = curated.sync(con.db)
    assert con.loads == ["league_factors"] and con.rebuilds == [1]  # league_factors on myös mallin syöte
    assert out["league_factors"] == "loaded 1" and out["player_rates"].startswith("rebuilt")
    assert curated.sync(con.db) == {"player_bio": "+0"}


def test_bios_only_appended_existing_untouched(con):
    assert curated.append_missing_bios(con.db) == 1
    rows = con.db.execute("SELECT player_id, first_name, position_group, role FROM player_bio ORDER BY 1").fetchall()
    assert rows == [(1, "A", "F", "CENTER"), (2, "B", "D", "LEFT_DEFENSEMAN")]   # uusin ottelu, vanha ennallaan
    assert curated.append_missing_bios(con.db) == 0
