"""Coverage sanity check for the 2026-27 roster's player-season history.

Flags two things after any roster/external-stats update:
  1. distribution of how many of the last `player_history_seasons` seasons
     each rostered player has data for (low counts are often fine — rookies,
     fresh imports — just context),
  2. STALE players: have >=1 season of history, but it stops before the most
     recently completed season. This is the dangerous case — it means the
     model is scoring them on outdated data instead of their actual current
     form, usually because they spent last season abroad (or on loan) and
     nobody backfilled that gap season into external_players.csv. This can
     happen even to players who are "already in the DB" from prior Liiga
     history -- having ANY history there is not proof the most recent season
     is present.

Run after every roster update (new signings, transfer batches):
    python scripts/check_roster_coverage.py
"""
from __future__ import annotations

from liiga.config import load_config
from liiga.db import get_connection, query_df
from liiga.players import assemble_player_seasons, _player_key


def main() -> None:
    cfg = load_config()
    target = cfg["ingestion"]["target_season"]
    latest_complete = target - 1

    con = get_connection()
    try:
        roster = query_df(
            con,
            "SELECT team, player_id, first_name, last_name, position_group "
            "FROM roster_2026_27",
        )
        seasons = assemble_player_seasons(con)
    finally:
        con.close()

    roster["name"] = roster["first_name"] + " " + roster["last_name"]
    roster["key"] = [
        _player_key(pid, nm) for pid, nm in zip(roster["player_id"], roster["name"])
    ]

    agg = seasons.groupby("key").agg(
        n_seasons=("season", "nunique"), max_season=("season", "max")
    )
    m = roster.merge(agg, on="key", how="left")
    m["n_seasons"] = m["n_seasons"].fillna(0).astype(int)

    print(f"roster size: {len(m)}")
    print()
    print("n_seasons distribution (out of a "
          f"{cfg['players']['player_history_seasons']}-season window):")
    print(m["n_seasons"].value_counts().sort_index().to_string())
    print()

    stale = m[(m["n_seasons"] > 0) & (m["max_season"] < latest_complete)]
    print(f"STALE players (have history, but nothing in season {latest_complete} "
          f"= last completed season): {len(stale)}")
    if len(stale):
        print(
            stale[["team", "name", "position_group", "n_seasons", "max_season"]]
            .sort_values("max_season")
            .to_string(index=False)
        )
        print()
        print("-> verify each: did they really not play a full season, or is a "
              "season abroad/on-loan missing from external_players.csv? "
              "Don't assume 'has Liiga history' means current -- check.")


if __name__ == "__main__":
    main()
