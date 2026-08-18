"""Per-player projected goal production for 2026-27.

Two parts:
1. compute_liiga_rates(): for every player with Liiga history, a projected
   goals-per-game built from their last N seasons with
     - recency weighting   (newer seasons matter more),
     - sample-size + regression-to-positional-mean shrinkage (steadies small
       samples), and
     - a light age curve    (projects toward/away from peak age).
   The unit is "goals per team-game": season goals / the team's games that
   season, which avoids needing per-player games-played counts.
2. build_player_rates(): assemble a final rate for every player on a 2026-27
   roster, preferring Liiga history, then external-league estimates, then a
   replacement-level positional prior (flagged as high uncertainty).
"""
from __future__ import annotations

import datetime as _dt

import numpy as np
import pandas as pd

from .config import load_config, resolve_path
from .db import get_connection, query_df, register_df
from .external import compute_external_rates


def _age_factor(birth_year, cfg) -> float:
    ac = cfg["players"]["age_curve"]
    if not ac.get("enabled") or birth_year is None or pd.isna(birth_year):
        return 1.0
    target = cfg["ingestion"]["target_season"]            # 2026-27 season
    age = target - int(birth_year)
    penalty = ac["per_year_falloff"] * abs(age - ac["peak_age"])
    cliff_age = ac.get("cliff_age")
    if cliff_age is not None and age > cliff_age:
        penalty += ac["cliff_per_year_falloff"] * (age - cliff_age)
    return float(max(0.5, 1.0 - penalty))


def _birth_year(dob) -> float | None:
    if dob is None or (isinstance(dob, float) and pd.isna(dob)) or dob == "":
        return None
    try:
        return int(str(dob)[:4])
    except (ValueError, TypeError):
        return None


def compute_liiga_rates(con=None) -> pd.DataFrame:
    own = con is None
    con = con or get_connection()
    cfg = load_config()
    target = cfg["ingestion"]["target_season"]
    n_hist = cfg["players"]["player_history_seasons"]
    decay = cfg["players"]["recency_decay"]
    k = cfg["players"]["regression_strength"]
    lo = target - n_hist                                   # inclusive lower season

    try:
        scoring = query_df(
            con,
            f"""
            SELECT s.player_id, s.season, s.first_name, s.last_name, s.team,
                   s.goals, s.points, s.team_games,
                   b.position_group, b.date_of_birth
            FROM player_season_scoring s
            LEFT JOIN player_bio b ON b.player_id = s.player_id
            WHERE s.season >= {lo} AND s.season < {target}
            """,
        )
    finally:
        if own:
            con.close()

    if scoring.empty:
        return pd.DataFrame()

    scoring["w"] = decay ** ((target - 1) - scoring["season"])
    scoring["wg"] = scoring["w"] * scoring["team_games"]   # recency-weighted games
    scoring["w_goals"] = scoring["w"] * scoring["goals"]
    scoring["w_points"] = scoring["w"] * scoring["points"]
    scoring["position_group"] = scoring["position_group"].fillna("F")

    # league positional mean rates (weighted) -> shrinkage targets
    pos = scoring.groupby("position_group").apply(
        lambda d: pd.Series(
            {
                "pos_goal_rate": d["w_goals"].sum() / d["wg"].sum(),
                "pos_point_rate": d["w_points"].sum() / d["wg"].sum(),
            }
        ),
        include_groups=False,
    )

    rows = []
    for pid, d in scoring.groupby("player_id"):
        posg = d["position_group"].iloc[-1]
        pg = pos.loc[posg]
        wg = d["wg"].sum()
        # shrink toward positional mean with k phantom games
        gpg = (d["w_goals"].sum() + k * pg["pos_goal_rate"]) / (wg + k)
        ppg = (d["w_points"].sum() + k * pg["pos_point_rate"]) / (wg + k)
        by = _birth_year(d["date_of_birth"].iloc[-1])
        af = _age_factor(by, cfg)
        last = d.sort_values("season").iloc[-1]
        rows.append(
            {
                "player_id": int(pid),
                "name": f"{last['first_name']} {last['last_name']}".strip(),
                "position_group": posg,
                "n_seasons": int(d["season"].nunique()),
                "projected_goals_per_game": float(gpg * af),
                "projected_points_per_game": float(ppg * af),
                "source": "liiga",
            }
        )
    rates = pd.DataFrame(rows)

    if own is False:
        register_df(con, "player_rates_liiga", rates)
    return rates


def _player_key(player_id, name) -> str:
    """Unified key: the Liiga player_id when known, else a normalised name.
    This lets a returnee's Liiga seasons and researched abroad seasons merge."""
    from .transfers import _norm
    if player_id is not None and not pd.isna(player_id) and str(player_id) not in ("", "nan"):
        return str(int(player_id))
    return "n:" + _norm(name)


def _load_league_factors() -> dict[str, float]:
    path = resolve_path(load_config()["paths"]["league_factors_csv"])
    f = pd.read_csv(path, comment="#")
    return dict(zip(f["league"], f["goals_factor"].astype(float)))


def assemble_player_seasons(con) -> pd.DataFrame:
    """Every player-season in the history window from BOTH sources:
      - Liiga goal events (authoritative; factor 1.0, games = team games),
      - researched external/abroad seasons (factor from league_factors.csv).
    Deduplicated by (key, season) preferring the Liiga row."""
    cfg = load_config()
    target = cfg["ingestion"]["target_season"]
    lo = target - cfg["players"]["player_history_seasons"]

    liiga = query_df(
        con,
        f"""SELECT s.player_id, s.season, s.goals, s.points, s.team_games AS games,
                   b.position_group, b.date_of_birth,
                   s.first_name || ' ' || s.last_name AS name
            FROM player_season_scoring s
            LEFT JOIN player_bio b ON b.player_id = s.player_id
            WHERE s.season >= {lo} AND s.season < {target}""",
    )
    liiga["factor"] = 1.0
    liiga["source"] = "liiga"
    liiga["birth_year"] = liiga["date_of_birth"].map(_birth_year)
    liiga["key"] = [
        _player_key(pid, nm) for pid, nm in zip(liiga["player_id"], liiga["name"])
    ]

    ext = pd.read_csv(resolve_path(cfg["paths"]["external_players_csv"]), comment="#")
    fac = _load_league_factors()
    ext = ext[(ext["season"] >= lo) & (ext["season"] < target)].copy()
    ext["points"] = ext["goals"].astype(float) + ext["assists"].fillna(0).astype(float)
    ext["factor"] = ext["league"].map(fac).fillna(0.30)
    ext["source"] = "external"
    ext["position_group"] = ext["position"].astype(str).str[:1].str.upper()
    ext["games"] = ext["games"].astype(float)
    ext["goals"] = ext["goals"].astype(float)
    ext["birth_year"] = pd.to_numeric(ext.get("birth_year"), errors="coerce")
    # Resolve external rows lacking a player_id to a Liiga id by name, so a
    # returnee's abroad rows merge with their Liiga seasons (vs staying orphaned).
    from .transfers import _norm
    name_to_id = {}
    for pid, nm in zip(liiga["player_id"], liiga["name"]):
        if pid is not None and not pd.isna(pid):
            name_to_id.setdefault(_norm(nm), int(pid))
    resolved = []
    for pid, nm in zip(ext["player_id"], ext["name"]):
        if pid is None or pd.isna(pid) or str(pid) in ("", "nan"):
            resolved.append(name_to_id.get(_norm(nm)))
        else:
            resolved.append(int(pid))
    ext["player_id"] = resolved
    ext["key"] = [
        _player_key(pid, nm) for pid, nm in zip(ext["player_id"], ext["name"])
    ]

    cols = ["key", "player_id", "name", "season", "goals", "points", "games",
            "factor", "position_group", "birth_year", "source"]
    alls = pd.concat([liiga[cols], ext[cols]], ignore_index=True)
    # prefer Liiga when a (player, season) exists in both
    alls["_pref"] = (alls["source"] == "liiga").astype(int)
    alls = (alls.sort_values("_pref", ascending=False)
                .drop_duplicates(subset=["key", "season"], keep="first")
                .drop(columns="_pref"))
    return alls


def compute_unified_rates(con) -> pd.DataFrame:
    """One recency-weighted, shrunk, age-adjusted rate per player across their
    combined Liiga + abroad seasons."""
    cfg = load_config()
    target = cfg["ingestion"]["target_season"]
    decay = cfg["players"]["recency_decay"]
    k = cfg["players"]["regression_strength"]

    s = assemble_player_seasons(con)
    s["position_group"] = s["position_group"].fillna("F").replace("", "F")
    s["w"] = decay ** ((target - 1) - s["season"])
    s["wg"] = s["w"] * s["games"]
    s["w_goals"] = s["w"] * s["goals"] * s["factor"]      # Liiga-equivalent goals
    s["w_points"] = s["w"] * s["points"] * s["factor"]

    # positional mean rates from Liiga seasons only (stable shrinkage targets)
    liiga_only = s[s["source"] == "liiga"]
    pos = liiga_only.groupby("position_group").apply(
        lambda d: pd.Series({"g": d["w_goals"].sum() / d["wg"].sum(),
                             "p": d["w_points"].sum() / d["wg"].sum()}),
        include_groups=False,
    )

    rows = []
    for key, d in s.groupby("key"):
        posg = d["position_group"].dropna().iloc[0] if d["position_group"].notna().any() else "F"
        pm = pos.loc[posg] if posg in pos.index else pos.mean()
        wg = d["wg"].sum()
        gpg = (d["w_goals"].sum() + k * pm["g"]) / (wg + k)
        ppg = (d["w_points"].sum() + k * pm["p"]) / (wg + k)
        by = d["birth_year"].dropna()
        af = _age_factor(int(by.max()) if len(by) else None, cfg)
        srcs = set(d["source"])
        mix = "blended" if srcs == {"liiga", "external"} else srcs.pop()
        pid = d["player_id"].dropna()
        rows.append(
            {
                "key": key,
                "player_id": int(pid.iloc[0]) if len(pid) else None,
                "name": d.sort_values("season")["name"].iloc[-1],
                "position_group": posg,
                "n_seasons": int(d["season"].nunique()),
                "projected_goals_per_game": float(gpg * af),
                "projected_points_per_game": float(ppg * af),
                "rate_source": mix,
            }
        )
    return pd.DataFrame(rows)


def _replacement_rates(rates: pd.DataFrame) -> dict[str, dict]:
    """Low-percentile positional rate for roster players with no data at all."""
    out = {}
    for posg, d in rates.groupby("position_group"):
        out[posg] = {
            "goals": float(d["projected_goals_per_game"].quantile(0.20)),
            "points": float(d["projected_points_per_game"].quantile(0.20)),
        }
    out.setdefault("G", {"goals": 0.0, "points": 0.02})
    return out


def build_player_rates() -> pd.DataFrame:
    """Final projected rate for every 2026-27 roster player, blending each
    player's Liiga and abroad seasons (returnees get their full 5-year picture).
    """
    con = get_connection()
    try:
        unified = compute_unified_rates(con)
        register_df(con, "player_rates_unified", unified)
        roster = query_df(con, "SELECT * FROM roster_2026_27")

        rates_by_key = unified.set_index("key").to_dict("index")
        repl = _replacement_rates(unified)

        out = []
        for _, p in roster.iterrows():
            pid = p["player_id"]
            posg = p["position_group"] or "F"
            name = f"{p.get('first_name') or ''} {p.get('last_name') or ''}".strip()
            key = _player_key(pid, name)
            if key in rates_by_key:
                r = rates_by_key[key]
                rate = (r["projected_goals_per_game"], r["projected_points_per_game"],
                        r["rate_source"])
            else:
                rp = repl.get(posg, repl.get("F"))
                rate = (rp["goals"], rp["points"], "replacement")
            out.append(
                {
                    "team": p["team"],
                    "player_id": None if pid is None or pd.isna(pid) else int(pid),
                    "name": name,
                    "position_group": posg,
                    "projected_goals_per_game": rate[0],
                    "projected_points_per_game": rate[1],
                    "rate_source": rate[2],
                }
            )
        rates = pd.DataFrame(out)
        register_df(con, "player_rates", rates)
    finally:
        con.close()
    return rates


if __name__ == "__main__":
    r = build_player_rates()
    print(r["rate_source"].value_counts().to_dict())
