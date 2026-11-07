"""Uutiskeräimen ydin ja Snowflake-tallennus (7.11.2026): ilman verkkoa."""
from __future__ import annotations

import pandas as pd

from liiga import news_collect as nc
from liiga import news_ingest
from liiga.db import ActiveSession
from liiga.pipeline import _news

RSS = b"""<?xml version="1.0"?><rss><channel>
<item><title>Lukko: Kumpulainen sivussa viikkoja</title><link>https://x.fi/a/1</link>
<pubDate>Sat, 07 Nov 2026 10:00:00 +0200</pubDate><description>&lt;p&gt;Hyokkaaja loukkaantui.&lt;/p&gt;</description>
<category>Lukko (J\xc3\xa4\xc3\xa4kiekon Miesten Liiga)</category></item>
<item><title>Jalkapallo</title><link>https://x.fi/a/2</link><description>muu laji</description></item>
</channel></rss>"""


def test_parse_rss_and_flags():
    items = nc.parse_rss(RSS)
    assert items[0]["published"] == "2026-11-07T08:00:00+00:00"
    assert nc.yle_teams(items[0]["tags"]) == ["Lukko"]
    assert "loukkaantuminen" in nc.flags_of(items[0]["title"])
    assert nc.summary_of("<p>a  b</p>") == "a b"
    assert nc.summary_of("x " * 300).endswith("…")


def test_parse_html_links():
    html = b'<a href="/uutiset/pitka-uutinen-tunniste">Pelaaja palaa kokoonpanoon ensi viikolla</a><a href="/muu">x</a>'
    rows = nc.parse_html(html, "https://seura.fi/uutiset/")
    assert rows == [{"title": "Pelaaja palaa kokoonpanoon ensi viikolla", "url": "https://seura.fi/uutiset/pitka-uutinen-tunniste",
                     "published": "", "text": "", "tags": []}]


def test_collect_filters_and_dedupes(monkeypatch):
    monkeypatch.setattr(nc, "SOURCES", [("Yle", None, "rss", "u")])
    monkeypatch.setattr(nc, "_get", lambda url: RSS)
    rows, status = nc.collect(set(), "now", {})
    assert [r["team"] for r in rows] == ["Lukko"] and status["Yle"] == "2 juttua, 1 uutta"
    rows2, _ = nc.collect({"https://x.fi/a/1"}, "now", {})
    assert rows2 == []


def test_reflag_drops_transfer_on_schedule_news():
    r = [{"title": "Kotiottelu siirtyy uuteen ajankohtaan", "flags": "siirto", "summary": ""}]
    nc.reflag(r)
    assert "siirto" not in r[0]["flags"]


class _Sess:
    def __init__(self):
        self.written = None

    def write_pandas(self, df, name, **kw):
        self.written = (df, name, kw)


def test_ingest_news_appends_only_new(monkeypatch):
    sess = _Sess()
    con = ActiveSession(sess)
    monkeypatch.setattr(news_ingest, "query_df", lambda c, sql: pd.DataFrame({k: ["old"] for k in news_ingest.COLUMNS}))
    monkeypatch.setattr(nc, "collect", lambda seen, now, s: ([{k: "n" for k in news_ingest.COLUMNS}], {"Yle": "ok"}))
    got = news_ingest.ingest_news(con)
    assert got["new"] == 1 and got["total"] == 2
    df, name, kw = sess.written
    assert name == "NEWS_ITEMS" and kw["overwrite"] is False and list(df.columns)[0] == "FETCHED_AT"


def test_news_skipped_outside_snowflake_and_never_raises(monkeypatch):
    assert news_ingest.ingest_news(object()) == {"skipped": "ei Snowflakessa"}
    monkeypatch.setattr(news_ingest, "ingest_news", lambda con: 1 / 0)
    assert "ZeroDivisionError" in _news(object())["error"]
