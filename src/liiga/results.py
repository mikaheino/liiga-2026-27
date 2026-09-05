"""Per-game detail for played games: lineups, goalies, penalties.

`ingest_all` (season endpoint) already captures the result, the goals and the
assists. What it cannot see is who was actually dressed, which goalie started,
and the penalties -- those live only on the per-game endpoint,
`/games/{season}/{game_id}`.

This module is the scheduled in-season companion to that. It is deliberately
built to run unattended in either place:

  * **no disk.** `ingest.fetch_season` caches JSON under `data/raw/`, which is
    right on a laptop and useless in Snowflake, where the filesystem is
    ephemeral. Nothing here touches it -- fetch, parse, write, done.
  * **incremental.** It asks the API which games have ended, asks the database
    which it already has, and fetches only the difference. A day with seven
    games costs seven HTTP calls, not 544.
  * **idempotent.** Re-running replaces those games' rows rather than
    duplicating them, so a retry after a partial failure is safe.

    from liiga.results import ingest_results
    ingest_results()                       # everything newly played
    ingest_results(game_ids=[2701278])     # one game, re-fetched
"""
from __future__ import annotations

import datetime as dt

import pandas as pd
import requests

from .config import load_config
from .db import get_connection, query_df, register_df, replace_rows

# Tables this module owns. Each is keyed by game_id, so a re-fetch of one game
# replaces exactly its own rows.
LINEUP_TABLE = "game_lineups"
GOALIE_TABLE = "game_goalies"
PENALTY_TABLE = "game_penalties"

LINEUP_COLUMNS = ["game_id", "season", "team", "is_home", "player_id",
                  "first_name", "last_name", "role", "position_group", "line",
                  "jersey", "captain", "injured", "removed"]
GOALIE_COLUMNS = ["game_id", "season", "team", "is_home", "player_id",
                  "first_name", "last_name", "jersey", "depth", "started",
                  "played", "goals_against", "empty_net_seconds"]

PENALTY_COLUMNS = ["game_id", "season", "penalised_team", "drew_team",
                   "is_home", "player_id", "server_player_id", "period",
                   "game_time", "begin_time", "end_time", "minutes",
                   "fault", "fault_type", "penalty_info", "event_id"]

# liiga.fi's `role` is a position slot, not a position group. Anything that is
# not the goalie or one of the defence slots is a forward -- the slot names are
# many (STRIKER, THIRTEENTH_STRIKER, CENTER, ...) and the list grows, so match
# on what a defenceman looks like instead of enumerating forwards.
_GOALIE_ROLE = "GOALIE"

# Goal type flag for an empty-net goal. Those are conceded by nobody, so they
# come off the starter's goals-against -- otherwise every trailing team's
# goalie looks worse than he was.
_EMPTY_NET = "TM"


def _position_group(role: str | None) -> str:
    if not role:
        return "F"
    r = role.upper()
    if r == _GOALIE_ROLE:
        return "G"
    return "D" if "DEFENSE" in r or "DEFENCE" in r else "F"


def _get(url: str, cfg: dict) -> dict | list:
    resp = requests.get(
        url,
        headers={"User-Agent": cfg["user_agent"], "Accept": "application/json"},
        timeout=cfg["request_timeout_seconds"],
    )
    resp.raise_for_status()
    return resp.json()


def fetch_season_games(season: int, cfg: dict | None = None) -> list[dict]:
    """The season's games straight from the API. No cache, unlike ingest."""
    cfg = cfg or load_config()["ingestion"]
    url = (f"{cfg['api_base']}/games?tournament={cfg['tournament']}"
           f"&season={season}")
    return _get(url, cfg)


def fetch_game_detail(season: int, game_id: int, cfg: dict | None = None) -> dict:
    """One game's full detail: lineups, goalie events, penalties."""
    cfg = cfg or load_config()["ingestion"]
    return _get(f"{cfg['api_base']}/games/{season}/{int(game_id)}", cfg)


def _parse_lineups(detail: dict, season: int) -> pd.DataFrame:
    game = detail.get("game", {})
    rows = []
    for players_key, team_key, is_home in (
            ("homeTeamPlayers", "homeTeam", True),
            ("awayTeamPlayers", "awayTeam", False)):
        team = (game.get(team_key) or {}).get("teamName")
        for p in detail.get(players_key) or []:
            if p.get("id") is None:
                continue
            rows.append({
                "game_id": game.get("id"), "season": season, "team": team,
                "is_home": is_home, "player_id": p["id"],
                "first_name": p.get("firstName"), "last_name": p.get("lastName"),
                "role": p.get("role"),
                "position_group": _position_group(p.get("role")),
                "line": p.get("line"), "jersey": p.get("jersey"),
                "captain": bool(p.get("captain")),
                "injured": bool(p.get("injured")),
                "removed": bool(p.get("removed")),
            })
    return pd.DataFrame(rows, columns=LINEUP_COLUMNS)


def _parse_goalies(detail: dict, season: int) -> pd.DataFrame:
    """Goalies dressed, who actually played, and what they conceded.

    `goalKeeperEvents` is a timeline of who is in the net, not a list of
    substitutions, and it only appears when the state changes: a goalie who
    plays the full sixty minutes is absent from it entirely. Entries with
    `playerId` 0 and `emptyNet` 1 are the net standing empty (a trailing team
    pulling for an extra attacker); a named playerId is that goalie being in
    the net over that window -- including coming BACK after a pull.

    So a real substitution is a named goalie who is not the starter. That is
    the only case where goals-against cannot be attributed, and it is left
    blank rather than guessed: a wrong number is worse than a missing one.

    There is no per-goalie save count in this payload, so goals-against is the
    opponent's score less any empty-net goals.
    """
    game = detail.get("game", {})
    rows = []
    for players_key, team_key, opp_key, is_home in (
            ("homeTeamPlayers", "homeTeam", "awayTeam", True),
            ("awayTeamPlayers", "awayTeam", "homeTeam", False)):
        team_obj = game.get(team_key) or {}
        opp_obj = game.get(opp_key) or {}
        team = team_obj.get("teamName")

        events = team_obj.get("goalKeeperEvents") or []
        empty_seconds = sum(
            max(int(e.get("endTime") or 0) - int(e.get("beginTime") or 0), 0)
            for e in events if e.get("emptyNet"))
        in_net_ids = {e["playerId"] for e in events
                      if e.get("playerId") and not e.get("emptyNet")}

        conceded_total = opp_obj.get("goals")
        empty_net_goals = sum(
            1 for g in (opp_obj.get("goalEvents") or [])
            if _EMPTY_NET in (g.get("goalTypes") or []))
        conceded = (None if conceded_total is None
                    else int(conceded_total) - empty_net_goals)

        goalies = [p for p in (detail.get(players_key) or [])
                   if str(p.get("role", "")).upper() == _GOALIE_ROLE]
        starters = {p.get("id") for p in goalies if p.get("line") == 1}
        substituted = bool(in_net_ids - starters)

        for p in goalies:
            started = p.get("line") == 1
            rows.append({
                "game_id": game.get("id"), "season": season, "team": team,
                "is_home": is_home, "player_id": p.get("id"),
                "first_name": p.get("firstName"), "last_name": p.get("lastName"),
                "jersey": p.get("jersey"), "depth": p.get("line"),
                "started": started,
                "played": started or p.get("id") in in_net_ids,
                "goals_against": (conceded if started and not substituted
                                  else None),
                "empty_net_seconds": empty_seconds if started else None,
            })
    return pd.DataFrame(rows, columns=GOALIE_COLUMNS)


def _parse_penalties(detail: dict, season: int) -> pd.DataFrame:
    """Penalties, attributed to the team that actually committed them.

    The API files a penalty under the **opponent's** team object: an event in
    `homeTeam.penaltyEvents` was committed by an away player and gave the home
    team its power play. Verified over 265 penalties with a resolvable
    offender -- 265 of 265, no exceptions. Reading `teamName` off the object
    the event sits in therefore names the team that DREW the penalty, which is
    the opposite of what a column called `team` would mean to anyone. Both
    sides are stored under names that say which is which.

    `suffererPlayerId` is not the fouled player. It equals `playerId` in 92%
    of cases, and where it differs the named player is on the offender's own
    team -- nobody boards their own team-mate. It is who serves the penalty,
    so it is stored as `server_player_id`. Who was fouled is not in the API.
    """
    game = detail.get("game", {})
    rows = []
    for team_key, other_key in (("homeTeam", "awayTeam"),
                                ("awayTeam", "homeTeam")):
        drew = (game.get(team_key) or {}).get("teamName")
        penalised = (game.get(other_key) or {}).get("teamName")
        for e in (game.get(team_key) or {}).get("penaltyEvents") or []:
            rows.append({
                "game_id": game.get("id"), "season": season,
                "penalised_team": penalised, "drew_team": drew,
                # is_home follows the offender, not the filing object.
                "is_home": other_key == "homeTeam",
                "player_id": e.get("playerId"),
                "server_player_id": e.get("suffererPlayerId"),
                "period": e.get("period"), "game_time": e.get("gameTime"),
                "begin_time": e.get("penaltyBegintime"),
                "end_time": e.get("penaltyEndtime"),
                "minutes": e.get("penaltyMinutes"),
                "fault": e.get("penaltyFaultName"),
                "fault_type": e.get("penaltyFaultType"),
                "penalty_info": e.get("penaltyInfo"),
                "event_id": e.get("eventId"),
            })
    return pd.DataFrame(rows, columns=PENALTY_COLUMNS)


def _existing_game_ids(con, table: str) -> set[int]:
    try:
        df = query_df(con, f"SELECT DISTINCT game_id FROM {table}")
        return {int(x) for x in df["game_id"].dropna()}
    except Exception:               # noqa: BLE001 -- table not created yet
        return set()


def _upsert(con, table: str, columns: list[str], fresh: pd.DataFrame) -> int:
    """Replace the fetched games' rows, keep everything else."""
    if fresh.empty:
        return 0
    combined = replace_rows(con, table, columns, "game_id",
                            fresh["game_id"], fresh)
    register_df(con, table, combined)
    return len(fresh)


def played_game_ids(season: int, cfg: dict | None = None,
                    on_date: str | None = None) -> list[int]:
    """Game ids the API reports as ended, optionally limited to one date."""
    cfg = cfg or load_config()["ingestion"]
    games = fetch_season_games(season, cfg)
    return [g["id"] for g in games
            if g.get("ended") and g.get("id") is not None
            and (on_date is None or str(g.get("start", ""))[:10] == on_date)]


def ingest_results(season: int | None = None, *, game_ids: list[int] | None = None,
                   on_date: str | None = None, con=None,
                   refetch: bool = False) -> dict:
    """Fetch and store detail for played games. The scheduled entry point.

    season   -- defaults to config's target_season.
    game_ids -- explicit list; skips the "what is new" lookup entirely.
    on_date  -- 'YYYY-MM-DD', only that day's games (a yesterday-only run).
    refetch  -- re-fetch games already stored, instead of only new ones.
    """
    cfg_all = load_config()
    cfg = cfg_all["ingestion"]
    season = season or cfg["target_season"]

    own = con is None
    con = con or get_connection()
    try:
        if game_ids is None:
            ended = played_game_ids(season, cfg, on_date=on_date)
            have = set() if refetch else _existing_game_ids(con, LINEUP_TABLE)
            game_ids = [g for g in ended if g not in have]

        lineups, goalies, penalties = [], [], []
        failed: list[tuple[int, str]] = []
        for gid in game_ids:
            try:
                detail = fetch_game_detail(season, gid, cfg)
            except Exception as exc:            # noqa: BLE001
                # One bad game must not lose the others already fetched.
                failed.append((gid, str(exc).splitlines()[0][:120]))
                continue
            lineups.append(_parse_lineups(detail, season))
            goalies.append(_parse_goalies(detail, season))
            penalties.append(_parse_penalties(detail, season))

        def _frame(parts, columns):
            return (pd.concat(parts, ignore_index=True) if parts
                    else pd.DataFrame(columns=columns))

        counts = {
            LINEUP_TABLE: _upsert(con, LINEUP_TABLE, LINEUP_COLUMNS,
                                  _frame(lineups, LINEUP_COLUMNS)),
            GOALIE_TABLE: _upsert(con, GOALIE_TABLE, GOALIE_COLUMNS,
                                  _frame(goalies, GOALIE_COLUMNS)),
            PENALTY_TABLE: _upsert(con, PENALTY_TABLE, PENALTY_COLUMNS,
                                   _frame(penalties, PENALTY_COLUMNS)),
        }
    finally:
        if own:
            con.close()

    return {"season": season, "games_fetched": len(game_ids) - len(failed),
            "rows": counts, "failed": failed,
            "fetched_at": dt.datetime.now(dt.timezone.utc)
                            .isoformat(timespec="seconds")}


def yesterday() -> str:
    """Yesterday in UTC, as the API dates games."""
    return (dt.datetime.now(dt.timezone.utc).date()
            - dt.timedelta(days=1)).isoformat()
