"""Uutisista rakenteiset signaalit sovellukselle ja Snowflakeen (7.11.2026).

Käyttäjä: "KAIKKI PITÄÄ TOIMIA SNOWFLAKE". Sovelluksen haku käyttää uutisia kolmella tavalla
(hakuehdotukset, hyväksytyt poissaolot lähtötilanteena, vihjeet). Ennen tätä se luki raakatauluja
(news_items: otsikot ja tiivistelmät), joita Snowflakessa ei ole eikä tule (J3-periaate: ei otsikoita
eikä tekstiä Snowflakeen). Tämä vaihe johtaa niistä kaksi taulua, joissa on vain rakenteisia kenttiä:

  news_signals      published, source, team, kind, player
                    kind = injury | suspension | return | signing. Pelaaja news_candidates-taulusta
                    tai otsikosta/tiivistelmästä rosteria vasten (siirroissa vain otsikosta); siirroksi
                    kelpaa vain sopimukseen viittaava otsikko, jatkosopimukset eivät.
  news_absence_log  approved_at, url_hash, player, team, kind, start, until
                    hyväksyntäloki (uutissivun OK); URL vain tiivisteenä (slug paljastaisi otsikon),
                    jotta dismiss-kirjaus voi edelleen perua saman uutisen kirjaukset.

Otsikkoa käytetään vain johtamiseen; sitä ei tallenneta. Taulut kirjoitetaan uutiskantaan
(scripts/news/newsdb.py, LIIGA_NEWS_DUCKDB), ja liiga.snowflake_sync julkaisee ne LIIGA.MODELiin.

    LIIGA_NEWS_DUCKDB=data/news.duckdb .venv/bin/python scripts/news/news_signals.py
"""
from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parent))
import newsdb  # noqa: E402

SIGNING = re.compile(r"sopimu|lainalle|lainaan|vahvista|siirty|kaudeksi|kauden loppuun|liittyy|tekee paluun|debyy|riveihin"
                     r"|^(hyökkääjä|puolustaja|maalivahti) ", re.I)
EXTENSION = re.compile(r"jatkosopimu|jatkaa", re.I)


def kind_of(flags: str, title: str) -> str | None:
    if "pelikielto" in flags:
        return "suspension"
    if "loukkaantuminen" in flags:
        return "injury"
    if "paluu" in flags:
        return "return"
    if "siirto" in flags and SIGNING.search(title) and not EXTENSION.search(title):
        return "signing"
    return None


def canon(raw: str, teams: list[str]) -> str | None:
    parts = [x.strip() for x in (raw or "").split(",")]
    return next((t for t in teams if any(p == t or p.endswith(f" {t}") for p in parts)), None)


def build(con) -> tuple[list[tuple], list[tuple]]:
    teams = [r[0] for r in con.execute("SELECT DISTINCT team FROM model.roster_2026_27").fetchall()]
    roster = [(r[0], r[1]) for r in con.execute("SELECT player, team FROM news_roster WHERE player LIKE '% %'").fetchall()]
    cands: dict[str, list[tuple[str, str]]] = {}
    for url, player, team in con.execute("SELECT url, player, team FROM news_candidates").fetchall():
        cands.setdefault(url, []).append((player, team))
    signals, seen = [], set()
    for d, source, team, flags, title, summary, url in con.execute(
            "SELECT SUBSTR(CAST(published AS VARCHAR), 1, 10), source, team, flags, title, summary, url "
            "FROM news_items WHERE flags IS NOT NULL ORDER BY published DESC").fetchall():
        kind = kind_of(flags, title or "")
        if not kind:
            continue
        news_team = canon(team, teams)
        text = title if kind == "signing" else f"{title or ''} {summary or ''}"
        found = cands.get(url, []) + [(p, t) for p, t in roster if p in (text or "") and (not news_team or t == news_team)]
        for player, pteam in found:
            t = canon(pteam, teams) or news_team
            if t and (player, kind) not in seen:
                seen.add((player, kind))
                signals.append((d, source, t, kind, player))
    log = [(a, hashlib.sha1((u or "").encode()).hexdigest()[:12] if u else "", p, t, k, s, e)
           for a, u, p, t, k, s, e in con.execute(
               "SELECT approved_at, url, player, team, kind, start, until FROM news_absences ORDER BY approved_at").fetchall()]
    return signals, log


def main() -> int:
    target = newsdb.target()
    con = duckdb.connect(str(target))
    try:
        con.execute(f"ATTACH '{newsdb.MODEL_DB}' AS model (READ_ONLY)")
        signals, log = build(con)
        con.execute("CREATE OR REPLACE TABLE news_signals (published VARCHAR, source VARCHAR, team VARCHAR, kind VARCHAR, player VARCHAR)")
        con.executemany("INSERT INTO news_signals VALUES (?, ?, ?, ?, ?)", signals)
        con.execute("CREATE OR REPLACE TABLE news_absence_log (approved_at VARCHAR, url_hash VARCHAR, player VARCHAR, team VARCHAR, "
                    "kind VARCHAR, start VARCHAR, until VARCHAR)")
        con.executemany("INSERT INTO news_absence_log VALUES (?, ?, ?, ?, ?, ?, ?)", log)
    finally:
        con.close()
    print(f"news_signals: {len(signals)} riviä, news_absence_log: {len(log)} riviä")
    return 0


if __name__ == "__main__":
    sys.exit(main())
