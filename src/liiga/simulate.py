"""Monte Carlo simulation of the 2026-27 regular season.

We take each scheduled game's outcome probabilities (from the Poisson model),
play the whole season thousands of times sampling each result, award Liiga
points (3/2/1/0), and tally the final tables. The output is a distribution:
expected points, the chance each team finishes in each position, the title odds,
and playoff probability.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .config import load_config
from .db import get_connection, query_df
from .model import predict_games, calibrate_ties, historical_ot_rate


def _schedule_and_ratings(con):
    cfg = load_config()
    target = cfg["ingestion"]["target_season"]
    schedule = query_df(
        con,
        f"""SELECT game_id, home_team, away_team
            FROM stg_games WHERE season = {target}""",
    )
    ratings = query_df(con, "SELECT * FROM team_strength")
    return schedule, ratings, cfg


def banked_points(con, season: int) -> dict[str, float]:
    """Actual Liiga points already earned in `season`'s completed games.
    Used mid-season: banked points + simulated remaining games = final table."""
    played = query_df(
        con,
        f"""SELECT home_team, away_team, home_win, result_category
            FROM stg_games WHERE season = {season} AND ended""",
    )
    cfg = load_config()
    p = cfg["simulation"]["points"]
    pts: dict[str, float] = {}
    for _, g in played.iterrows():
        ot = str(g["result_category"]) in ("overtime", "shootout")
        h, a = g["home_team"], g["away_team"]
        if int(g["home_win"]):
            hw, lw = (p["overtime_win"], p["overtime_loss"]) if ot else (p["regulation_win"], p["regulation_loss"])
            pts[h] = pts.get(h, 0.0) + hw
            pts[a] = pts.get(a, 0.0) + lw
        else:
            hw, lw = (p["overtime_loss"], p["overtime_win"]) if ot else (p["regulation_loss"], p["regulation_win"])
            pts[h] = pts.get(h, 0.0) + hw
            pts[a] = pts.get(a, 0.0) + lw
    return pts


def simulate(con=None, pred: pd.DataFrame | None = None,
             base_points: dict[str, float] | None = None) -> dict:
    """Run Monte Carlo simulation.

    If `pred` is provided (a DataFrame already containing per-game outcome
    probabilities from e.g. the ensemble model), it is used directly and the
    internal predict_games call is skipped. The connection is still used only
    to read the season schedule when pred is None.

    `base_points` (mid-season): actual points already banked per team; every
    simulation starts from these totals and only the games in `pred` are played.
    """
    own = con is None
    con = con or get_connection()
    try:
        schedule, ratings, cfg = _schedule_and_ratings(con)
        if pred is None:
            pred = predict_games(schedule, ratings, cfg)
            if cfg["match_model"].get("tie_calibration", True):
                target = cfg["ingestion"]["target_season"]
                pred = calibrate_ties(pred, historical_ot_rate(con, target))
    finally:
        if own:
            con.close()

    sim = cfg["simulation"]
    pts = sim["points"]
    n = sim["n_simulations"]
    rng = np.random.default_rng(sim["random_seed"])

    base_points = base_points or {}
    if len(pred) == 0:   # season fully played: table = banked points only
        pred = pd.DataFrame(columns=["home_team", "away_team", "p_home_reg",
                                     "p_overtime", "p_home_ot_win"])
    teams = sorted(set(pred["home_team"]) | set(pred["away_team"]) | set(base_points))
    idx = {t: i for i, t in enumerate(teams)}
    n_teams = len(teams)

    points = np.zeros((n, n_teams), dtype=np.float64)
    for t, b in base_points.items():
        points[:, idx[t]] += b

    hi = pred["home_team"].map(idx).to_numpy()
    ai = pred["away_team"].map(idx).to_numpy()
    a = pred["p_home_reg"].to_numpy()                 # home regulation win
    o = pred["p_overtime"].to_numpy()                 # tie -> OT
    h_ot = pred["p_home_ot_win"].to_numpy()           # home wins the OT

    for g in range(len(pred)):
        u = rng.random(n)
        home_reg = u < a[g]
        overtime = (u >= a[g]) & (u < a[g] + o[g])
        away_reg = u >= a[g] + o[g]
        home_ot_win = overtime & (rng.random(n) < h_ot[g])
        away_ot_win = overtime & ~home_ot_win

        points[home_reg, hi[g]] += pts["regulation_win"]
        points[away_reg, hi[g]] += pts["regulation_loss"]
        points[home_ot_win, hi[g]] += pts["overtime_win"]
        points[away_ot_win, hi[g]] += pts["overtime_loss"]

        points[away_reg, ai[g]] += pts["regulation_win"]
        points[home_reg, ai[g]] += pts["regulation_loss"]
        points[away_ot_win, ai[g]] += pts["overtime_win"]
        points[home_ot_win, ai[g]] += pts["overtime_loss"]

    # rank within each simulation (1 = best). tiny noise breaks point ties fairly.
    jitter = rng.random((n, n_teams)) * 1e-6
    order = np.argsort(-(points + jitter), axis=1)
    ranks = np.empty_like(order)
    rows = np.arange(n)[:, None]
    ranks[rows, order] = np.arange(1, n_teams + 1)

    cutoff = sim["playoff_cutoff_rank"]
    standings = pd.DataFrame(
        {
            "team": teams,
            "mean_points": points.mean(axis=0),
            "p05_points": np.percentile(points, 5, axis=0),
            "p95_points": np.percentile(points, 95, axis=0),
            "p_title": (ranks == 1).mean(axis=0),
            "p_top_playoff": (ranks <= cutoff).mean(axis=0),
            "mean_rank": ranks.mean(axis=0),
        }
    ).sort_values("mean_points", ascending=False).reset_index(drop=True)
    standings.insert(0, "proj_rank", np.arange(1, n_teams + 1))

    # full position distribution: P(team finishes in rank r)
    pos = np.zeros((n_teams, n_teams))
    for t in range(n_teams):
        counts = np.bincount(ranks[:, t], minlength=n_teams + 1)[1:]
        pos[t] = counts / n
    pos_df = pd.DataFrame(pos, index=teams, columns=range(1, n_teams + 1))

    return {"standings": standings, "position_distribution": pos_df, "predictions": pred}


if __name__ == "__main__":
    res = simulate()
    pd.set_option("display.float_format", lambda x: f"{x:.2f}")
    print(res["standings"].to_string(index=False))
