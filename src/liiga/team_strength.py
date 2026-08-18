"""Turn rosters of player rates into team offensive/defensive ratings.

Offense is built bottom-up from the roster's player goal rates (the heart of the
model). Defense and a slice of offense come from team history, mixed in only by
`team_weight` (default low). New teams with no history (Jokerit) fall back to the
neutral league average, so they are judged purely on their players.

Ratings are multiplicative and centred on ~1.0, feeding a Poisson matchup:
    lambda_home = league_avg * off_home * def_away * home_ice
    lambda_away = league_avg * off_away * def_home
"""
from __future__ import annotations

import pandas as pd

from .config import load_config
from .db import get_connection, query_df, register_df
from .goalies import build_team_goaltending


def team_offense_from_players(player_rates: pd.DataFrame, top_skaters: int,
                              league_avg: float) -> pd.DataFrame:
    """Sum each team's top-N skater goal rates, then normalise so the league
    averages to `league_avg` goals/game. Returns team -> off_player rating."""
    skaters = player_rates[player_rates["position_group"] != "G"].copy()
    skaters = skaters.sort_values("projected_goals_per_game", ascending=False)
    topn = skaters.groupby("team").head(top_skaters)
    raw = topn.groupby("team")["projected_goals_per_game"].sum().rename("raw_gf")

    # Pad teams whose published roster has fewer than `top_skaters` skaters
    # (offseason incompleteness) with a replacement-level rate, so they are
    # evaluated over the same number of slots as everyone else.
    replacement = float(skaters["projected_goals_per_game"].quantile(0.15))
    counts = topn.groupby("team").size()
    raw = raw + (top_skaters - counts).clip(lower=0) * replacement

    scale = league_avg / raw.mean()
    exp_gf = raw * scale
    return pd.DataFrame(
        {"team": raw.index, "exp_gf_player": exp_gf.values,
         "off_player": (exp_gf / league_avg).values}
    )


def team_history_ratings(con, before_season: int, n_seasons: int,
                         decay: float) -> pd.DataFrame:
    """Recency-weighted GF/GA per game for each team over the n seasons before
    `before_season`, expressed relative to the league average (1.0 = average).
    Teams with no history are simply absent (callers default them to 1.0)."""
    lo = before_season - n_seasons
    ts = query_df(
        con,
        f"""SELECT team, season, games_played, goals_for, goals_against
            FROM team_season
            WHERE season >= {lo} AND season < {before_season}""",
    )
    if ts.empty:
        return pd.DataFrame(columns=["team", "off_history", "def_history"])
    ts["w"] = decay ** ((before_season - 1) - ts["season"])
    agg = ts.groupby("team").apply(
        lambda d: pd.Series(
            {
                "gf_pg": (d["goals_for"] * d["w"]).sum() / (d["games_played"] * d["w"]).sum(),
                "ga_pg": (d["goals_against"] * d["w"]).sum() / (d["games_played"] * d["w"]).sum(),
            }
        ),
        include_groups=False,
    )
    league_gf = agg["gf_pg"].mean()
    league_ga = agg["ga_pg"].mean()
    return pd.DataFrame(
        {
            "team": agg.index,
            "off_history": (agg["gf_pg"] / league_gf).values,
            "def_history": (agg["ga_pg"] / league_ga).values,   # >1 = leakier defense
        }
    )


def team_continuity(con, target_season: int, top_n: int = 18) -> pd.DataFrame:
    """Roster continuity for target_season: % of each team's top-N scorers
    from the previous season still on the same team's current roster.

    Uses roster_2026_27 for the current-season roster (authoritative for the
    target prediction). Returns team, continuity_score (0–1), n_retained, n_checked.
    """
    prev = query_df(
        con,
        f"""SELECT team, player_id, points_per_team_game
            FROM player_season_scoring WHERE season = {target_season - 1}""",
    )
    if prev.empty:
        return pd.DataFrame(columns=["team", "continuity_score"])
    top = (prev.sort_values("points_per_team_game", ascending=False)
               .groupby("team").head(top_n))
    roster = query_df(con, "SELECT team, player_id FROM roster_2026_27")
    cur_by_team = roster.groupby("team")["player_id"].apply(set).to_dict()
    rows = []
    for team, grp in top.groupby("team"):
        prev_ids = set(grp["player_id"])
        retained = len(prev_ids & cur_by_team.get(team, set()))
        rows.append({"team": team, "continuity_score": retained / len(prev_ids),
                     "n_retained": retained, "n_checked": len(prev_ids)})
    return pd.DataFrame(rows)


def team_continuity_as_of(con, season: int, top_n: int = 18) -> pd.DataFrame:
    """Leakage-free roster continuity for a backtest season.

    Uses player_season_scoring as a proxy for the pre-season roster (players
    who scored in season S approximate the opening-day lineup). Note: this
    slightly overstates continuity since mid-season trades are included, but
    it is the cleanest available signal without a historical roster table.
    """
    prev = query_df(
        con,
        f"""SELECT team, player_id, points_per_team_game
            FROM player_season_scoring WHERE season = {season - 1}""",
    )
    curr = query_df(
        con,
        f"SELECT team, player_id FROM player_season_scoring WHERE season = {season}",
    )
    if prev.empty or curr.empty:
        return pd.DataFrame(columns=["team", "continuity_score"])
    top = (prev.sort_values("points_per_team_game", ascending=False)
               .groupby("team").head(top_n))
    cur_by_team = curr.groupby("team")["player_id"].apply(set).to_dict()
    rows = []
    for team, grp in top.groupby("team"):
        prev_ids = set(grp["player_id"])
        retained = len(prev_ids & cur_by_team.get(team, set()))
        rows.append({"team": team, "continuity_score": retained / len(prev_ids),
                     "n_retained": retained, "n_checked": len(prev_ids)})
    return pd.DataFrame(rows)


def combine_ratings(off_player: pd.DataFrame, history: pd.DataFrame,
                    team_weight: float, goaltending: pd.DataFrame | None = None,
                    goalie_weight: float = 0.70,
                    continuity: pd.DataFrame | None = None,
                    continuity_shrinkage: float = 0.0) -> pd.DataFrame:
    """Blend player-derived offense with team history, and build defense from
    GOALTENDING (a team's goalie save% multiplier) blended with team shot-
    suppression history. Offense uses team_weight; defense uses goalie_weight.

    continuity_shrinkage (0–1): how much to shrink off_rating toward the league
    average (1.0) for low-continuity teams. 0 = disabled, 1 = full shrink to
    league average when the team retained none of last season's top scorers.
    """
    df = off_player.merge(history, on="team", how="left")
    df["off_history"] = df["off_history"].fillna(1.0)
    df["def_history"] = df["def_history"].fillna(1.0)
    if goaltending is not None and not goaltending.empty:
        df = df.merge(goaltending[["team", "goalie_mult"]], on="team", how="left")
    if "goalie_mult" not in df:
        df["goalie_mult"] = 1.0
    df["goalie_mult"] = df["goalie_mult"].fillna(1.0)

    tw, gw = team_weight, goalie_weight
    df["off_rating"] = (1 - tw) * df["off_player"] + tw * df["off_history"]
    # defense: goaltending (primary) blended with team shot-suppression history
    df["def_rating"] = gw * df["goalie_mult"] + (1 - gw) * df["def_history"]

    # continuity: shrink off_rating toward 1.0 for high-turnover teams
    if continuity is not None and not continuity.empty and continuity_shrinkage > 0:
        df = df.merge(continuity[["team", "continuity_score"]], on="team", how="left")
        df["continuity_score"] = df["continuity_score"].fillna(0.5)
        alpha = 1.0 - (1.0 - df["continuity_score"]) * continuity_shrinkage
        df["off_rating"] = 1.0 + alpha * (df["off_rating"] - 1.0)
    elif "continuity_score" not in df.columns:
        df["continuity_score"] = float("nan")

    return df[["team", "off_rating", "def_rating", "exp_gf_player",
               "goalie_mult", "continuity_score"]]


def build_team_strength() -> pd.DataFrame:
    """Team ratings for the 2026-27 target season -> team_strength table."""
    cfg = load_config()
    tcfg = cfg["team_strength"]
    target = cfg["ingestion"]["target_season"]
    con = get_connection()
    try:
        player_rates = query_df(con, "SELECT * FROM player_rates")
        off_player = team_offense_from_players(
            player_rates, tcfg["top_skaters"], tcfg["league_avg_goals_per_game"]
        )
        history = team_history_ratings(
            con, target, cfg["players"]["player_history_seasons"],
            cfg["players"]["recency_decay"]
        )
        goaltending = build_team_goaltending(con)        # def_rating driver
        continuity = team_continuity(con, target)
        ratings = combine_ratings(
            off_player, history, tcfg["team_weight"],
            goaltending=goaltending, goalie_weight=tcfg["goalie_weight"],
            continuity=continuity,
            continuity_shrinkage=tcfg.get("continuity_shrinkage", 0.0),
        )
        register_df(con, "team_strength", ratings)
    finally:
        con.close()
    return ratings


if __name__ == "__main__":
    r = build_team_strength().sort_values("off_rating", ascending=False)
    print(r.to_string(index=False))
