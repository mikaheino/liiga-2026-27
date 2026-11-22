"""scripts/news/publish_news.py (22.11.2026): yksi transaktio, uutisteksti lainattu."""
from __future__ import annotations

import sys
from pathlib import Path

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "news"))
import publish_news  # noqa: E402


def test_literals_are_escaped():
    assert publish_news.lit(None) == "NULL"
    assert publish_news.lit("O'Neil \\ x') ; DROP TABLE y; --") == "'O''Neil \\\\ x'') ; DROP TABLE y; --'"


def test_sql_is_one_transaction():
    c = duckdb.connect()
    c.execute("CREATE TABLE news_signals (published VARCHAR, source VARCHAR, team VARCHAR, kind VARCHAR, player VARCHAR)")
    c.execute("INSERT INTO news_signals VALUES ('2026-11-21', 'Yle', 'HPK', 'injury', 'A B')")
    c.execute("CREATE TABLE news_absence_log (approved_at VARCHAR, url_hash VARCHAR, player VARCHAR, team VARCHAR, "
              "kind VARCHAR, start VARCHAR, until VARCHAR)")
    sql, counts = publish_news.build_sql(c)
    assert counts == {"news_signals": 1, "news_absence_log": 0}
    lines = sql.strip().splitlines()
    assert lines[0] == "BEGIN;" and lines[-1] == "COMMIT;"
    assert "DELETE FROM LIIGA.MODEL.NEWS_ABSENCE_LOG;" in sql and sql.count("INSERT INTO") == 1
