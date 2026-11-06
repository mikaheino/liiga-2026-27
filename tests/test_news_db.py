"""Uutiskanta erillään mallikannasta (6.11.2026, scripts/news/newsdb.py).

Repo on julkinen: uutis- ja haastajataulut eivät saa päätyä commitoituun
data/liiga.duckdb:hen. Kirjoittaja tarvitsee LIIGA_NEWS_DUCKDB-polun, ja sovelluksen
DuckDB-silta liittää uutiskannan lukutilassa."""
import importlib.util
import sys
from pathlib import Path

import duckdb
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "news"))
import newsdb  # noqa: E402


def _load(name: str, rel: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.mark.skipif(not newsdb.MODEL_DB.exists(), reason="ei paikallista kantaa")
def test_model_db_has_no_news_tables():
    con = duckdb.connect(str(newsdb.MODEL_DB), read_only=True)
    try:
        bad = [r[0] for r in con.execute("""SELECT table_name FROM information_schema.tables
            WHERE table_name LIKE 'news%' OR table_name LIKE 'challenger%' OR table_name = 'prediction_games_news'""").fetchall()]
    finally:
        con.close()
    assert bad == [], f"uutistauluja mallikannassa: {bad}"


def test_target_requires_env_and_refuses_model_db(monkeypatch, tmp_path):
    monkeypatch.delenv("LIIGA_NEWS_DUCKDB", raising=False)
    with pytest.raises(SystemExit):
        newsdb.target()
    monkeypatch.setenv("LIIGA_NEWS_DUCKDB", str(newsdb.MODEL_DB))
    with pytest.raises(SystemExit):
        newsdb.target()
    monkeypatch.setenv("LIIGA_NEWS_DUCKDB", str(tmp_path / "n.duckdb"))
    assert newsdb.target() == tmp_path / "n.duckdb"


def test_bridge_attaches_news_read_only(tmp_path, monkeypatch):
    model, news = tmp_path / "liiga.duckdb", tmp_path / "news.duckdb"
    for path, sql in ((model, "CREATE TABLE prediction_meta AS SELECT 1 AS x"),
                      (news, "CREATE TABLE news_items AS SELECT 'otsikko' AS title")):
        c = duckdb.connect(str(path))
        c.execute(sql)
        c.close()
    q = _load("duckdb_query", "scripts/local/duckdb_query.py")
    monkeypatch.setattr(q, "DB", model)
    monkeypatch.setattr(q, "NEWS", news)
    assert q.run("SELECT x FROM prediction_meta", []) == [{"X": 1}]
    assert q.run("SELECT title FROM news_items", []) == [{"TITLE": "otsikko"}]
    with pytest.raises(duckdb.Error):
        q.run("CREATE TABLE news.main.x AS SELECT 1", [])
