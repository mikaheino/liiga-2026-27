"""Build the 2026-27 rosters: official liiga.fi squads + your CSV overrides.

liiga.fi already publishes 2026-27 squads (including the newly promoted Jokerit)
inside the single-game endpoint. We harvest one game per team to read each
squad, then apply data/rosters_2026_27.csv on top (action = add / remove) so you
can correct transfers and signings as the offseason evolves.
"""
from __future__ import annotations

import json

import pandas as pd
import requests

from .config import load_config, resolve_path
from .db import get_connection, query_df, register_df
from .ingest import _position_group


def _fetch_official_rosters() -> pd.DataFrame:
    cfg = load_config()["ingestion"]
    target = cfg["target_season"]
    raw_dir = resolve_path(load_config()["paths"]["raw_dir"])

    con = get_connection()
    try:
        # one game per team in the target season
        sample = query_df(
            con,
            f"""
            SELECT team, MIN(game_id) AS game_id FROM (
                SELECT home_team AS team, game_id FROM raw_games WHERE season={target}
                UNION ALL
                SELECT away_team AS team, game_id FROM raw_games WHERE season={target}
            ) GROUP BY team
            """,
        )
    finally:
        con.close()

    rows = []
    for team, game_id in zip(sample["team"], sample["game_id"]):
        cache = raw_dir / f"game_{target}_{int(game_id)}.json"
        if cache.exists():
            detail = json.loads(cache.read_text(encoding="utf-8"))
        else:
            url = f"{cfg['api_base']}/games/{target}/{int(game_id)}"
            resp = requests.get(
                url,
                headers={"User-Agent": cfg["user_agent"], "Accept": "application/json"},
                timeout=cfg["request_timeout_seconds"],
            )
            resp.raise_for_status()
            detail = resp.json()
            cache.write_text(json.dumps(detail), encoding="utf-8")

        for side in ("homeTeamPlayers", "awayTeamPlayers"):
            for p in detail.get(side, []) or []:
                if p.get("teamName") != team:
                    continue
                rows.append(
                    {
                        "team": team,
                        "player_id": p.get("id"),
                        "first_name": p.get("firstName"),
                        "last_name": p.get("lastName"),
                        "position_group": _position_group(p.get("role")),
                        "date_of_birth": p.get("dateOfBirth"),
                        "source": "official",
                    }
                )
    return pd.DataFrame(rows).drop_duplicates(subset=["team", "player_id"])


def _apply_overrides(official: pd.DataFrame) -> pd.DataFrame:
    path = resolve_path(load_config()["paths"]["rosters_csv"])
    if not path.exists():
        return official
    ov = pd.read_csv(path, comment="#").fillna("")
    if ov.empty:
        return official

    roster = official.copy()
    for _, r in ov.iterrows():
        action = str(r.get("action", "add")).strip().lower() or "add"
        pid = r.get("player_id")
        name = str(r.get("name", "")).strip()
        team = str(r.get("team", "")).strip()

        def matches(df):
            if pid not in ("", None) and not pd.isna(pid):
                return df["player_id"] == int(pid)
            full = (df["first_name"].fillna("") + " " + df["last_name"].fillna("")).str.strip()
            return full.str.lower() == name.lower()

        if action == "remove":
            roster = roster[~matches(roster)]
        else:  # add / move: drop any existing entry for that player, then add
            roster = roster[~matches(roster)]
            first, _, last = name.partition(" ")
            roster = pd.concat(
                [
                    roster,
                    pd.DataFrame(
                        [
                            {
                                "team": team,
                                "player_id": int(pid) if str(pid).strip() not in ("", "nan") else None,
                                "first_name": first,
                                "last_name": last,
                                "position_group": str(r.get("position", "")).strip() or None,
                                "date_of_birth": None,
                                "source": "override",
                            }
                        ]
                    ),
                ],
                ignore_index=True,
            )
    return roster


def build_rosters() -> pd.DataFrame:
    """Official squads + CSV overrides -> roster_2026_27 table."""
    roster = _apply_overrides(_fetch_official_rosters())
    con = get_connection()
    try:
        register_df(con, "roster_2026_27", roster)
    finally:
        con.close()
    return roster


if __name__ == "__main__":
    r = build_rosters()
    print(f"{len(r)} roster rows across {r['team'].nunique()} teams")
