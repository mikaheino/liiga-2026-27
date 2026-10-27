"""Automaattiset kirjaukset uutisista (27.10.2026; docs/uutismalli_suunnitelma.md).

Käyttäjä 27.10.: "eikö haastajan pitänyt ottaa asioita automaattisesti mukaan?"
Haastaja kirjaa itse poissaolon, kun uutinen on yksiselitteinen:
  - liputettu pelikielloksi tai loukkaantumiseksi, enintään 21 vrk vanha,
  - täsmälleen yksi rosterin pelaaja tunnistuu, ja hänen sukunimensä on otsikossa,
  - kesto on luku (otteluita, viikkoja tai kuukausia) otsikossa tai ingressissä
    ("huilaa kuusi ottelua", "sivussa 2-4 viikkoa" -> suurempi),
  - uutisesta ei ole vielä kirjausta (käyttäjän OK tai ohitus voittaa aina).
Epämääräiset ("pitkään sivussa") ja monitulkintaiset jäävät käyttäjän Kirjattaviin.
Kirjaus merkitään source=auto; käyttäjän "Peru" (ohitus samalle uutiselle) kumoaa sen.

    python scripts/news/auto_absences.py NEWSDIR
"""
from __future__ import annotations

import csv
import datetime as dt
import re
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

import duckdb
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
import absences  # noqa: E402
import approve  # noqa: E402
from load_news import _fold, _stems, candidates  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
NUMERALS = {"yhden": 1, "kahden": 2, "kolmen": 3, "neljän": 4, "viiden": 5, "kuuden": 6, "seitsemän": 7,
            "kahdeksan": 8, "yhdeksän": 9, "kymmenen": 10, "yksi": 1, "kaksi": 2, "kolme": 3, "neljä": 4,
            "viisi": 5, "kuusi": 6}
NUM = r"(?:\d+\s*[-–]\s*)?(\d+|" + "|".join(NUMERALS) + r")\s+"
UNITS = (("ott", r"ottelu"), ("vko", r"viik"), ("kk", r"kuukau"))
MAX_AGE_DAYS = 21


def explicit_duration(text: str) -> str | None:
    """Kesto vain, jos siinä on luku: "6ott", "4vko", "2kk"; muuten None."""
    t = text.lower()
    for unit, word in UNITS:
        if m := re.search(NUM + word, t):
            n = NUMERALS.get(m.group(1)) or int(m.group(1))
            return f"{n}{unit}" if approve.valid_duration(f"{n}{unit}") else None
    return None


def decide(items: pd.DataFrame, cands: pd.DataFrame, handled: set[str], today: str) -> list[dict]:
    """Uutiset, jotka voi kirjata ilman käyttäjää."""
    since = (dt.date.fromisoformat(today) - dt.timedelta(days=MAX_AGE_DAYS)).isoformat()
    out = []
    for it in items.itertuples(index=False):
        when = (it.published or it.fetched_at or "")[:10]
        if not re.search(r"loukkaantuminen|pelikielto", it.flags or "") or it.url in handled or when < since:
            continue
        c = cands[cands["url"] == it.url]
        if len(c) != 1:
            continue
        player, team = c.iloc[0]["player"], c.iloc[0]["team"]
        title = " " + _fold(it.title) + " "
        if not any(re.search(r"[\s\-–(\"'”]" + re.escape(s), title) for s in _stems(player)):
            continue                                        # nimi vain ingressissä: liian epävarma
        dur = explicit_duration(f"{it.title} {it.summary or ''}")
        if dur:
            out.append({"url": it.url, "player": player, "team": team, "duration": dur, "title": it.title})
    return out


def played_since(con, news: Path) -> dict[str, str]:
    """Pelaaja -> viimeisin päivä, jona hän oli kokoonpanossa (kauden ottelut:
    repon game_lineups + klo 14 -ajojen lineup_players)."""
    last: dict[str, str] = {}
    for name, d in con.execute("""
            SELECT l.first_name || ' ' || l.last_name, MAX(SUBSTR(g.start_ts, 1, 10))
            FROM game_lineups l JOIN stg_games g ON g.season = l.season AND g.game_id = l.game_id
            WHERE l.season = (SELECT MAX(season) FROM stg_games) AND l.line IS NOT NULL
            GROUP BY 1""").fetchall():
        last[name] = d
    games = {r["game_id"]: r["date"] for r in csv.DictReader((news / "lineup_games.csv").open(encoding="utf-8"))} \
        if (news / "lineup_games.csv").exists() else {}
    if (news / "lineup_players.csv").exists():
        for r in csv.DictReader((news / "lineup_players.csv").open(encoding="utf-8")):
            d = games.get(r["game_id"], "")
            if r["line"] and d:
                name = f"{r['first_name']} {r['last_name']}"
                last[name] = max(last.get(name, ""), d)
    return last


def main(news: Path) -> int:
    today = dt.datetime.now(ZoneInfo("Europe/Helsinki")).date().isoformat()
    path = news / "news_items.csv"
    items = pd.read_csv(path, dtype=str).fillna("") if path.exists() else pd.DataFrame()
    if items.empty:
        return 0
    con = duckdb.connect(str(ROOT / "data" / "liiga.duckdb"), read_only=True)
    try:
        roster = con.execute("""SELECT name, team, position_group FROM player_rates
                                UNION ALL SELECT name, team, 'G' FROM team_goalie_weights""").df().drop_duplicates(["name", "team"])
        played = played_since(con, news)
    finally:
        con.close()
    handled = {r["url"] for r in absences.events(news) if r["url"]}
    now = dt.datetime.now(dt.UTC).isoformat(timespec="seconds")
    for d in decide(items, candidates(items, roster), handled, today):
        start = (items.loc[items["url"] == d["url"], "published"].iloc[0] or today)[:10]
        start = max(start, (dt.date.fromisoformat(today) - dt.timedelta(days=MAX_AGE_DAYS)).isoformat())
        until = approve.until_for(d["duration"], d["team"], start)
        if until <= today:
            continue                                        # jo päättynyt: ei vaikuta enää
        if played.get(d["player"], "") > start:
            print(f"ohitettu: {d['player']} on pelannut {played[d['player']]} uutisen jälkeen ({d['title']})")
            continue                                        # todellisuus voittaa uutisen arvion
        absences.write(news, {"approved_at": now, "url": d["url"], "player": d["player"], "team": d["team"],
                              "kind": "out", "games": d["duration"], "start": start, "until": until, "source": "auto"})
        print(f"automaattisesti: {d['player']} ({d['team']}) {d['duration']} {start}–{until}: {d['title']}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(Path(sys.argv[1])))
