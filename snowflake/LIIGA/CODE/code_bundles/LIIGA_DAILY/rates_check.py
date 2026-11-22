"""Pelaajamallin vertailuajo ilman kirjoituksia (22.11.2026, Macin aamusynkan korvaus).

Laskee Snowflakessa saman kuin rosterityö (build_rosters_from_article + build_player_rates +
compute_liiga_rates) ja lukee CSV-taulut paketista, mutta EI kirjoita mallin tauluihin: register_df
kaapataan. Tulos kirjataan tarkistustauluun LIIGA.CODE.PIPELINE_CHECKS (bundlen tuloste ei näy SQL:ssä).
Tulosteessa jokaiselle taululle rivimäärä ja tiiviste (sha256, 12 merkkiä): sama tiiviste kuin Macin
laskennassa samoista git-tiedostoista = sama tulos. Lisäksi ero nykyiseen tauluun (tiedoksi: osa tauluista
on vanhempia kuin git-tiedostot, koska Mac ei enää laskenut niitä uudelleen).

    EXECUTE CODE BUNDLE LIIGA.CODE.LIIGA_DAILY_BUNDLE ENTRYPOINT = 'rates_check.py'
"""
from __future__ import annotations

import importlib.util
import os
import sys

for base in (os.getcwd(), *(os.path.join(os.getcwd(), d) for d in sorted(os.listdir(os.getcwd())))):
    if os.path.isfile(os.path.join(base, "daily.py")):
        sys.path.insert(0, base)
        break
spec = importlib.util.spec_from_file_location("daily", os.path.join(sys.path[0], "daily.py"))
daily = importlib.util.module_from_spec(spec)
spec.loader.exec_module(daily)          # kopio /tmp:hen ja sys.path, ei ajoa

import hashlib  # noqa: E402

import pandas as pd  # noqa: E402

daily.configure(daily.session())

from liiga import coaching, curated, db, goalies, players, transfers  # noqa: E402

captured: dict[str, pd.DataFrame] = {}


def _capture(con, name, df):
    captured[name] = df.copy()


for mod in (db, curated, coaching, goalies, players, transfers):
    mod.register_df = _capture
_query = players.query_df


def _query_captured(con, sql, *a, **k):
    # build_player_rates lukee rosterin taulusta: kaapattu uusi roster sen tilalle, kuten oikeassa ajossa.
    if sql.strip() == "SELECT * FROM roster_2026_27" and "roster_2026_27" in captured:
        df = captured["roster_2026_27"].copy()
        df.columns = [c.lower() for c in df.columns]
        return df
    return _query(con, sql, *a, **k)


players.query_df = _query_captured

con = db.get_connection()
for table in [*curated.CSV_TABLES, *curated.LOADER_FILES]:
    curated._load(con, table)
transfers.build_rosters_from_article()
players.compute_liiga_rates(con)
players.build_player_rates()


def _norm(df: pd.DataFrame) -> list[tuple]:
    df = df.copy()
    df.columns = [c.lower() for c in df.columns]
    df = df[sorted(df.columns)]
    rows = []
    for r in df.itertuples(index=False):
        vals = []
        for v in r:
            if v is None or (isinstance(v, float) and pd.isna(v)):
                vals.append("")
            elif isinstance(v, (bool,)):
                vals.append(str(v))
            elif isinstance(v, (int, float)) or hasattr(v, "item"):
                try:
                    vals.append(f"{float(v):.9g}")
                except (TypeError, ValueError):
                    vals.append(str(v))
            else:
                vals.append(str(v))
        rows.append(tuple(vals))
    return sorted(rows)


bad = []
results = []
for name, new in captured.items():
    cur = db.query_df(con, f"SELECT * FROM {curated._fq(con, name)}")
    a, b = _norm(new), _norm(cur)
    cols_new, cols_cur = sorted(c.lower() for c in new.columns), sorted(cur.columns)
    if cols_new != cols_cur:
        print(f"{name:28} SARAKKEET EROAVAT uusi={cols_new} nyk={cols_cur}")
        bad.append(name)
        continue
    only_new, only_cur = sorted(set(a) - set(b)), sorted(set(b) - set(a))
    digest = hashlib.sha256(repr(a).encode()).hexdigest()[:12]
    status = "SAMA" if a == b else f"ERO +{len(only_new)} -{len(only_cur)}"
    print(f"{name:28} uusi {len(a):5} {digest}  nyk {len(b):5}  {status}")
    results.append((name, len(a), digest, len(b), status, repr((only_new[:3], only_cur[:3]))[:2000]))
    for r in only_new[:3]:
        print("    vain uusi:", r)
    for r in only_cur[:3]:
        print("    vain nyk: ", r)
    if a != b:
        bad.append(name)
print("VERTAILU VALMIS:", "kaikki samat kuin nykyiset taulut" if not bad else f"eroja nykyisiin: {bad}")

s = daily.session()
s.sql("""CREATE TABLE IF NOT EXISTS LIIGA.CODE.PIPELINE_CHECKS (checked_at TIMESTAMP_LTZ, check_name VARCHAR,
    table_name VARCHAR, rows_new NUMBER, digest VARCHAR, rows_current NUMBER, status VARCHAR, detail VARCHAR)""").collect()
out = pd.DataFrame(results, columns=["TABLE_NAME", "ROWS_NEW", "DIGEST", "ROWS_CURRENT", "STATUS", "DETAIL"])
out.insert(0, "CHECK_NAME", "rates_check")
out.insert(0, "CHECKED_AT", pd.Timestamp.now(tz="UTC"))
s.write_pandas(out, "PIPELINE_CHECKS", database="LIIGA", schema="CODE", use_logical_type=True)
