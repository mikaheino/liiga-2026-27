"""Uutistaulut Snowflakeen GitHubista (22.11.2026, ennen Macin aamusynkka; 23.11.2026 katselmointi M3/m1/m6).

recompute.yml ajaa tämän load_news.py:n ja news_signals.py:n jälkeen: news_signals ja news_absence_log
uutiskannasta (LIIGA_NEWS_DUCKDB) tauluihin LIIGA.MODEL.NEWS_SIGNALS ja NEWS_ABSENCE_LOG.
  - Yksi transaktio (DELETE + INSERT sidotuin arvoin), ei CREATE OR REPLACE: taulut pysyvät LIIGA_ADMINin
    omistamina, oikeudet ja NOT NULL -rajoitteet ennallaan.
  - Rooli LIIGA_NEWS_PUBLISHER (vain SELECT, INSERT, DELETE näihin kahteen tauluun), samalla CI-käyttäjällä.
  - Avainsarakkeet (KEYS) eivät saa olla tyhjiä: tyhjäavaimiset rivit jätetään pois ja niiden määrä kerrotaan.
  - Suojaus: ajo kaatuu (exit 1) eikä kirjoita mitään, jos jokin taulu tyhjenisi tai putoaisi alle puoleen
    nykyisestä (esim. news-data-haara rikki). Tarkoituksellinen pudotus: NEWS_PUBLISH_FORCE=1.

    LIIGA_NEWS_DUCKDB=... python scripts/news/publish_news.py [--dry-run]
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parent))
import newsdb  # noqa: E402

TABLES = {
    "news_signals": ["published", "source", "team", "kind", "player"],
    "news_absence_log": ["approved_at", "url_hash", "player", "team", "kind", "start", "until"],
}
# Ei tyhjä (KEYS) ja ei NULL (NOT_NULL). Poissaolon "dismiss"-rivillä pelaaja ja joukkue ovat tyhjiä
# merkkijonoja (peruu uutisen url_hashilla), joten niille riittää NOT NULL.
KEYS = {"news_signals": ["team", "kind", "player"], "news_absence_log": ["url_hash", "kind"]}
NOT_NULL = {"news_signals": [], "news_absence_log": ["player", "team"]}
ROLE = "LIIGA_NEWS_PUBLISHER"
MIN_RATIO = 0.5


def read_rows(con) -> tuple[dict[str, list[tuple]], dict[str, int]]:
    """Rivit uutiskannasta; tyhjäavaimiset pois (palauttaa myös poistettujen määrät)."""
    rows, dropped = {}, {}
    for t, cols in TABLES.items():
        allrows = con.execute(f"SELECT {', '.join(cols)} FROM {t}").fetchall()
        idx = [cols.index(k) for k in KEYS[t]]
        nn = [cols.index(k) for k in NOT_NULL[t]]
        rows[t] = [r for r in allrows if all(r[i] not in (None, "") for i in idx) and all(r[i] is not None for i in nn)]
        dropped[t] = len(allrows) - len(rows[t])
    return rows, dropped


def guard(new: dict[str, int], current: dict[str, int], force: bool = False) -> list[str]:
    """Syyt olla kirjoittamatta (tyhjä lista = saa kirjoittaa)."""
    if force:
        return []
    out = []
    for t, n in new.items():
        if n == 0:
            out.append(f"{t}: 0 riviä")
        elif current.get(t, 0) and n < MIN_RATIO * current[t]:
            out.append(f"{t}: {n} riviä, nyt {current[t]} (pudotus yli {int((1 - MIN_RATIO) * 100)} %)")
    return out


def publish(sf, rows: dict[str, list[tuple]]) -> None:
    cur = sf.cursor()
    cur.execute("BEGIN")
    try:
        for t, cols in TABLES.items():
            fq = f"LIIGA.MODEL.{t.upper()}"
            cur.execute(f"DELETE FROM {fq}")
            if rows[t]:
                qcols = ", ".join(f'"{c.upper()}"' for c in cols)
                cur.executemany(f"INSERT INTO {fq} ({qcols}) VALUES ({', '.join(['%s'] * len(cols))})", rows[t])
        cur.execute("COMMIT")
    except Exception:
        cur.execute("ROLLBACK")
        raise


def main() -> int:
    con = duckdb.connect(str(newsdb.target()), read_only=True)
    try:
        rows, dropped = read_rows(con)
    finally:
        con.close()
    new = {t: len(r) for t, r in rows.items()}
    print("uutiskanta:", ", ".join(f"{t} {n} riviä" + (f" ({dropped[t]} tyhjäavaimista pois)" if dropped[t] else "")
                                    for t, n in new.items()))
    import snowflake.connector
    sf = snowflake.connector.connect(connection_name=os.environ.get("LIIGA_SNOW_CONNECTION", "ci"), role=ROLE,
                                     warehouse=os.environ.get("LIIGA_SNOW_WAREHOUSE", "LIIGA_WH"))
    try:
        current = {t: sf.cursor().execute(f"SELECT COUNT(*) FROM LIIGA.MODEL.{t.upper()}").fetchone()[0] for t in TABLES}
        why = guard(new, current, os.environ.get("NEWS_PUBLISH_FORCE") == "1")
        if why:
            print("EI JULKAISTU:", "; ".join(why), file=sys.stderr)
            return 1
        if "--dry-run" in sys.argv:
            print("kuiva-ajo: nyt", current)
            return 0
        publish(sf, rows)
    finally:
        sf.close()
    print("uutistaulut Snowflakeen:", ", ".join(f"{t} {current[t]} -> {n}" for t, n in new.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
