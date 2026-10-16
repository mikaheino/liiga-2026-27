"""Pelipäivän kokoonpanot ja kokoonpanokorjattu ennuste paikallisesti: sama koodi
ja vastaus kuin Snowflake-agentin työkalulla liiga_kokoonpanot.

    .venv/bin/python scripts/tools/kokoonpanot.py            # tänään
    .venv/bin/python scripts/tools/kokoonpanot.py 2026-10-17

Lähde: snowflake/LIIGA/MODEL/procedures/LINEUP_FORECAST/lineups.py. Hakee vain annetun päivän ottelut
liiga.fi:stä (yksi kutsu per ottelu), ei historiaa.
"""
from __future__ import annotations

import datetime as dt
import importlib.util
import sys
import time
from pathlib import Path
from zoneinfo import ZoneInfo

import duckdb

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "snowflake/LIIGA/MODEL/procedures/LINEUP_FORECAST"))
sys.path.insert(0, str(ROOT / "snowflake/LIIGA/MODEL/procedures/SIMULATE_SCENARIO"))
sys.path.insert(0, str(ROOT / "scripts" / "tools"))
import lineups  # noqa: E402
import skenaario  # noqa: E402


def run(day: str | None = None) -> str:
    from liiga.results import fetch_game_detail
    d = day or dt.datetime.now(ZoneInfo("Europe/Helsinki")).date().isoformat()
    con = duckdb.connect(str(ROOT / "data/liiga.duckdb"), read_only=True)
    try:
        snap = con.execute("SELECT MAX(snapshot_date) FROM prediction_games").fetchone()[0]
        games = [dict(zip(["game_id", "time", "home_team", "away_team", "p_home_reg", "p_overtime"], r))
                 for r in con.execute("""
            SELECT p.game_id, strftime(CAST(s.start_ts AS TIMESTAMPTZ) AT TIME ZONE 'Europe/Helsinki', '%H:%M'),
                   p.home_team, p.away_team, p.p_home_reg, p.p_overtime
            FROM prediction_games p JOIN stg_games s ON s.season = 2027 AND s.game_id = p.game_id
            WHERE p.snapshot_date = ? AND NOT s.ended
              AND CAST(CAST(s.start_ts AS TIMESTAMPTZ) AT TIME ZONE 'Europe/Helsinki' AS DATE) = ?
            ORDER BY 2, 3""", [snap, d]).fetchall()]
        model = skenaario.load_model(con)
        ids = dict(con.execute("SELECT name, player_id FROM player_rates").fetchall())
    finally:
        con.close()
    for p in model["players"]:
        p["player_id"] = ids.get(p["name"])
    rows = []
    for g in games:
        try:
            lu = lineups.parse_detail(fetch_game_detail(2027, g["game_id"]))
        except Exception:                                   # noqa: BLE001
            lu = {}
        rows.append(lineups.adjust(g, lu, model))
        time.sleep(0.5)
    y, m, dd = d.split("-")
    return lineups.render(rows, f"{int(dd)}.{int(m)}.{y}")


if __name__ == "__main__":
    print(run(sys.argv[1] if len(sys.argv) > 1 else None))
