"""Koetin: mitä liiga.fi kertoo ottelusta sen ollessa kesken? (31.10.2026)

Liveveikkaus tarvitsee kaksi asiaa joita emme ole koskaan nähneet: tilanteen ja
**jäljellä olevan peliajan**. Maalitapahtumissa on `gameTime` (ingest.py:146),
mutta niitä ei haeta kesken olevalle ottelulle, eikä kukaan tiedä onko
vastauksessa kelloa. Tämä koetin katsoo sen kerran oikeasta ottelusta.

Lukee vain: ei kirjoituksia kantaan, ei sivun käännöstä, ei mallia. Kysyy
saman endpointin jonka `results.ingest_results` kysyy, mutta `grace_hours`in
ohi, ja tulostaa mitä vastaus sisältää.

    python scripts/live/probe.py                 # kesken olevat ottelut nyt
    python scripts/live/probe.py --game-id 2701440
    python scripts/live/probe.py --out /polku    # vastaukset talteen
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))

from liiga.config import load_config  # noqa: E402
from liiga.results import fetch_game_detail  # noqa: E402

# Ottelu on kesken korkeintaan tämän ajan alkamisestaan: 3 x 20 min, kaksi
# ~18 min erätaukoa, jatkoaika ja voittomaalikilpailu, plus väljyyttä.
MAX_GAME_HOURS = 4.0

# Avaimet joiden nimi viittaa aikaan tai tilanteeseen: nämä ovat se mitä
# etsimme, joten ne tulostetaan nimeltä riippumatta siitä missä ne ovat.
TIME_HINTS = ("time", "clock", "period", "elapsed", "remaining", "sec", "min")


def _today_live(con, season: int, now: dt.datetime) -> list[dict]:
    """Ottelut jotka kellon mukaan voisivat olla juuri nyt kesken."""
    rows = con.execute(
        """SELECT CAST(game_id AS VARCHAR), start_ts, home_team, away_team, ended
           FROM stg_games WHERE season = ? AND start_ts IS NOT NULL""",
        [season]).fetchall()
    live = []
    for gid, start, home, away, ended in rows:
        try:
            t0 = dt.datetime.fromisoformat(str(start).replace("Z", "+00:00"))
        except ValueError:
            continue
        if t0.tzinfo is None:
            t0 = t0.replace(tzinfo=dt.UTC)
        age = (now - t0).total_seconds() / 3600
        if 0 <= age <= MAX_GAME_HOURS and not ended:
            live.append({"game_id": gid, "start": t0.isoformat(), "age_h": round(age, 2),
                         "home": home, "away": away})
    return sorted(live, key=lambda r: r["start"])


def _walk(node, path: str = "") -> list[tuple[str, object]]:
    """Kaikki lehtiarvot polkuineen, jotta kello löytyy vaikka se olisi upotettu."""
    found: list[tuple[str, object]] = []
    if isinstance(node, dict):
        for k, v in node.items():
            found += _walk(v, f"{path}.{k}" if path else str(k))
    elif isinstance(node, list):
        if node:
            found += _walk(node[0], f"{path}[0]")
    else:
        found.append((path, node))
    return found


def _report(gid: str, detail: dict) -> None:
    game = detail.get("game") or {}
    home, away = game.get("homeTeam") or {}, game.get("awayTeam") or {}
    print(f"\n--- {gid}: {home.get('teamName')} {home.get('goals')} - "
          f"{away.get('goals')} {away.get('teamName')} ---")
    # Nämä kolme ovat se mitä liveveikkaus tarvitsee. `gameTime` on kulunut
    # peliaika sekunteina ja `currentPeriod` menossa oleva erä (todettu
    # päättyneestä ottelusta 31.10.: gameTime=3600, currentPeriod=3). Avoin
    # kysymys on vain, päivittyvätkö ne ottelun aikana vai vasta lopuksi --
    # siihen tämä ajo vastaa.
    print(f"  >>> gameTime={game.get('gameTime')!r}  currentPeriod={game.get('currentPeriod')!r}  "
          f"stale={game.get('stale')!r}")
    print(f"  started={game.get('started')!r}  ended={game.get('ended')!r}  "
          f"finishedType={game.get('finishedType')!r}")
    print(f"  vastauksen juuritason avaimet: {sorted(detail.keys())}")
    print(f"  game-objektin avaimet: {sorted(game.keys())}")

    periods = game.get("periods") or []
    print(f"  periods ({len(periods)} kpl):")
    for p in periods:
        print(f"    {p}")

    # Maalitapahtumat ovat joukkueen alla, eivät game-objektin juuressa.
    for side in ("homeTeam", "awayTeam"):
        events = (game.get(side) or {}).get("goalEvents") or []
        last = f", viimeisin gameTime={events[-1].get('gameTime')!r} period={events[-1].get('period')!r}" if events else ""
        print(f"  {side}.goalEvents: {len(events)} kpl{last}")

    hits = [(p, v) for p, v in _walk(detail)
            if any(h in p.lower().split(".")[-1] for h in TIME_HINTS)]
    print(f"  aikaan viittaavat kentät ({len(hits)}):")
    for p, v in hits[:40]:
        print(f"    {p} = {v!r}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--game-id", action="append", default=[],
                    help="tutki nämä ottelut kannan sijaan")
    ap.add_argument("--out", type=Path, help="tallenna vastaukset tähän kansioon")
    args = ap.parse_args(argv)

    cfg = load_config()
    season = cfg["ingestion"]["target_season"]
    now = dt.datetime.now(dt.UTC)
    print(f"koetin {now.isoformat(timespec='seconds')}, kausi {season}")

    if args.game_id:
        targets = [{"game_id": g, "home": "?", "away": "?", "age_h": None} for g in args.game_id]
    else:
        con = duckdb.connect(str(ROOT / "data" / "liiga.duckdb"), read_only=True)
        try:
            targets = _today_live(con, season, now)
        finally:
            con.close()

    if not targets:
        print("ei kesken olevia otteluita juuri nyt -- aja uudelleen ottelun aikana")
        return 0

    print(f"kesken olevia otteluita: {len(targets)}")
    for t in targets:
        try:
            detail = fetch_game_detail(season, int(t["game_id"]), cfg["ingestion"])
        except Exception as exc:                      # noqa: BLE001
            print(f"\n--- {t['game_id']}: haku epäonnistui: {exc} ---")
            continue
        _report(str(t["game_id"]), detail)
        if args.out:
            args.out.mkdir(parents=True, exist_ok=True)
            path = args.out / f"game_{t['game_id']}_{now:%Y%m%dT%H%M%S}.json"
            path.write_text(json.dumps(detail, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"  tallennettu: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
