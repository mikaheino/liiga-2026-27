"""Päivän kokoonpanot liiga.fi:stä, uutismallin vaihe 1 (27.10.2026;
docs/uutismalli_suunnitelma.md).

Ajetaan klo 14.00 Suomen aikaa samassa ajossa kuin uutiskeräin (news.yml).
Jokaisesta päivän ottelusta kirjataan, oliko kokoonpano valmis (kenttäjako
`line` asetettu) ja kuka aloittaa maalilla (maalivahti `MV`, `line 1`).
Valmiista kokoonpanoista talteen myös pelaajarivit: niistä haastaja näkee, onko
poissaolevaksi kirjattu pelaaja mukana (poissaolo päättyy) vai ei (vahvistuu).

Valmiusrivi tallentuu myös silloin, kun kokoonpanoa ei vielä ole: se on
ajoituksen mittaus. 27.10. havainto: edellisenä päivänä kenttäjako puuttuu;
18.30-ottelun kokoonpano oli valmis viimeistään 15.27. Lauantain 17.00-ottelut
(28 % kaudesta) ovat klo 14:lle tiukimmat.

    python scripts/news/lineups.py OUTDIR [YYYY-MM-DD]
"""
from __future__ import annotations

import csv
import datetime as dt
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
import yaml

ROOT = Path(__file__).resolve().parents[2]
HKI = ZoneInfo("Europe/Helsinki")
GAME_FIELDS = ["fetched_at", "date", "game_id", "start", "home", "away", "lineup_ready", "home_starter", "away_starter"]
PLAYER_FIELDS = ["fetched_at", "game_id", "team", "player_id", "first_name", "last_name", "role", "line", "injured", "suspended"]


def _cfg() -> dict:
    with (ROOT / "config.yaml").open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)["ingestion"]


def _get(url: str, cfg: dict):
    r = requests.get(url, headers={"User-Agent": cfg["user_agent"], "Accept": "application/json"},
                     timeout=cfg["request_timeout_seconds"])
    r.raise_for_status()
    return r.json()


def _local_day(start: str) -> str:
    return dt.datetime.fromisoformat(start.replace("Z", "+00:00")).astimezone(HKI).date().isoformat()


def starter(players: list[dict]) -> str:
    """Aloittava maalivahti: MV ykköskentässä. Tyhjä, jos kenttäjakoa ei vielä ole."""
    for p in players:
        if p.get("roleCode") == "MV" and p.get("line") == 1:
            return f"{p.get('firstName', '')} {p.get('lastName', '')}".strip()
    return ""


def ready(detail: dict) -> bool:
    return any(p.get("line") is not None for side in ("homeTeamPlayers", "awayTeamPlayers") for p in detail.get(side) or [])


def collect(day: str, now: str) -> tuple[list[dict], list[dict]]:
    cfg = _cfg()
    season, base = cfg["target_season"], cfg["api_base"]
    schedule = _get(f"{base}/schedule?season={season}&tournament={cfg['tournament']}", cfg)
    games, players = [], []
    for g in sorted((g for g in schedule if _local_day(g["start"]) == day), key=lambda g: g["start"]):
        d = _get(f"{base}/games/{season}/{int(g['id'])}", cfg)
        ok = ready(d)
        home, away = d.get("homeTeamPlayers") or [], d.get("awayTeamPlayers") or []
        games.append({"fetched_at": now, "date": day, "game_id": g["id"], "start": g["start"],
                      "home": g["homeTeamName"], "away": g["awayTeamName"], "lineup_ready": int(ok),
                      "home_starter": starter(home), "away_starter": starter(away)})
        if not ok:
            continue
        for team, side in ((g["homeTeamName"], home), (g["awayTeamName"], away)):
            for p in side:
                players.append({"fetched_at": now, "game_id": g["id"], "team": team, "player_id": p.get("id"),
                                "first_name": p.get("firstName", ""), "last_name": p.get("lastName", ""),
                                "role": p.get("roleCode", ""), "line": "" if p.get("line") is None else p["line"],
                                "injured": int(bool(p.get("injured"))), "suspended": int(bool(p.get("suspended")))})
    return games, players


def _append(path: Path, fields: list[str], rows: list[dict]) -> None:
    new = not path.exists()
    with path.open("a", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        if new:
            w.writeheader()
        w.writerows(rows)


def main(out_dir: Path, day: str | None = None) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    now_dt = dt.datetime.now(dt.UTC)
    day = day or now_dt.astimezone(HKI).date().isoformat()
    games, players = collect(day, now_dt.isoformat(timespec="seconds"))
    _append(out_dir / "lineup_games.csv", GAME_FIELDS, games)
    _append(out_dir / "lineup_players.csv", PLAYER_FIELDS, players)
    if not games:
        print(f"{day}: ei otteluita")
    for g in games:
        local = dt.datetime.fromisoformat(g["start"].replace("Z", "+00:00")).astimezone(HKI).strftime("%H.%M")
        state = f"MV {g['home_starter']} – {g['away_starter']}" if g["lineup_ready"] else "kokoonpano ei valmis"
        print(f"{day} {local} {g['home']} – {g['away']}: {state}")
    print(f"otteluita {len(games)}, kokoonpano valmiina {sum(g['lineup_ready'] for g in games)}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    sys.exit(main(Path(sys.argv[1]), sys.argv[2] if len(sys.argv) == 3 else None))
