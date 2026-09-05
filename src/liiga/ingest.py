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
from .db import get_connection, query_df, register_df, replace_rows


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
                "start_time": g.get("start"),
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
                # Where the result came from. The standings-delta path fills
                # this with "standings_delta" so tie-rate calibration can
                # exclude rows where overtime and shootout are indistinguishable.
                "result_source": "api",
                "home_xg": home.get("expectedGoals"),
                "away_xg": away.get("expectedGoals"),
                "home_pp_goals": home.get("powerplayGoals"),
                "away_pp_goals": away.get("powerplayGoals"),
                "home_pp_instances": home.get("powerplayInstances"),
                "away_pp_instances": away.get("powerplayInstances"),
                "home_sh_goals": home.get("shortHandedGoals"),
                "away_sh_goals": away.get("shortHandedGoals"),
                "home_sh_instances": home.get("shortHandedInstances"),
                "away_sh_instances": away.get("shortHandedInstances"),
                "home_timeout_s": home.get("timeOut"),
                "away_timeout_s": away.get("timeOut"),
                "home_ranking": home.get("ranking"),
                "away_ranking": away.get("ranking"),
                "home_team_id": home.get("teamId"),
                "away_team_id": away.get("teamId"),
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
                        "game_time": ev.get("gameTime"),
                        "event_id": ev.get("eventId"),
                        "home_score_after": ev.get("homeTeamScore"),
                        "away_score_after": ev.get("awayTeamScore"),
                        "scorer_goals_so_far": ev.get("goalsSoFarInSeason"),
                        "video_url": ev.get("videoClipUrl"),
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
                so_far = ev.get("assistsSoFarInSeason") or {}
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
                            "assists_so_far": so_far.get(str(pid)),
                        }
                    )
    return pd.DataFrame(rows)


def _flatten_on_ice(games: list[dict], season: int) -> pd.DataFrame:
    """One row per skater on the ice for a goal event.

    plusPlayerIds/minusPlayerIds are, despite the name, space-separated
    strings of JERSEY NUMBERS, not player ids. Special-teams goals
    (goalTypes containing YV/AV/VL/TM) legitimately carry empty lists --
    that's real hockey scoring, not missing data -- so they're just skipped.
    """
    rows = []
    for g in games:
        if not g.get("ended"):
            continue
        for side in ("homeTeam", "awayTeam"):
            team = g.get(side, {})
            team_name = team.get("teamName")
            for ev in team.get("goalEvents", []) or []:
                event_id = ev.get("eventId")
                for on_ice_side, key in (("plus", "plusPlayerIds"), ("minus", "minusPlayerIds")):
                    raw = ev.get(key) or ""
                    numbers = [int(n) for n in raw.split() if n]
                    # A repeated jersey number means a skater is missing from
                    # the list -- flag the whole list so analysis can drop it
                    # rather than be silently skewed (~22% of ES goals).
                    duplicated = len(numbers) != len(set(numbers))
                    for jersey in numbers:
                        rows.append(
                            {
                                "game_id": g.get("id"),
                                "season": g.get("season", season),
                                "event_id": event_id,
                                "team": team_name,
                                "side": on_ice_side,
                                "jersey": jersey,
                                "is_duplicated": duplicated,
                            }
                        )
    return pd.DataFrame(rows, columns=["game_id", "season", "event_id", "team",
                                       "side", "jersey", "is_duplicated"])


def _flatten_periods(games: list[dict], season: int) -> pd.DataFrame:
    rows = []
    for g in games:
        if not g.get("ended"):
            continue
        for p in g.get("periods", []) or []:
            rows.append(
                {
                    "game_id": g.get("id"),
                    "season": g.get("season", season),
                    "period_index": p.get("index"),
                    "home_goals": p.get("homeTeamGoals"),
                    "away_goals": p.get("awayTeamGoals"),
                    "category": p.get("category"),
                    "start_time": p.get("startTime"),
                    "end_time": p.get("endTime"),
                }
            )
    return pd.DataFrame(rows, columns=["game_id", "season", "period_index", "home_goals",
                                       "away_goals", "category", "start_time", "end_time"])


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


def _seasons_already_loaded(con) -> set[int]:
    """Seasons that already have rows in raw_games."""
    try:
        df = query_df(con, "SELECT DISTINCT season FROM raw_games")
        return {int(s) for s in df["season"].dropna()}
    except Exception:               # noqa: BLE001 -- first ever run
        return set()


def seasons_to_ingest(con, cfg: dict | None = None) -> list[int]:
    """Which seasons this run has to (re)read.

    Always the target season -- it gains games every day. Plus any configured
    season the database does not have yet, which makes the run self-healing:
    a cold Snowflake fetches all six, every later run fetches one.

    Historical seasons never change, so re-reading them is pure waste. In
    Snowflake it is not even cheap: there is no disk cache there, so each one
    is an HTTP call to liiga.fi.
    """
    cfg = cfg or load_config()["ingestion"]
    target = cfg["target_season"]
    configured = list(cfg["train_seasons"]) + [target]
    have = _seasons_already_loaded(con)
    return sorted({s for s in configured if s not in have} | {target})


def ingest_all(*, seasons: list[int] | None = None,
               force: bool = False) -> dict[str, int]:
    """Load raw tables for the seasons that need it. Returns rows written.

    `seasons=None` picks them per `seasons_to_ingest` (incremental).
    Pass an explicit list to re-read specific seasons -- that is how the
    historical backfill from the on-disk cache is done, with no API calls.
    """
    cfg = load_config()["ingestion"]

    con = get_connection()
    try:
        if seasons is None:
            seasons = seasons_to_ingest(con, cfg)
        if not seasons:
            return {"raw_games": 0, "raw_goal_events": 0, "raw_assists": 0,
                     "raw_on_ice": 0, "raw_periods": 0}

        all_games, all_events, all_assists, all_on_ice, all_periods = [], [], [], [], []
        for season in seasons:
            games = fetch_season(season, force=force)
            all_games.append(_flatten_games(games, season))
            all_events.append(_flatten_goal_events(games, season))
            all_assists.append(_flatten_assists(games, season))
            all_on_ice.append(_flatten_on_ice(games, season))
            all_periods.append(_flatten_periods(games, season))
            print(f"  season {season}: {len(games)} games")

        fresh = {
            "raw_games": pd.concat(all_games, ignore_index=True),
            "raw_goal_events": pd.concat(all_events, ignore_index=True),
            "raw_assists": pd.concat(all_assists, ignore_index=True),
            "raw_on_ice": pd.concat(all_on_ice, ignore_index=True),
            "raw_periods": pd.concat(all_periods, ignore_index=True),
        }
        for table, df in fresh.items():
            combined = replace_rows(con, table, list(df.columns),
                                    "season", seasons, df)
            register_df(con, table, combined)
    finally:
        con.close()

    return {t: len(df) for t, df in fresh.items()}


if __name__ == "__main__":
    counts = ingest_all()
    print("Loaded:", counts)
    n = harvest_bios()
    print(f"Player bios: {n}")
