"""scripts/news/publish_news.py (22.-23.11.2026): tyhjäavaimiset pois, suojaus tyhjenemistä vastaan, transaktio."""
from __future__ import annotations

import sys
from pathlib import Path

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "news"))
import publish_news  # noqa: E402


def _db():
    c = duckdb.connect()
    c.execute("CREATE TABLE news_signals (published VARCHAR, source VARCHAR, team VARCHAR, kind VARCHAR, player VARCHAR)")
    c.execute("INSERT INTO news_signals VALUES ('2026-11-21', 'Yle', 'HPK', 'injury', 'A B'), (NULL, 'Yle', 'HPK', 'injury', 'C D'), "
              "('2026-11-21', 'Yle', '', 'injury', 'E F')")
    c.execute("CREATE TABLE news_absence_log (approved_at VARCHAR, url_hash VARCHAR, player VARCHAR, team VARCHAR, "
              "kind VARCHAR, start VARCHAR, until VARCHAR)")
    c.execute("INSERT INTO news_absence_log VALUES ('t', 'h1', 'A B', 'HPK', 'out', '2026-11-01', '2026-11-30'), "
              "('t', NULL, 'A B', 'HPK', 'out', '', ''), ('t', 'h2', '', '', 'dismiss', '', ''), "
              "('t', 'h3', NULL, 'HPK', 'out', '', '')")
    return c


def test_rows_with_empty_keys_are_dropped_but_optional_columns_may_be_null():
    rows, dropped = publish_news.read_rows(_db())
    assert len(rows["news_signals"]) == 2 and dropped == {"news_signals": 1, "news_absence_log": 2}
    assert ("t", "h2", "", "", "dismiss", "", "") in rows["news_absence_log"]     # perutun uutisen rivi säilyy


def test_guard_blocks_empty_and_big_drops():
    assert publish_news.guard({"a": 0, "b": 10}, {"a": 5, "b": 10}) == ["a: 0 riviä"]
    assert publish_news.guard({"a": 4}, {"a": 10})[0].startswith("a: 4 riviä")
    assert publish_news.guard({"a": 5}, {"a": 10}) == [] and publish_news.guard({"a": 1}, {"a": 0}) == []
    assert publish_news.guard({"a": 0}, {"a": 5}, force=True) == []


class _Cur:
    def __init__(self, log, fail_on=None):
        self.log, self.fail_on = log, fail_on

    def execute(self, sql, *a):
        self.log.append(sql.split()[0])
        if self.fail_on and sql.startswith(self.fail_on):
            raise RuntimeError("boom")
        return self

    def executemany(self, sql, rows):
        self.log.append(f"INSERT x{len(rows)}")


class _Conn:
    def __init__(self, fail_on=None):
        self.log, self.fail_on = [], fail_on

    def cursor(self):
        return _Cur(self.log, self.fail_on)


def test_publish_is_one_transaction_and_rolls_back():
    rows, _ = publish_news.read_rows(_db())
    ok = _Conn()
    publish_news.publish(ok, rows)
    assert ok.log == ["BEGIN", "DELETE", "INSERT x2", "DELETE", "INSERT x2", "COMMIT"]
    bad = _Conn(fail_on="DELETE FROM LIIGA.MODEL.NEWS_ABSENCE_LOG")
    try:
        publish_news.publish(bad, rows)
    except RuntimeError:
        pass
    assert bad.log[-1] == "ROLLBACK" and "COMMIT" not in bad.log
