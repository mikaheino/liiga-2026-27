"""Sovelluksen OK-napin kirjaus: poissaolo tai paluu news-data-haaran
absences/-hakemistoon (27.10.2026; docs/uutismalli_suunnitelma.md, vaihe 3).

Ajaa .github/workflows/absence.yml, jonka sovellus käynnistää (workflow_dispatch,
token vain käyttäjän puhelimen selaimessa). Syöte tulee ympäristömuuttujista ja
käsitellään pelkkänä datana: uutisen on löydyttävä news_items.csv:stä, pelaajan
rosterista samasta joukkueesta ja keston sallituista arvoista. Muuten ei kirjata.

    NEWS_URL=...|"" PLAYER=... TEAM=... KIND=out|back DURATION=6ott|3vko|2kk|kausi \\
        python scripts/news/approve.py NEWSDIR
"""
from __future__ import annotations

import csv
import datetime as dt
import os
import re
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parent))
import absences  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SEASON_END = "2027-03-31"            # runkosarjan viimeinen kierros (544 ottelua)
# Kesto otteluina, viikkoina tai kuukausina (käyttäjä 27.10.: "Wernblom poissa
# kuusi ottelua" -> juuri ne ottelut lasketaan uudelleen; uutinen kertoo usein
# viikkoja tai kuukausia) tai loppukausi. Yläraja estää vahingot ("60kk").
DURATION_RE = re.compile(r"^(\d{1,2})(ott|vko|kk)$")
LIMITS = {"ott": 60, "vko": 30, "kk": 7}


def _roster() -> set[tuple[str, str]]:
    con = duckdb.connect(str(ROOT / "data" / "liiga.duckdb"), read_only=True)
    try:
        return {(n, t) for n, t in con.execute(
            "SELECT name, team FROM player_rates UNION SELECT name, team FROM team_goalie_weights").fetchall()}
    finally:
        con.close()


def _team_dates(team: str, today: str) -> list[str]:
    """Joukkueen pelaamattomien otteluiden päivät tästä päivästä alkaen."""
    con = duckdb.connect(str(ROOT / "data" / "liiga.duckdb"), read_only=True)
    try:
        return [r[0] for r in con.execute("""
            SELECT SUBSTR(start_ts, 1, 10) AS d FROM stg_games
            WHERE season = (SELECT MAX(season) FROM stg_games) AND NOT ended
              AND (home_team = ? OR away_team = ?) AND SUBSTR(start_ts, 1, 10) >= ?
            ORDER BY start_ts""", [team, team, today]).fetchall()]
    finally:
        con.close()


def valid_duration(duration: str) -> bool:
    m = DURATION_RE.match(duration)
    return duration == "kausi" or bool(m and 1 <= int(m.group(1)) <= LIMITS[m.group(2)])


def _add_months(day: dt.date, n: int) -> dt.date:
    y, m = divmod(day.month - 1 + n, 12)
    nxt = dt.date(day.year + y, m + 1, 1)
    last = ((nxt.replace(day=28) + dt.timedelta(days=4)).replace(day=1) - dt.timedelta(days=1)).day
    return nxt.replace(day=min(day.day, last))


def until_for(duration: str, team: str, today: str) -> str:
    """Paluupäivä (sinä päivänä jo pelaa): N:nnen ottelun jälkeinen päivä,
    tai tänään + N viikkoa / kuukautta."""
    if duration == "kausi":
        return SEASON_END
    m = DURATION_RE.match(duration)
    n, unit = int(m.group(1)), m.group(2)
    if unit == "vko":
        return min(SEASON_END, (dt.date.fromisoformat(today) + dt.timedelta(weeks=n)).isoformat())
    if unit == "kk":
        return min(SEASON_END, _add_months(dt.date.fromisoformat(today), n).isoformat())
    dates = _team_dates(team, today)
    if n > len(dates):
        return SEASON_END
    return (dt.date.fromisoformat(dates[n - 1]) + dt.timedelta(days=1)).isoformat()


def validate(url: str, player: str, team: str, kind: str, duration: str, urls: set[str]) -> list[str]:
    errors = []
    if url and url not in urls:              # tyhjä = kirjattu ilman uutista (tieto muualta)
        errors.append("uutista ei löydy news_items.csv:stä")
    if kind == "dismiss":                    # ohitus (EI OK): uutinen pakollinen, pelaaja ei
        return errors + ([] if url else ["ohitus tarvitsee uutisen"])
    if (player, team) not in _roster():
        errors.append("pelaajaa ei löydy joukkueen rosterista")
    if kind not in ("out", "back"):
        errors.append("KIND on out, back tai dismiss")
    if kind == "out" and not valid_duration(duration):
        errors.append("DURATION on esim. 6ott, 3vko, 2kk tai kausi")
    return errors


def record(folder: Path, url: str, player: str, team: str, kind: str, duration: str, today: str) -> dict:
    """Uusi kirjaus omaan tiedostoonsa (absences.py); paluu on oma kirjauksensa."""
    new = {"approved_at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"), "url": url, "player": player,
           "team": team, "kind": kind, "games": duration if kind == "out" else "", "start": today,
           "until": until_for(duration, team, today) if kind == "out" else today}
    if kind == "dismiss":
        new.update(player=player or "", team=team or "", until="")
    absences.write(folder, new)
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
    r = record(folder, env["NEWS_URL"], env["PLAYER"], env["TEAM"], env["KIND"], env["DURATION"], today)
    what = {"out": f"poissa {r['start']} – {r['until']}", "back": f"palaa {today}", "dismiss": "uutinen ohitettu"}[r["kind"]]
    print(f"kirjattu: {r['player'] or '-'} ({r['team'] or '-'}) {what}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(Path(sys.argv[1])))
