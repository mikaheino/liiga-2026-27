"""Season tables from hockeydb.com, for players with no Liiga history.

The EliteProspects route is dead (403 directly and via r.jina.ai); hockeydb
answers plain curl. CLAUDE.md "Ulkoiset tilastot" has the background. Every
trap listed there is handled here, so a lookup does not have to rediscover
them:

  * search by SURNAME only -- "Osipov Aleksandr" is a 404, "Osipov" works
  * the header row sits in a different place on skater and goalie pages:
    find the row that says "Season"
  * the player page quotes class with ", the search page with '
  * save percentage is the column "Pct", not "SV%"
  * some rows have an empty Pct: skip them, never assume zero

Season numbering: hockeydb "2024-25" is our season 2025.

    python scripts/hockeydb.py search Nemecek Varonen
    python scripts/hockeydb.py show 296495 --from 2022

It only reads and prints. Writing data/external_players.csv or
data/goalies_raw.txt stays a deliberate, reviewed step.
"""
from __future__ import annotations

import argparse
import html
import re
import time
import urllib.parse
import urllib.request

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36")
BASE = "https://www.hockeydb.com/ihdb/stats"
PAUSE = 1.5                     # free site: be polite between requests

# hockeydb league code -> the name data/league_factors.csv uses. An unknown
# league is printed as "?" so nobody writes it into the CSV unmapped:
# external.py would treat it as Liiga-equivalent (factor 1.0) silently.
LEAGUE = {
    "SM-liiga": "Liiga", "SweHL": "SHL", "Swe-1": "Allsvenskan",
    "Swe-Jr": "SWE-U20", "Czech": "Czechia", "Czech2": "OTHER",
    "Mestis": "Mestis", "Austria": "ICEHL", "AlpsHL": "OTHER",
    "WHL": "CHL", "OHL": "CHL", "QMJHL": "CHL", "AHL": "AHL", "NHL": "NHL",
    "ECHL": "ECHL", "USHL": "USHL", "NCAA": "NCAA", "DEL": "DEL",
    "DEL2": "DEL2", "KHL": "KHL", "VHL": "OTHER", "Fin-Jr": "Liiga-U20",
    "Jr. A SM-liiga": "Liiga-U20", "Slovakia": "Slovakia", "Swiss": "Switzerland",
    "NL": "Switzerland", "Swiss-A": "Switzerland", "Denmark": "Denmark", "Norway": "Norway",
    "France": "France", "Poland": "Poland",
}


def _get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode("utf-8", errors="replace")
    time.sleep(PAUSE)
    return body


def _cells(row: str) -> list[str]:
    return [html.unescape(re.sub(r"<[^>]+>", "", c)).strip()
            for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S)]


def search(surname: str) -> list[dict]:
    q = urllib.parse.urlencode({"full_name": surname})
    page = _get(f"{BASE}/find_player.php?{q}")
    out = []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S):
        m = re.search(r"pdisplay\.php\?pid=(\d+)['\"]>([^<]*)</a>", row)
        if not m:
            continue
        c = _cells(row)
        out.append({"pid": m.group(1), "name": html.unescape(m.group(2)),
                    "pos": c[2] if len(c) > 2 else "",
                    "yob": c[3] if len(c) > 3 else "",
                    "born": c[4] if len(c) > 4 else "",
                    "years": c[5] if len(c) > 5 else "",
                    "team": c[7] if len(c) > 7 else ""})
    return out


def seasons(pid: str) -> tuple[bool, list[dict]]:
    """(is_goalie, rows). Each row: season, team, league, raw_league, gp, and
    goals/assists for skaters or save_pct for goalies (None when blank)."""
    page = _get(f"{BASE}/pdisplay.php?pid={pid}")
    table = next((t for t in re.findall(r"<table[^>]*>.*?</table>", page, re.S)
                  if "Season" in t), None)
    if table is None:
        return False, []
    rows = [c for c in (_cells(r) for r in
                        re.findall(r"<tr[^>]*>(.*?)</tr>", table, re.S)) if any(c)]
    k = next((i for i, r in enumerate(rows[:3]) if "Season" in r), None)
    if k is None:
        return False, []
    hdr = rows[k][rows[k].index("Season"):]
    ix = {name: hdr.index(name) for name in hdr if name}
    goalie = "Pct" in ix
    out = []
    for r in rows[k + 1:]:
        if not re.match(r"^\d{4}-\d{2}$", r[0] or ""):
            continue
        gp = r[ix["GP"]] if ix.get("GP", 99) < len(r) else ""
        rec = {"season": int(r[0][:2] + r[0][-2:]), "team": r[ix["Team"]],
               "raw_league": r[ix["Lge"]],
               "league": LEAGUE.get(r[ix["Lge"]], "?"),
               "gp": int(gp) if gp.isdigit() else None}
        if goalie:
            pct = r[ix["Pct"]] if ix["Pct"] < len(r) else ""
            rec["save_pct"] = float(pct) if re.match(r"^0?\.\d+$", pct) else None
        else:
            g = r[ix["G"]] if ix.get("G", 99) < len(r) else ""
            a = r[ix["A"]] if ix.get("A", 99) < len(r) else ""
            rec["goals"] = int(g) if g.isdigit() else None
            rec["assists"] = int(a) if a.isdigit() else None
        out.append(rec)
    return goalie, out


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search"); s.add_argument("surnames", nargs="+")
    w = sub.add_parser("show"); w.add_argument("pids", nargs="+")
    w.add_argument("--from", dest="lo", type=int, default=2022)
    a = ap.parse_args()
    if a.cmd == "search":
        for name in a.surnames:
            print(f"\n## {name}")
            for h in search(name):
                print(f"  pid={h['pid']:>7}  {h['name']:<24} {h['pos']:<2} "
                      f"{h['yob']:<5} {h['born'][:22]:<22} {h['years']:<10} {h['team']}")
    else:
        for pid in a.pids:
            goalie, rows = seasons(pid)
            print(f"\n## pid {pid} ({'maalivahti' if goalie else 'kenttäpelaaja'})")
            for r in rows:
                if r["season"] < a.lo:
                    continue
                stat = (f"tor% {r['save_pct']}" if goalie
                        else f"{r['goals']}+{r['assists']}")
                print(f"  {r['season']}  {r['raw_league']:<12} -> {r['league']:<12} "
                      f"{r['team'][:28]:<28} {str(r['gp']):>3} ott  {stat}")


if __name__ == "__main__":
    main()
