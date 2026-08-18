"""Goaltending model: per-goalie projected save% -> team defensive multiplier.

This is the defensive counterpart to the player offense model. Each goalie gets
a projected save% (recency-weighted, league-adjusted, regressed toward a prior),
goalies follow their 2026-27 team, and a team's goaltending becomes a multiplier
on goals-against:

    goalie_mult = (1 - team_save%) / (1 - league_avg_save%)

so a strong-goaltending team concedes fewer goals (mult < 1). This feeds the
Poisson defense in team_strength.combine_ratings (weighted by goalie_weight).
"""
from __future__ import annotations

import pandas as pd

from .config import load_config, resolve_path
from .db import get_connection, query_df, register_df

# canonical 2026-27 Liiga teams + aliases seen in scraped goalie club names
_TEAM_ALIASES = {
    "Ässät": ["ässät", "porin ässät"], "Sport": ["vaasan sport", "sport"],
    "K-Espoo": ["kiekko-espoo", "k-espoo"], "HIFK": ["hifk"], "HPK": ["hpk"],
    "Ilves": ["ilves"], "JYP": ["jyp"], "Jokerit": ["jokerit"],
    "Jukurit": ["jukurit"], "KalPa": ["kalpa"], "KooKoo": ["kookoo"],
    "Kärpät": ["kärpät", "karpat"], "Lukko": ["lukko"], "Pelicans": ["pelicans"],
    "SaiPa": ["saipa"], "TPS": ["tps"], "Tappara": ["tappara"],
}


def _canonical_team(club: str | None) -> str | None:
    if not club:
        return None
    c = str(club).lower()
    for canon, aliases in _TEAM_ALIASES.items():
        if any(a in c for a in aliases):
            return canon
    return None


def parse_goalie_seasons() -> pd.DataFrame:
    """Parse data/goalies_raw.txt into a DataFrame (no DB side effects)."""
    path = resolve_path("data/goalies_raw.txt")
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or "|" not in line:
            continue
        name, season, league, gp, sv, team = line.split("|")
        rows.append({"name": name, "season": int(season), "league": league,
                     "games": float(gp), "save_pct": float(sv), "team": team,
                     "canon_team": _canonical_team(team)})
    return pd.DataFrame(rows)


def load_goalie_seasons(con=None) -> pd.DataFrame:
    """Parse data/goalies_raw.txt and persist it as raw_goalie_seasons.

    Pass an existing connection to reuse it; otherwise one is opened and closed.
    """
    df = parse_goalie_seasons()
    own = con is None
    con = con or get_connection()
    try:
        register_df(con, "raw_goalie_seasons", df)
    finally:
        if own:
            con.close()
    return df


def compute_goalie_ratings(target_season: int | None = None,
                           seasons: pd.DataFrame | None = None) -> pd.DataFrame:
    """Projected save% per goalie, leakage-safe up to `target_season` (exclusive).
    recency + GP weighting, league-adjusted, regressed toward the prior."""
    cfg = load_config()
    g = cfg["goaltending"]
    decay = cfg["players"]["recency_decay"]
    target = target_season or cfg["ingestion"]["target_season"]
    lo = target - cfg["players"]["player_history_seasons"]
    prior, k = g["prior_save_pct"], g["regression_games"]
    offsets = g.get("league_save_offsets", {})

    s = seasons if seasons is not None else parse_goalie_seasons()
    s = s[(s["season"] >= lo) & (s["season"] < target)].copy()
    if s.empty:
        return pd.DataFrame(columns=["name", "proj_save_pct", "tot_games"])
    s["adj_sv"] = s["save_pct"] - s["league"].map(offsets).fillna(0.0)
    s["w"] = decay ** ((target - 1) - s["season"])
    s["wg"] = s["w"] * s["games"]

    rows = []
    for name, d in s.groupby("name"):
        wgames = d["wg"].sum()
        proj = (d["adj_sv"] * d["wg"]).sum()
        proj = (proj + k * prior) / (wgames + k)         # shrink toward prior
        rows.append({"name": name, "proj_save_pct": float(proj),
                     "tot_games": float(d["games"].sum())})
    return pd.DataFrame(rows)


def build_team_goaltending(con=None) -> pd.DataFrame:
    """Team goaltending multiplier for 2026-27, from rostered goalies'
    projected save% weighted by recent games played.

    Pass an existing connection to reuse it; otherwise one is opened and closed.
    """
    cfg = load_config()
    league_avg = cfg["goaltending"]["league_avg_save_pct"]
    own = con is None
    con = con or get_connection()
    try:
        seasons = parse_goalie_seasons()
        ratings = compute_goalie_ratings(seasons=seasons)
        roster = query_df(
            con,
            "SELECT team, first_name || ' ' || last_name AS name FROM roster_2026_27 "
            "WHERE position_group = 'G'",
        )
        # recent games per goalie = weight for who is the de-facto starter
        recent = (seasons[seasons["season"] >= cfg["ingestion"]["target_season"] - 2]
                  .groupby("name")["games"].sum().to_dict())
        r = roster.merge(ratings, on="name", how="left")
        r["wt"] = r["name"].map(recent).fillna(1.0)

        out = []
        for team, d in r.groupby("team"):
            dd = d.dropna(subset=["proj_save_pct"])
            if dd.empty:
                team_sv = league_avg                      # no data -> neutral
            else:
                team_sv = (dd["proj_save_pct"] * dd["wt"]).sum() / dd["wt"].sum()
            mult = (1 - team_sv) / (1 - league_avg)        # >1 = leakier than avg
            out.append({"team": team, "team_save_pct": float(team_sv),
                        "goalie_mult": float(mult)})
        ts = pd.DataFrame(out)
        register_df(con, "team_goaltending", ts)
    finally:
        if own:
            con.close()
    return ts


def team_goaltending_as_of(con, season: int) -> pd.DataFrame:
    """Backtest helper: each Liiga team's goaltending multiplier for `season`,
    using the goalies who actually played for them that season, rated only on
    prior-season data (leakage-free)."""
    cfg = load_config()
    league_avg = cfg["goaltending"]["league_avg_save_pct"]
    seasons = parse_goalie_seasons()
    ratings = compute_goalie_ratings(target_season=season, seasons=seasons)
    rmap = dict(zip(ratings["name"], ratings["proj_save_pct"]))

    # goalies who played a Liiga team that season (who to credit)
    cur = seasons[(seasons["season"] == season) & (seasons["league"] == "Liiga")
                  & seasons["canon_team"].notna()].copy()
    cur["wt"] = cur["games"]
    cur["proj"] = cur["name"].map(rmap)
    cur = cur.dropna(subset=["proj"])
    out = []
    for team, d in cur.groupby("canon_team"):
        team_sv = (d["proj"] * d["wt"]).sum() / d["wt"].sum()
        out.append({"team": team, "goalie_mult": (1 - team_sv) / (1 - league_avg)})
    return pd.DataFrame(out)


if __name__ == "__main__":
    ts = build_team_goaltending().sort_values("goalie_mult")
    print(ts.to_string(index=False))
