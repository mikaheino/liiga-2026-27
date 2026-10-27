"""Sovelluksen paikallinen datalähde: yksi kysely DuckDB:hen, tulos JSONina.

    echo '{"sql": "SELECT * FROM prediction_meta", "binds": []}' | python scripts/local/duckdb_query.py

Liiga Ennuste -sovellus (Next.js) kutsuu tätä, kun se ajetaan ilman Snowflakea
(käyttäjä 17.10.: "Lokaaliapplikaatio tulisi toimia ilman Snowflake yhteyttä").
Sarakenimet palautetaan ISOILLA kuten Snowflake, jotta sovelluksen koodi on sama.
Kanta avataan vain luettavaksi; jos aamuajo kirjoittaa juuri, yritetään uudelleen.
"""
from __future__ import annotations

import datetime as dt
import decimal
import json
import os
import sys
import time
from pathlib import Path

import duckdb

# LIIGA_DUCKDB vaihtaa kannan (testikäännös kopiolla, 27.10.).
DB = Path(os.environ.get("LIIGA_DUCKDB") or Path(__file__).resolve().parents[2] / "data" / "liiga.duckdb")


def _plain(v):
    if isinstance(v, (dt.date, dt.datetime)):
        return v.isoformat()
    if isinstance(v, decimal.Decimal):
        return float(v)
    return v


def run(sql: str, binds: list) -> list[dict]:
    last = None
    for _ in range(20):                       # aamuajon kirjoituslukko: odota enintään ~10 s
        try:
            con = duckdb.connect(str(DB), read_only=True)
            try:
                cur = con.execute(sql, binds or [])
                cols = [d[0].upper() for d in cur.description]
                return [dict(zip(cols, map(_plain, row))) for row in cur.fetchall()]
            finally:
                con.close()
        except duckdb.IOException as e:          # lukittu: kirjoittaja kesken
            last = e
            time.sleep(0.5)
    raise last


if __name__ == "__main__":
    req = json.load(sys.stdin)
    try:
        json.dump(run(req["sql"], req.get("binds", [])), sys.stdout, ensure_ascii=False)
    except Exception as e:                     # noqa: BLE001 -- virhe sovellukselle selväkielisenä
        json.dump({"error": str(e).splitlines()[0][:400]}, sys.stdout, ensure_ascii=False)
        sys.exit(1)
