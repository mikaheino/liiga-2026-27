"""Uutistaulut Snowflakeen GitHubista (22.11.2026, ennen Macin aamusynkka).

recompute.yml ajaa tämän load_news.py:n ja news_signals.py:n jälkeen: news_signals ja news_absence_log
uutiskannasta (LIIGA_NEWS_DUCKDB) tauluihin LIIGA.MODEL.NEWS_SIGNALS ja NEWS_ABSENCE_LOG.
Yksi transaktio (DELETE + INSERT), ei CREATE OR REPLACE: taulut pysyvät LIIGA_ADMINin omistamina ja
oikeudet (sovellus, agentti) ennallaan; julkaisuroolilla LIIGA_DEPLOYER on vain INSERT ja DELETE.
Arvot ovat uutisista johdettua tekstiä, joten ne lainataan (\\ ja ') eikä niitä tulkita.

    LIIGA_NEWS_DUCKDB=... python scripts/news/publish_news.py --sql out.sql   # kirjoittaa SQL:n
    snow sql -c ci -f out.sql
"""
from __future__ import annotations

import sys
from pathlib import Path

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parent))
import newsdb  # noqa: E402

TABLES = {
    "news_signals": ["published", "source", "team", "kind", "player"],
    "news_absence_log": ["approved_at", "url_hash", "player", "team", "kind", "start", "until"],
}


def lit(v: object) -> str:
    if v is None:
        return "NULL"
    return "'" + str(v).replace("\\", "\\\\").replace("'", "''") + "'"


def build_sql(con) -> tuple[str, dict[str, int]]:
    out = ["BEGIN;"]
    counts: dict[str, int] = {}
    for t, cols in TABLES.items():
        rows = con.execute(f"SELECT {', '.join(cols)} FROM {t}").fetchall()
        counts[t] = len(rows)
        fq = f"LIIGA.MODEL.{t.upper()}"
        out.append(f"DELETE FROM {fq};")
        qcols = ", ".join(f'"{c.upper()}"' for c in cols)
        for i in range(0, len(rows), 500):
            vals = ",\n".join("(" + ", ".join(lit(v) for v in r) + ")" for r in rows[i:i + 500])
            out.append(f"INSERT INTO {fq} ({qcols}) VALUES\n{vals};")
    out.append("COMMIT;")
    return "\n".join(out) + "\n", counts


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[1] != "--sql":
        print(__doc__)
        return 2
    con = duckdb.connect(str(newsdb.target()), read_only=True)
    try:
        sql, counts = build_sql(con)
    finally:
        con.close()
    Path(sys.argv[2]).write_text(sql, encoding="utf-8")
    print("uutistaulut Snowflakeen:", ", ".join(f"{t} {n} riviä" for t, n in counts.items()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
