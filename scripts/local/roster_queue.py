"""Rosterijono: sovelluksen haussa tunnistetut pelaajat, joita mallin rosterissa ei ole (7.11.2026).

Käyttäjä: "jos uusi pelaaja niin polku jolla pelaaja rosteriin standardin mukaisesti". Sovellus
(lib/rosterQueue.ts) vain kirjaa pelaajan tiedostoon data/roster_requests.csv; lisäys tehdään
dokumentoidulla standardipolulla (docs/claude/roster.md, "Adding new players — required steps").
Tämä skripti näyttää jonon, tarkistaa onko pelaaja jo rosterissa, ja tulostaa vaiheet.

    .venv/bin/python scripts/local/roster_queue.py                  # jono + vaiheet
    .venv/bin/python scripts/local/roster_queue.py --done "Rasmus Kumpulainen"
    .venv/bin/python scripts/local/roster_queue.py --dismiss "Matti Meikäläinen"   # ei oikea pelaaja
"""
from __future__ import annotations

import argparse
import csv
import json
import subprocess
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
QUEUE = ROOT / "data" / "roster_requests.csv"
FIELDS = ["requested_at", "player", "team", "source", "status"]

STEPS = """Standardipolku (docs/claude/roster.md, vaiheet 1-9):
  1. data/transfers_2026_27.txt: pelaaja oikean joukkueen sopimuslistaan (ei +-riviksi), päivitä lukumäärä
  2-3. Liiga-historia ja sen ajantasaisuus (player_rates, player_season_scoring ILIKE, viimeisin kausi)
  4-5. Puuttuvat kaudet ulkoisista lähteistä -> data/external_players.csv (liiga nimellä league_factors.csv:stä)
  6. build_rosters_from_article(); build_player_rates()
  7. python scripts/local/daily_update.py   (kauden aikana, EI refresh_standings.py)
  8. python scripts/local/check_roster_coverage.py
  9. commit + python scripts/local/roster_impact.py, sitten: roster_queue.py --done "<nimi>"
"""


def read() -> list[dict]:
    if not QUEUE.exists():
        return []
    with QUEUE.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write(rows: list[dict]) -> None:
    with QUEUE.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)


# Snowflake-jono (7.11.2026): sovellus kirjoittaa Snowflakessa LIIGA.MODEL.ROSTER_REQUESTS-tauluun.
SF = "LIIGA.MODEL.ROSTER_REQUESTS"


def snowflake(sql: str) -> list[dict]:
    """liiga_ci-yhteydellä; paras yritys (taulua ei ole ennen julkaisua, yhteys voi puuttua)."""
    try:
        r = subprocess.run(["snow", "sql", "-c", "liiga_ci", "--format", "json", "-q", sql],
                           capture_output=True, text=True, timeout=120, check=True)
        out = json.loads(r.stdout or "[]")
        return out if isinstance(out, list) else []
    except (subprocess.SubprocessError, OSError, json.JSONDecodeError):
        return []


def snowflake_pending() -> list[dict]:
    rows = snowflake(f"SELECT TO_VARCHAR(requested_at) AS requested_at, player, team, source FROM {SF} WHERE status = 'pending'")
    return [{"requested_at": r["REQUESTED_AT"], "player": r["PLAYER"], "team": r["TEAM"], "source": r["SOURCE"],
             "status": "pending", "where": "Snowflake"} for r in rows]


def in_roster(con, name: str) -> str | None:
    last = name.split()[-1]
    hit = con.execute("SELECT team FROM roster_2026_27 WHERE last_name ILIKE ? LIMIT 1", [last]).fetchone()
    return hit[0] if hit else None


def set_status(name: str, status: str) -> None:
    rows = read()
    n = sum(1 for r in rows if r["player"] == name and r["status"] == "pending")
    for r in rows:
        if r["player"] == name and r["status"] == "pending":
            r["status"] = status
    write(rows)
    snowflake(f"UPDATE {SF} SET status = '{status}' WHERE player = '{name.replace(chr(39), chr(39) * 2)}' AND status = 'pending'")
    print(f"{name}: {n} odottavaa paikallisesti -> {status} (Snowflake-jono päivitetty, jos yhteys toimi)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--done", help="merkitse lisätyksi standardipolulla")
    ap.add_argument("--dismiss", help="hylkää (ei oikea pelaaja / ei Liigaan)")
    a = ap.parse_args()
    if a.done or a.dismiss:
        set_status(a.done or a.dismiss, "done" if a.done else "dismissed")
        return
    pending = [{**r, "where": "paikallinen"} for r in read() if r["status"] == "pending"] + snowflake_pending()
    if not pending:
        print("Rosterijono on tyhjä.")
        return
    con = duckdb.connect(str(ROOT / "data" / "liiga.duckdb"), read_only=True)
    print(f"Rosterijonossa {len(pending)} pelaajaa:")
    for r in pending:
        now = in_roster(con, r["player"])
        state = f"JO ROSTERISSA ({now}) -> --done" if now else "puuttuu mallista"
        print(f"  {r['requested_at'][:10]}  {r['player']:<24} {r['team'] or '?':<9} {state}  · {r['where']} · haku: {r['source']}")
    print("\n" + STEPS)


if __name__ == "__main__":
    main()
