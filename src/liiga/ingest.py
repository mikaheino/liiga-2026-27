"""Ingest Liiga games from the public liiga.fi v2 API into the database.

API (no auth, no scraping):
    https://www.liiga.fi/api/v2/games?tournament=runkosarja&season=YYYY
where season=2026 means the 2025-26 season, 2027 means 2026-27, etc.

We do two things:
1. Cache each season's raw JSON to data/raw/ (so we hit the API only once).
2. Flatten the games into a tidy `raw_games` table (one row per game) plus a
   `raw_goal_events` table (one row per goal, carrying scorer + assists), which
   later stages build player rates from.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import requests

from .config import load_config, resolve_path
from .db import get_connection, query_df, register_df


def _season_url(season: int) -> str:
    cfg = load_config()["ingestion"]
    return f"{cfg['api_base']}/games?tournament={cfg['tournament']}&season={season}"


def fetch_season(season: int, *, force: bool = False) -> list[dict]:
    """Download one season's games (cached on disk)."""
    cfg = load_config()["ingestion"]
    raw_dir = resolve_path(load_config()["paths"]["raw_dir"])
    raw_dir.mkdir(parents=True, exist_ok=True)
    cache = raw_dir / f"games_{season}.json"

    if cache.exists() and not force:
        with open(cache, encoding="utf-8") as fh:
            return json.load(fh)

    resp = requests.get(
        _season_url(season),
        headers={"User-Agent": cfg["user_agent"], "Accept": "application/json"},
        timeout=cfg["request_timeout_seconds"],
    )
    resp.raise_for_status()
    games = resp.json()
    with open(cache, "w", encoding="utf-8") as fh:
        json.dump(games, fh)
    return games


def _finished_category(finished_type: str | None) -> str | None:
    """Map liiga.fi finishedType to regulation / overtime / shootout."""
    if not finished_type:
        return None
    ft = finished_type.upper()
    if "WINNING_SHOT" in ft:        # shootout
        return "shootout"
    if "EXTENDED" in ft or "OVERTIME" in ft:
        return "overtime"
    if "REGULAR" in ft:
        return "regulation"
    return "other"


def _flatten_games(games: list[dict], season: int) -> pd.DataFrame:
    rows = []
    for g in games:
        home, away = g.get("homeTeam", {}), g.get("awayTeam", {})
        cat = _finished_category(g.get("finishedType"))
        hg, ag = home.get("goals"), away.get("goals")
        winner = None
        if g.get("ended") and hg is not None and ag is not None:
            winner = "home" if hg > ag else "away"
        rows.append(
            {
                "game_id": g.get("id"),
                "season": g.get("season", season),
                "serie": g.get("serie"),
                "game_week": g.get("gameWeek"),
                "start": g.get("start"),
                "started": bool(g.get("started")),
                "ended": bool(g.get("ended")),
                "home_team": home.get("teamName"),
                "away_team": away.get("teamName"),
                "home_goals": hg,
                "away_goals": ag,
                "finished_type": g.get("finishedType"),
                "result_category": cat,         # regulation / overtime / shootout
                "winner": winner,               # home / away (None if unplayed)
                "spectators": g.get("spectators"),
            }
        )
    return pd.DataFrame(rows)


def _flatten_goal_events(games: list[dict], season: int) -> pd.DataFrame:
    rows = []
    for g in games:
        if not g.get("ended"):
            continue
        for side in ("homeTeam", "awayTeam"):
            team = g.get(side, {})
            team_name = team.get("teamName")
            for ev in team.get("goalEvents", []) or []:
                scorer = ev.get("scorerPlayer") or {}
                gtypes = ev.get("goalTypes") or []
                rows.append(
                    {
                        "game_id": g.get("id"),
                        "season": g.get("season", season),
                        "team": team_name,
                        "is_home": side == "homeTeam",
                        "player_id": ev.get("scorerPlayerId"),
                        "first_name": scorer.get("firstName"),
                        "last_name": scorer.get("lastName"),
                        "period": ev.get("period"),
                        "assist_count": len(ev.get("assistantPlayerIds") or []),
                        "goal_types": ",".join(map(str, gtypes)),
                        "is_winning_goal": bool(ev.get("winningGoal")),
                        # goalType codes (verified against data): TM = empty net,
                        # VL = shootout winner, YV = power play, AV = short-handed.
                        "is_empty_net": "TM" in gtypes,
                        "is_powerplay": "YV" in gtypes or "YV2" in gtypes,
                        "is_shootout": "VL" in gtypes,
                    }
                )
    df = pd.DataFrame(rows)
    return df


def _flatten_assists(games: list[dict], season: int) -> pd.DataFrame:
    """One row per (assisting player, goal). Goals themselves are in
    raw_goal_events; this captures the secondary point producers."""
    rows = []
    for g in games:
        if not g.get("ended"):
            continue
        for side in ("homeTeam", "awayTeam"):
            team = g.get(side, {})
            for ev in team.get("goalEvents", []) or []:
                ids = ev.get("assistantPlayerIds") or []
                names = ev.get("assistantPlayers") or []
                gtypes = ev.get("goalTypes") or []
                if "VL" in gtypes:        # shootout "goals" have no real assists
                    continue
                for i, pid in enumerate(ids):
                    nm = names[i] if i < len(names) else {}
                    rows.append(
                        {
                            "game_id": g.get("id"),
                            "season": g.get("season", season),
                            "team": team.get("teamName"),
                            "player_id": pid,
                            "first_name": (nm or {}).get("firstName"),
                            "last_name": (nm or {}).get("lastName"),
                        }
                    )
    return pd.DataFrame(rows)


def _position_group(role: str | None) -> str | None:
    if not role:
        return None
    r = role.upper()
    if "GOAL" in r:                          # GOALKEEPER / GOALIE
        return "G"
    if "DEFENS" in r or "BACK" in r:         # DEFENSEMAN
        return "D"
    # forwards: WING/CENTER (training-season vocab) or STRIKER/FORWARD (roster vocab)
    if any(t in r for t in ("WING", "CENTER", "CENTRE", "FORWARD", "STRIKER")):
        return "F"
    return None


def harvest_bios(*, force: bool = False) -> int:
    """Collect player bios (date of birth, position, nationality) for the age
    curve and positional priors. We fetch ONE game per (team, season) from the
    single-game endpoint, whose squad lists carry full bios. Cheap (~100 calls)
    and cached. Returns number of distinct players captured."""
    cfg = load_config()["ingestion"]
    raw_dir = resolve_path(load_config()["paths"]["raw_dir"])
    con = get_connection()
    try:
        sample = query_df(
            con,
            """
            SELECT season, MIN(game_id) AS game_id FROM (
                SELECT season, home_team AS team, game_id FROM raw_games WHERE ended
                UNION ALL
                SELECT season, away_team AS team, game_id FROM raw_games WHERE ended
            ) GROUP BY season, team
            """,
        )
    finally:
        con.close()

    bios: dict[int, dict] = {}
    for season, game_id in zip(sample["season"], sample["game_id"]):
        cache = raw_dir / f"game_{season}_{int(game_id)}.json"
        if cache.exists() and not force:
            with open(cache, encoding="utf-8") as fh:
                detail = json.load(fh)
        else:
            url = f"{cfg['api_base']}/games/{season}/{int(game_id)}"
            resp = requests.get(
                url,
                headers={"User-Agent": cfg["user_agent"], "Accept": "application/json"},
                timeout=cfg["request_timeout_seconds"],
            )
            resp.raise_for_status()
            detail = resp.json()
            with open(cache, "w", encoding="utf-8") as fh:
                json.dump(detail, fh)
        for side in ("homeTeamPlayers", "awayTeamPlayers"):
            for p in detail.get(side, []) or []:
                pid = p.get("id")
                if pid is None:
                    continue
                # Keep the most recent season's bio for each player.
                if pid not in bios or season > bios[pid]["season"]:
                    bios[pid] = {
                        "player_id": pid,
                        "season": season,
                        "first_name": p.get("firstName"),
                        "last_name": p.get("lastName"),
                        "date_of_birth": p.get("dateOfBirth"),
                        "position_group": _position_group(p.get("role")),
                        "role": p.get("role"),
                        "nationality": p.get("nationality"),
                    }

    bios_df = pd.DataFrame(list(bios.values()))
    con = get_connection()
    try:
        register_df(con, "player_bio", bios_df)
    finally:
        con.close()
    return len(bios_df)


def ingest_all(*, force: bool = False) -> dict[str, int]:
    """Fetch every configured season and load raw tables. Returns row counts."""
    cfg = load_config()["ingestion"]
    seasons = list(cfg["train_seasons"]) + [cfg["target_season"]]

    all_games, all_events, all_assists = [], [], []
    for season in seasons:
        games = fetch_season(season, force=force)
        all_games.append(_flatten_games(games, season))
        all_events.append(_flatten_goal_events(games, season))
        all_assists.append(_flatten_assists(games, season))
        print(f"  season {season}: {len(games)} games")

    games_df = pd.concat(all_games, ignore_index=True)
    events_df = pd.concat(all_events, ignore_index=True)
    assists_df = pd.concat(all_assists, ignore_index=True)

    con = get_connection()
    try:
        register_df(con, "raw_games", games_df)
        register_df(con, "raw_goal_events", events_df)
        register_df(con, "raw_assists", assists_df)
    finally:
        con.close()

    return {
        "raw_games": len(games_df),
        "raw_goal_events": len(events_df),
        "raw_assists": len(assists_df),
    }


if __name__ == "__main__":
    counts = ingest_all()
    print("Loaded:", counts)
    n = harvest_bios()
    print(f"Player bios: {n}")
