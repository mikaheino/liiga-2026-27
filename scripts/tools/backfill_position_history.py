"""Sijaintijakauman historia git-versioista (6.11.2026).

Etusivun heatmapia voi kelata kauden taaksepäin (sovelluksen Season-palkki), mutta
jakaumasta oli tallessa vain uusin päivä. pipeline.persist() tallentaa sen nyt
päivittäin tauluun position_distribution_history; tämä täydentää menneet päivät
niistä data/liiga.duckdb-versioista, jotka on commitoitu gittiin.

Jokaisesta versiosta luetaan position_distribution_2026_27 ja prediction_meta
(updated_at -> ennustepäivä, games_played). Samalta päivältä otetaan viimeisin
ajo. Päiviä, jotka putki on jo tallentanut, ei kosketa -- putken rivi on aito
saman päivän ennuste, git-versio vain sen hetken kopio.

    .venv/bin/python scripts/tools/backfill_position_history.py [--dry-run]
"""
from __future__ import annotations

import argparse
import subprocess
import tempfile
from pathlib import Path

import duckdb
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "data" / "liiga.duckdb"
TABLE = "position_distribution_history"
RANKS = [f"rank_{k}" for k in range(1, 18)]
COLUMNS = ["snapshot_date", "games_played", "team", *RANKS]


def versions() -> list[str]:
    out = subprocess.run(["git", "log", "--format=%H", "--", "data/liiga.duckdb"],
                         cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return [s for s in out.split() if s]


def read_snapshot(path: Path) -> tuple[str, pd.DataFrame] | None:
    """Yhden kantaversion jakauma ja sen ennustepäivä; None jos tauluja ei ole."""
    try:
        con = duckdb.connect(str(path), read_only=True)
        try:
            meta = con.execute("SELECT updated_at, games_played FROM prediction_meta").fetchone()
            pos = con.execute("SELECT * FROM position_distribution_2026_27").df()
        finally:
            con.close()
    except duckdb.Error:
        return None                       # vanha versio ilman tauluja
    if not meta or pos.empty or not set(RANKS) <= set(pos.columns):
        return None
    updated_at, played = str(meta[0]), int(meta[1])
    pos = pos[["team", *RANKS]].copy()
    pos.insert(0, "snapshot_date", updated_at[:10])
    pos.insert(1, "games_played", played)
    return updated_at, pos


def snapshot(sha: str, tmp: Path) -> tuple[str, pd.DataFrame] | None:
    path = tmp / f"{sha}.duckdb"
    try:
        with path.open("wb") as fh:
            subprocess.run(["git", "show", f"{sha}:data/liiga.duckdb"], cwd=ROOT, stdout=fh, check=True)
        return read_snapshot(path)
    finally:
        path.unlink(missing_ok=True)


def latest_per_day(snaps: list[tuple[str, pd.DataFrame]]) -> dict[str, tuple[str, pd.DataFrame]]:
    """Samalta ennustepäivältä viimeisin ajo (updated_at)."""
    best: dict[str, tuple[str, pd.DataFrame]] = {}
    for updated_at, pos in snaps:
        day = updated_at[:10]
        if day not in best or updated_at > best[day][0]:
            best[day] = (updated_at, pos)
    return best


def write(con, best: dict[str, tuple[str, pd.DataFrame]], dry: bool = False) -> list[str]:
    """Lisää päivät, joita taulussa ei vielä ole; putken omiin päiviin ei kosketa."""
    try:
        have = set(con.execute(f"SELECT DISTINCT snapshot_date FROM {TABLE}").df()["snapshot_date"].astype(str))
    except duckdb.Error:
        have = set()
    new = {d: v for d, v in sorted(best.items()) if d not in have}
    if dry or not new:
        return list(new)
    add = pd.concat([v for _, v in new.values()], ignore_index=True)[COLUMNS]
    con.register("add_df", add)
    if have:
        con.execute(f"INSERT INTO {TABLE} SELECT * FROM add_df")
    else:
        con.execute(f"CREATE TABLE {TABLE} AS SELECT * FROM add_df")
    con.unregister("add_df")
    return list(new)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    dry = ap.parse_args().dry_run

    with tempfile.TemporaryDirectory() as td:
        best = latest_per_day([got for sha in versions() if (got := snapshot(sha, Path(td))) is not None])
    con = duckdb.connect(str(DB), read_only=dry)
    try:
        added = write(con, best, dry)
    finally:
        con.close()
    for d in added:
        u, pos = best[d]
        print(f"{d}  {int(pos['games_played'].iloc[0]):>3} ottelua  (ajo {u})")
    print(f"git-versioista {len(best)} päivää, lisätään {len(added)}{' (kuivaharjoitus)' if dry else ''}")


if __name__ == "__main__":
    main()
