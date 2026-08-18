"""Liiga-equivalent rates for players coming from OTHER leagues.

For players without Liiga history (Jokerit's Mestis men, imports, returnees) we
read their prior-league stats from data/external_players.csv and translate the
scoring rate into a Liiga-equivalent goals-per-game using the multipliers in
data/league_factors.csv. Multiple prior seasons are combined with the same
recency weighting used for Liiga players.
"""
from __future__ import annotations

import pandas as pd

from .config import load_config, resolve_path


def _read_csv(path_key: str) -> pd.DataFrame:
    path = resolve_path(load_config()["paths"][path_key])
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path, comment="#")


def compute_external_rates() -> pd.DataFrame:
    """Return one row per external player with a Liiga-equivalent rate."""
    ext = _read_csv("external_players_csv")
    factors = _read_csv("league_factors_csv")
    if ext.empty:
        return pd.DataFrame(
            columns=["player_id", "name", "position_group",
                     "projected_goals_per_game", "projected_points_per_game", "source"]
        )

    fmap = dict(zip(factors["league"], factors["goals_factor"]))
    cfg = load_config()
    target = cfg["ingestion"]["target_season"]
    decay = cfg["players"]["recency_decay"]

    ext = ext.copy()
    ext["factor"] = ext["league"].map(fmap).fillna(1.0).astype(float)
    ext["w"] = decay ** ((target - 1) - ext["season"].astype(int))
    ext["games"] = ext["games"].astype(float)
    ext["goals"] = ext["goals"].astype(float)
    ext["assists"] = ext.get("assists", 0).astype(float)

    rows = []
    # key on player_id when present, else fall back to name
    pid_str = ext["player_id"].astype("string").fillna("").str.replace(r"\.0$", "", regex=True)
    ext["_key"] = pid_str.where(pid_str != "", ext["name"].astype(str))
    for _, grp in ext.groupby("_key"):
        wg = grp["w"] * grp["games"]
        # Liiga-equivalent per-game rate = (league rate * factor), game-weighted.
        eq_goals_rate = (grp["goals"] / grp["games"]) * grp["factor"]
        eq_pts_rate = ((grp["goals"] + grp["assists"]) / grp["games"]) * grp["factor"]
        gpg = float((eq_goals_rate * wg).sum() / wg.sum())
        ppg = float((eq_pts_rate * wg).sum() / wg.sum())
        first = grp.iloc[0]
        pid = first["player_id"]
        rows.append(
            {
                "player_id": int(pid) if str(pid) not in ("", "<NA>", "nan") else None,
                "name": str(first["name"]),
                "position_group": (str(first["position"]).strip()[:1].upper()
                                   if "position" in grp.columns and str(first["position"]) != "<NA>" else None),
                "projected_goals_per_game": gpg,
                "projected_points_per_game": ppg,
                "source": "external",
            }
        )
    return pd.DataFrame(rows)
