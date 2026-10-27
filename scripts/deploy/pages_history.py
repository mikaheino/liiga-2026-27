"""GitHub Pagesin oma ennustehistoria (27.10.).

Pages-ajo (.github/workflows/pages.yml) laskee ennusteen kertakäyttöisessä
runnerissa repon tietokannasta eteenpäin. Ottelutulokset saa aina uudelleen
liiga.fi:stä, mutta päivittäisiä ennusteita ei: eilistä ennustetta ei voi laskea
jälkikäteen. Siksi nämä kaksi taulua säilytetään CSV:nä omassa haarassaan
`pages-data`, eikä Pages riipu Macin commiteista. Ensimmäinen ajo, jossa
CSV:tä ei vielä ole, alkaa repon tietokannan historiasta.

    python scripts/deploy/pages_history.py restore DIR   # DIR/*.csv -> DuckDB
    python scripts/deploy/pages_history.py save DIR      # DuckDB -> DIR/*.csv
"""
from __future__ import annotations

import sys
from pathlib import Path

import duckdb

DB = Path(__file__).resolve().parents[2] / "data" / "liiga.duckdb"
TABLES = ("prediction_history", "prediction_games")


def restore(folder: Path) -> None:
    con = duckdb.connect(str(DB))
    for t in TABLES:
        csv = folder / f"{t}.csv"
        if not csv.exists():
            print(f"{t}: ei CSV:tä, käytetään repon tietokannan historiaa")
            continue
        cols = con.sql(f"DESCRIBE {t}").fetchall()
        select = ", ".join(f'CAST("{c[0]}" AS {c[1]}) AS "{c[0]}"' for c in cols)
        con.execute(f"DELETE FROM {t}")
        con.execute(f"INSERT INTO {t} SELECT {select} FROM read_csv(?, header = true, all_varchar = true)", [str(csv)])
        print(f"{t}: {con.sql(f'SELECT COUNT(*), MAX(snapshot_date) FROM {t}').fetchone()}")
    con.close()


def save(folder: Path) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(DB), read_only=True)
    for t in TABLES:
        cols = ", ".join(f'"{c[0]}"' for c in con.sql(f"DESCRIBE {t}").fetchall())
        con.execute(f"COPY (SELECT * FROM {t} ORDER BY {cols}) TO '{folder / f'{t}.csv'}' (HEADER)")
        print(f"{t}: {con.sql(f'SELECT COUNT(*), MAX(snapshot_date) FROM {t}').fetchone()}")
    con.close()


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("restore", "save"):
        sys.exit(__doc__)
    {"restore": restore, "save": save}[sys.argv[1]](Path(sys.argv[2]))
