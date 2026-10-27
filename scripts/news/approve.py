"""Sovelluksen OK-napin kirjaus: poissaolo tai paluu news-data-haaran
absences.csv:hen (27.10.2026; docs/uutismalli_suunnitelma.md, vaihe 3).

Ajaa .github/workflows/absence.yml, jonka sovellus käynnistää (workflow_dispatch,
token vain käyttäjän puhelimen selaimessa). Syöte tulee ympäristömuuttujista ja
käsitellään pelkkänä datana: uutisen on löydyttävä news_items.csv:stä, pelaajan
rosterista samasta joukkueesta ja keston sallituista arvoista. Muuten ei kirjata.

    NEWS_URL=... PLAYER=... TEAM=... KIND=out|back DURATION=1ott|1vko|3vko|kausi \\
        python scripts/news/approve.py NEWSDIR
"""
from __future__ import annotations

import csv
import datetime as dt
import os
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

import duckdb

ROOT = Path(__file__).resolve().parents[2]
FIELDS = ["approved_at", "url", "player", "team", "kind", "start", "until"]
SEASON_END = "2027-03-31"            # runkosarjan viimeinen kierros (544 ottelua)
DAYS = {"1vko": 7, "3vko": 21}


def _roster() -> set[tuple[str, str]]:
    con = duckdb.connect(str(ROOT / "data" / "liiga.duckdb"), read_only=True)
    try:
        return {(n, t) for n, t in con.execute(
            "SELECT name, team FROM player_rates UNION SELECT name, team FROM team_goalie_weights").fetchall()}
    finally:
        con.close()


def _next_game_after(team: str, today: str) -> str:
    """Päivä, jona joukkueen seuraava ottelu on pelattu (yhden ottelun poissaolo)."""
    con = duckdb.connect(str(ROOT / "data" / "liiga.duckdb"), read_only=True)
    try:
        row = con.execute("""
            SELECT MIN(SUBSTR(start_ts, 1, 10)) FROM stg_games
            WHERE season = (SELECT MAX(season) FROM stg_games)
              AND (home_team = ? OR away_team = ?) AND SUBSTR(start_ts, 1, 10) >= ?""", [team, team, today]).fetchone()
    finally:
        con.close()
    day = row[0] if row and row[0] else today
    return (dt.date.fromisoformat(day) + dt.timedelta(days=1)).isoformat()


def until_for(duration: str, team: str, today: str) -> str:
    if duration == "1ott":
        return _next_game_after(team, today)
    if duration in DAYS:
        return (dt.date.fromisoformat(today) + dt.timedelta(days=DAYS[duration])).isoformat()
    if duration == "kausi":
        return SEASON_END
    raise ValueError(f"tuntematon kesto: {duration!r}")


def validate(url: str, player: str, team: str, kind: str, duration: str, urls: set[str]) -> list[str]:
    errors = []
    if url not in urls:
        errors.append("uutista ei löydy news_items.csv:stä")
    if (player, team) not in _roster():
        errors.append("pelaajaa ei löydy joukkueen rosterista")
    if kind not in ("out", "back"):
        errors.append("KIND on out tai back")
    if kind == "out" and duration not in ("1ott", "1vko", "3vko", "kausi"):
        errors.append("DURATION on 1ott, 1vko, 3vko tai kausi")
    return errors


def record(path: Path, url: str, player: str, team: str, kind: str, duration: str, today: str) -> dict:
    rows = list(csv.DictReader(path.open(encoding="utf-8"))) if path.exists() else []
    if kind == "back":
        # Paluu päättää pelaajan avoimet poissaolot tähän päivään.
        for r in rows:
            if r["player"] == player and r["kind"] == "out" and r["until"] > today:
                r["until"] = today
    new = {"approved_at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"), "url": url, "player": player,
           "team": team, "kind": kind, "start": today,
           "until": until_for(duration, team, today) if kind == "out" else today}
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows + [new])
    return new


def main(folder: Path) -> int:
    env = {k: os.environ.get(k, "") for k in ("NEWS_URL", "PLAYER", "TEAM", "KIND", "DURATION")}
    news = folder / "news_items.csv"
    urls = {r["url"] for r in csv.DictReader(news.open(encoding="utf-8"))} if news.exists() else set()
    errors = validate(env["NEWS_URL"], env["PLAYER"], env["TEAM"], env["KIND"], env["DURATION"], urls)
    if errors:
        print("EI KIRJATTU: " + "; ".join(errors))
        return 1
    today = dt.datetime.now(ZoneInfo("Europe/Helsinki")).date().isoformat()
    r = record(folder / "absences.csv", env["NEWS_URL"], env["PLAYER"], env["TEAM"], env["KIND"], env["DURATION"], today)
    print(f"kirjattu: {r['player']} ({r['team']}) " + (f"poissa {r['start']} – {r['until']}" if r["kind"] == "out" else f"palaa {today}"))
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(Path(sys.argv[1])))
