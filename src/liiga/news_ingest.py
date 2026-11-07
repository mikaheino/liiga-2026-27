"""Uutiset Snowflakeen samassa ajossa kuin liiga.fi:n data (7.11.2026).

Käyttäjän päätös 7.11.2026: uutisotsikot ja ingressit saavat olla Snowflakessa ja agentti saa
nähdä ne ("saa nähdä ja päivittyä samalla kun haetaan uudet data liiga pistää"). Aiempi linja
(vain rakenteiset signaalit, ei otsikoita) päättyi tähän.

`refresh_results()` kutsuu tätä, mutta vain Snowflaken sisällä (LIIGA_DAILY-notebook):
Mac ja GitHub saavat uutiset news-data-haarasta kuten ennenkin. Uutisten haku ei koskaan kaada
päivän ajoa: virhe palautetaan tilana ja ennuste jatkuu.

Vaatii notebookille ulkoisen pääsyn LIIGA_NEWS_ACCESS (snowflake/_account/integrations/).
Taulu LIIGA.<raw>.NEWS_ITEMS: yksi rivi per juttu (url yksilöllinen), uudet lisätään.
"""
from __future__ import annotations

import datetime as dt

import pandas as pd

from .db import ActiveSession, query_df

COLUMNS = ["fetched_at", "published", "source", "team", "flags", "title", "url", "summary"]


def ingest_news(con) -> dict:
    if not isinstance(con, ActiveSession):
        return {"skipped": "ei Snowflakessa"}
    from .news_collect import collect
    from .snowflake_sync import _cfg

    cfg = _cfg()
    table = f'{cfg["database"]}.{cfg["raw_schema"]}.NEWS_ITEMS'
    try:
        old = query_df(con, f"SELECT {', '.join(COLUMNS)} FROM {table}")
    except Exception:               # noqa: BLE001 -- ensimmäinen ajo, taulua ei vielä ole
        old = pd.DataFrame(columns=COLUMNS)
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    rows, status = collect(set(old["url"]), now, {})
    if rows:
        new = pd.DataFrame(rows, columns=COLUMNS)
        new.columns = [c.upper() for c in new.columns]
        con.session.write_pandas(new, "NEWS_ITEMS", auto_create_table=True, overwrite=False,
                                 database=cfg["database"], schema=cfg["raw_schema"])
    return {"new": len(rows), "total": len(old) + len(rows), "status": status}
