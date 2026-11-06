"""Kauden kysymykset (6.11.2026, docs/claude/skenaario.md J2/V7).

Kysymyslista on sovelluksessa (LIIGA_ENNUSTE/lib/seasonQuestions.json, muutos vain PR:llä).
Tavallisen kysymyksen käyrä luetaan suoraan sijajakaumahistoriasta, joten tallennettavaa
on vain lukituskysymyksillä ("HPK putoaa, jos häviää joulun yli"): niiden luku lasketaan
skenaariomoottorilla (ankkuroitu julkaistuun ennusteeseen) ja tallennetaan päivittäin
tauluun scenario_history. daily_update.py kutsuu record()-funktiota sekä Macilla että
Pagesissa; Pages tallentaa taulun pages-data-haaraan vain aamuajossa (pages_history.py).

Lukituksen tila jakson otteluista: open (jakso kesken, lasketaan skenaario), held
(kaikki jakson ottelut pelattu ja hävitty: luku = ehdoton ennuste) tai failed (joukkue
sai jaksolla pisteen tai voiton: ehto ei toteutunut, ei lukua).

    python scripts/tools/season_questions.py record        # tämän päivän rivit
    python scripts/tools/season_questions.py backfill      # kerran: git-historian mallitiloista
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "tools"))
import skenaario as sk  # noqa: E402

QUESTIONS = ROOT / "snowflake/LIIGA/CODE/application_services/LIIGA_ENNUSTE/lib/seasonQuestions.json"
DB = ROOT / "data" / "liiga.duckdb"
# Sovelluksen tavoitteet -> moottorin tavoite; putoaminen = 1 - pysyy sarjassa.
ENGINE_GOAL = {"relegation": "avoid_relegation", "top6": "top6", "top10": "top10", "win": "win"}
DDL = """CREATE TABLE IF NOT EXISTS scenario_history (snapshot_date VARCHAR, question_id VARCHAR,
         scenario_sha VARCHAR, state VARCHAR, p DOUBLE)"""
LOST = {"reg_loss", "ot_loss"}


def questions() -> list[dict]:
    return json.loads(QUESTIONS.read_text(encoding="utf-8"))


def _window_results(con, lock: dict) -> tuple[list[str], int]:
    """Jakson pelattujen otteluiden tulokset joukkueen näkökulmasta ja pelaamattomien määrä."""
    rows = con.execute("""
        SELECT ended, CASE WHEN home_team = ? THEN home_points ELSE away_points END,
               CASE WHEN home_team = ? THEN away_points ELSE home_points END
        FROM stg_games WHERE season = 2027 AND (home_team = ? OR away_team = ?)
          AND strftime(CAST(start_ts AS TIMESTAMPTZ) AT TIME ZONE 'Europe/Helsinki', '%Y-%m-%d') BETWEEN ? AND ?""",
                       [lock["team"]] * 4 + [lock["from"], lock["until"]]).fetchall()
    res = ["win" if own > opp else "ot_loss" if own == 1 else "reg_loss" for ended, own, opp in rows if ended]
    return res, sum(1 for r in rows if not r[0])


def lock_state(con, lock: dict) -> str:
    played, left = _window_results(con, lock)
    want = LOST if lock["result"] == "loss" else {"win"}
    if any(r not in want for r in played):
        return "failed"
    return "open" if left else "held"


def value(con, q: dict) -> tuple[str, str | None, float | None]:
    """(tila, skenaarion sha, todennäköisyys kysymyksen suuntaan)."""
    lock = q["lock"]
    state = lock_state(con, lock)
    if state == "failed":
        return state, None, None
    games, banked, published, w, _snap, played = sk.load(con)
    goal = ENGINE_GOAL[q["goal"]]
    items = [{"team": q["team"], "goal": goal}]
    if state == "open":
        items.insert(0, dict(lock))
    res = sk.sim.compute(items, games, banked, published, w, played, None)
    p = res["requirements"][0]["p"]
    return state, res["scenario_sha"], (1 - p if q["goal"] == "relegation" else p)


def rows_for(con) -> list[tuple]:
    snap = str(con.execute("SELECT MAX(snapshot_date) FROM prediction_games").fetchone()[0])[:10]
    out = []
    for q in questions():
        if q.get("lock"):
            state, sha, p = value(con, q)
            out.append((snap, q["id"], sha, state, p))
    return out


def _write(rows: list[tuple], replace_dates: bool = True) -> None:
    con = duckdb.connect(str(DB))
    try:
        con.execute(DDL)
        for r in rows:
            if replace_dates:
                con.execute("DELETE FROM scenario_history WHERE snapshot_date = ? AND question_id = ?", [r[0], r[1]])
            con.execute("INSERT INTO scenario_history VALUES (?, ?, ?, ?, ?)", list(r))
    finally:
        con.close()


def record() -> list[tuple]:
    con = duckdb.connect(str(DB), read_only=True)
    try:
        rows = rows_for(con)
    finally:
        con.close()
    _write(rows)
    for r in rows:
        print(f"kauden kysymys {r[1]} ({r[0]}): {r[3]}" + (f" {r[4]:.1%}" if r[4] is not None else ""))
    return rows


def _commits(since: str) -> list[tuple[str, str]]:
    """Päivän viimeinen mallitila (commit, päivä) jokaiselta päivältä, jolloin kanta muuttui."""
    log = subprocess.run(["git", "-C", str(ROOT), "log", f"--since={since}", "--format=%H %cs", "--", "data/liiga.duckdb"],
                         capture_output=True, text=True, check=True).stdout.split("\n")
    last: dict[str, str] = {}
    for line in reversed([x for x in log if x]):
        sha, day = line.split()
        last[day] = sha
    return [(s, d) for d, s in sorted(last.items())]


def backfill(since: str = "2026-09-01") -> int:
    con = duckdb.connect(str(DB), read_only=True)
    try:
        have = {r[0] for r in con.execute("SELECT DISTINCT snapshot_date FROM scenario_history").fetchall()} \
            if con.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'scenario_history'").fetchone()[0] else set()
    finally:
        con.close()
    rows: list[tuple] = []
    with tempfile.TemporaryDirectory() as tmp:
        for sha, _day in _commits(since):
            path = Path(tmp) / f"{sha}.duckdb"
            path.write_bytes(subprocess.run(["git", "-C", str(ROOT), "show", f"{sha}:data/liiga.duckdb"],
                                            capture_output=True, check=True).stdout)
            old = duckdb.connect(str(path), read_only=True)
            try:
                got = [r for r in rows_for(old) if r[0] not in have]
            except Exception as exc:                        # noqa: BLE001 - vanha kantarakenne
                print(f"{sha[:7]}: ohitettu ({str(exc).splitlines()[0]})")
                got = []
            finally:
                old.close()
                path.unlink()
            for r in got:
                have.add(r[0])
                print(f"{r[0]} {r[1]}: {r[3]}" + (f" {r[4]:.1%}" if r[4] is not None else ""))
            rows += got
    _write(rows, replace_dates=False)
    return len(rows)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "record":
        record()
    elif cmd == "backfill":
        print(f"lisätty {backfill(*sys.argv[2:3])} riviä")
    else:
        sys.exit(__doc__)
