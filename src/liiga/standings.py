"""Standings snapshots, and the game results they can be made to yield.

The per-game endpoint is the primary source, but it has been observed serving
a partial payload -- only the two player lists, no `game` object, so no result
at all. When that happens there is nothing left to read a score from, because
the season endpoint is not used either (it returns 502 for the current season
from some networks).

`/api/v2/standings?season=N` is a third door, and it stays open: verified 200
from both a laptop and Snowflake's egress while the season endpoint was 502
from the same place. It is cumulative per team -- games, points, goals for and
against -- so a single snapshot cannot say what happened in any one game.

Two consecutive snapshots can. A team whose `games` rose by one played exactly
one game in between; the fixture list says who against, and the `goals` and
`goalsAgainst` deltas are that game's score. `ties` rising says it went past
regulation, and `overtimeWins` says who took it. That reconstructs everything
the model needs, margin included, which is what keeps Elo learning.

The one thing it cannot do is split overtime from a shootout -- both score
2-1 and both raise `ties`. Reconstructed games are recorded as `overtime` and
tagged `result_source = 'standings_delta'`, so the tie-rate calibration can
exclude them rather than be quietly skewed.
"""
from __future__ import annotations

import datetime as dt

import pandas as pd

from .config import load_config
from .db import get_connection, query_df, register_df, replace_rows

TABLE = "raw_standings"

COLUMNS = ["snapshot_at", "season", "team", "games", "points", "wins",
           "losses", "ties", "overtime_wins", "overtime_losses", "goals",
           "goals_against", "pp_goals", "pp_instances", "sh_instances",
           "sh_goals_against", "penalty_minutes", "total_penalties", "ranking"]

# Standings field -> our column. Values arrive as strings often enough that
# everything goes through _num().
_FIELDS = {
    "games": "games", "points": "points", "wins": "wins", "losses": "losses",
    "ties": "ties", "overtimeWins": "overtime_wins",
    "overtimeLosses": "overtime_losses", "goals": "goals",
    "goalsAgainst": "goals_against", "powerPlayGoals": "pp_goals",
    "powerPlayInstances": "pp_instances",
    "shortHandedInstances": "sh_instances",
    "shortHandedGoalsAgainst": "sh_goals_against",
    "penaltyMinutes": "penalty_minutes", "totalPenalties": "total_penalties",
    "ranking": "ranking",
}


def _num(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def fetch_standings(season: int, cfg: dict | None = None) -> list[dict]:
    """Cumulative table for the season, straight from the API."""
    from .results import _get

    cfg = cfg or load_config()["ingestion"]
    data = _get(f"{cfg['api_base']}/standings?season={int(season)}", cfg)
    return (data or {}).get("season") or []


def snapshot_standings(con=None, season: int | None = None) -> int:
    """Append one snapshot of the current table. Returns rows written.

    Idempotent within a run: a second call on the same UTC minute replaces
    that snapshot rather than adding a duplicate.
    """
    cfg = load_config()["ingestion"]
    season = season or cfg["target_season"]
    taken = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")

    rows = []
    for t in fetch_standings(season, cfg):
        row = {"snapshot_at": taken, "season": season,
               "team": t.get("teamName")}
        row.update({col: _num(t.get(src)) for src, col in _FIELDS.items()})
        rows.append(row)
    fresh = pd.DataFrame(rows, columns=COLUMNS)
    if fresh.empty:
        return 0

    own = con is None
    con = con or get_connection()
    try:
        combined = replace_rows(con, TABLE, COLUMNS, "snapshot_at", [taken],
                                fresh)
        register_df(con, TABLE, combined)
    finally:
        if own:
            con.close()
    return len(fresh)


def _latest_two(con, season: int) -> tuple[pd.DataFrame, pd.DataFrame] | None:
    snaps = query_df(
        con,
        f"SELECT DISTINCT snapshot_at FROM {TABLE} WHERE season = {int(season)}")
    if len(snaps) < 2:
        return None
    order = sorted(snaps["snapshot_at"].astype(str))
    prev, cur = order[-2], order[-1]
    rows = query_df(
        con,
        f"""SELECT * FROM {TABLE}
            WHERE season = {int(season)}
              AND snapshot_at IN ('{prev}', '{cur}')""")
    return (rows[rows["snapshot_at"].astype(str) == prev].set_index("team"),
            rows[rows["snapshot_at"].astype(str) == cur].set_index("team"))


def reconstruct_games(con=None, season: int | None = None) -> dict:
    """Fill in results the per-game endpoint could not give us.

    Only touches fixtures still marked unplayed, and only when the arithmetic
    is unambiguous: both teams gained exactly one game, and one side's goals
    scored equals the other's goals conceded. Anything else is left alone and
    counted in `skipped` -- a wrong score is worse than a missing one.
    """
    cfg = load_config()["ingestion"]
    season = season or cfg["target_season"]

    own = con is None
    con = con or get_connection()
    try:
        pair = _latest_two(con, season)
        if pair is None:
            return {"resolved": 0, "skipped": 0,
                    "note": "need two snapshots before a delta exists"}
        prev, cur = pair

        played_once = set()
        delta = {}
        for team in cur.index:
            if team not in prev.index:
                continue
            d = {c: (_num(cur.loc[team, c]) or 0) - (_num(prev.loc[team, c]) or 0)
                 for c in ("games", "points", "goals", "goals_against",
                           "ties", "overtime_wins")}
            delta[team] = d
            if d["games"] == 1:
                played_once.add(team)

        pending = query_df(
            con,
            f"""SELECT game_id, home_team, away_team FROM raw_games
                WHERE season = {int(season)} AND NOT ended
                ORDER BY start_time""")

        resolved, skipped = [], 0
        for _, g in pending.iterrows():
            h, a = g["home_team"], g["away_team"]
            if h not in played_once or a not in played_once:
                continue
            dh, da = delta[h], delta[a]
            # The two sides must agree on the score, or the deltas belong to
            # different games and cannot be attributed to this one.
            if dh["goals"] != da["goals_against"] or da["goals"] != dh["goals_against"]:
                skipped += 1
                continue
            overtime = dh["ties"] == 1 and da["ties"] == 1
            resolved.append({
                "game_id": int(g["game_id"]),
                "home_goals": dh["goals"], "away_goals": da["goals"],
                "result_category": "overtime" if overtime else "regulation",
                "winner": "home" if dh["goals"] > da["goals"] else "away",
            })
            played_once -= {h, a}      # each team's delta explains one game

        if resolved:
            raw = query_df(con, f"SELECT * FROM raw_games WHERE season = {int(season)}")
            by_id = {r["game_id"]: r for r in resolved}
            mask = raw["game_id"].isin(by_id)
            for col in ("home_goals", "away_goals", "result_category", "winner"):
                raw.loc[mask, col] = raw.loc[mask, "game_id"].map(
                    lambda g: by_id[g][col])
            raw.loc[mask, "ended"] = True
            raw.loc[mask, "started"] = True
            if "result_source" in raw.columns:
                raw.loc[mask, "result_source"] = "standings_delta"
            combined = replace_rows(con, "raw_games", list(raw.columns),
                                    "season", [season], raw)
            register_df(con, "raw_games", combined)
    finally:
        if own:
            con.close()

    return {"resolved": len(resolved), "skipped": skipped,
            "game_ids": [r["game_id"] for r in resolved]}
