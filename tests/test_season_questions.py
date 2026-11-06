"""Kauden kysymykset (scripts/tools/season_questions.py, J2/V7): lukituksen tila jakson
pelatuista otteluista ja kysymyslistan muoto."""
from __future__ import annotations

import sys
from pathlib import Path

import duckdb
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "tools"))
import season_questions as sq  # noqa: E402

LOCK = {"team": "HPK", "result": "loss", "from": "2026-12-20", "until": "2027-01-06"}


def _con(games: list[tuple]) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    con.execute("""CREATE TABLE stg_games (season INT, start_ts VARCHAR, home_team VARCHAR, away_team VARCHAR,
                   ended BOOLEAN, home_points INT, away_points INT)""")
    for g in games:
        con.execute("INSERT INTO stg_games VALUES (2027, ?, ?, ?, ?, ?, ?)", list(g))
    return con


@pytest.mark.parametrize("games,state", [
    # jakso alkamatta: kesken
    ([("2026-12-20T15:00:00Z", "HPK", "TPS", False, None, None)], "open"),
    # hävitty (myös jatkoajalla) ja yksi jäljellä: kesken
    ([("2026-12-20T15:00:00Z", "HPK", "TPS", True, 0, 3), ("2026-12-27T15:00:00Z", "Ilves", "HPK", True, 2, 1),
      ("2027-01-03T15:00:00Z", "HPK", "Lukko", False, None, None)], "open"),
    # kaikki hävitty: ehto toteutui
    ([("2026-12-20T15:00:00Z", "HPK", "TPS", True, 0, 3), ("2027-01-06T16:00:00Z", "Ilves", "HPK", True, 3, 0)], "held"),
    # voitto jaksolla: ehto rikki
    ([("2026-12-20T15:00:00Z", "HPK", "TPS", True, 3, 0), ("2027-01-03T15:00:00Z", "HPK", "Lukko", False, None, None)],
     "failed"),
    # jakson ulkopuolinen voitto (19.12.) ei vaikuta
    ([("2026-12-19T12:00:00Z", "HPK", "TPS", True, 3, 0), ("2026-12-20T15:00:00Z", "HPK", "TPS", False, None, None)],
     "open"),
])
def test_lock_state(games, state):
    assert sq.lock_state(_con(games), LOCK) == state


def test_questions_file():
    qs = sq.questions()
    assert len({q["id"] for q in qs}) == len(qs)
    for q in qs:
        assert q["goal"] in sq.ENGINE_GOAL
        assert q["short"] and q["label"].endswith("?")
        if q.get("lock"):
            assert q["lock"]["from"] <= q["lock"]["until"]
