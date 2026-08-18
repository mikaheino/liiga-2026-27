"""IS Liigapörssi fantasy-team optimiser (SIDE PROJECT).

Self-contained. Reads the main project's DuckDB **read-only** to reuse its
player rate / goaltending projections, but never writes to it and is not part
of the standings pipeline. Nothing in ../src or ../scripts imports this.

    python fantasy/optimize.py                 # window mode (default)
    python fantasy/optimize.py --full-season   # 60-game season instead

Roster: 1 goalie + 3 forwards + 2 defencemen, budget 2,000,000 EUR.

Inputs (fantasy/data/):
  player_prices.csv     Name,Position,Price  (from the Liigapörssi player list)
  fixtures_window.txt   date|HomeA,AwayA|HomeB,AwayB|...   one line per game day

Scoring implemented from the official Liigapörssi table (see README.md).
"""
from __future__ import annotations

import argparse
import itertools
import re
import unicodedata
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import poisson

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
BUDGET = 2_000_000
FULL_SEASON_GAMES = 60

# ---------------------------------------------------------------- scoring ---
# Goalie save-count tiers -> points (official table).
SAVE_TIERS = [(4, 1), (9, 3), (14, 5), (19, 7), (24, 9), (29, 11),
              (34, 13), (39, 16), (44, 19), (49, 22), (54, 25), (59, 28)]
GOAL_PTS = {"F": 7, "D": 9}
ASSIST_PTS = {"F": 4, "D": 6}
WIN, LOSS, TIE, SHUTOUT = 4, -2, 1, 12
OT_SHARE = 0.23          # share of Liiga games decided after regulation


def save_points(n: float) -> int:
    n = int(round(n))
    if n <= 0:
        return 0
    for hi, pts in SAVE_TIERS:
        if n <= hi:
            return pts
    return 28 + 3 * ((n - 59 + 4) // 5)


def goals_against_points(k: int) -> int:
    """1..4 goals cost -1 each; every goal from the 5th on costs -2."""
    if k <= 0:
        return 0
    return -k if k <= 4 else -(4 + 2 * (k - 4))


# ------------------------------------------------------------ name mapping --
_ALIASES = {"nicholas zabaneh": "nick zabaneh", "matthew caito": "matt caito"}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", re.sub(r"[^a-z ]", " ", s.lower())).strip()


def flip_name(name: str) -> str:
    """Price list is 'Surname Firstname'; our DB is 'Firstname Surname'."""
    parts = name.split(" ")
    if len(parts) == 2:
        cand = norm(f"{parts[1]} {parts[0]}")
    elif len(parts) == 3:                       # multi-word surname, e.g. De Jong Ethan
        cand = norm(f"{parts[2]} {parts[0]} {parts[1]}")
    else:
        cand = norm(name)
    return _ALIASES.get(cand, cand)


# ------------------------------------------------------------------ inputs --
def load_fixtures() -> pd.DataFrame:
    counts: Counter = Counter()
    total = 0
    for line in (HERE / "data" / "fixtures_window.txt").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        for game in line.split("|")[1:]:
            home, away = game.split(",")
            counts[home] += 1
            counts[away] += 1
            total += 1
    print(f"fixtures: {total} games, {len(counts)} teams")
    return pd.DataFrame([{"team": t, "games": n} for t, n in counts.items()])


def load_projections():
    """Read the standings model's projections (READ-ONLY)."""
    import sys
    sys.path.insert(0, str(REPO / "src"))
    from liiga.db import get_connection, query_df          # noqa: E402
    from liiga.goalies import compute_goalie_ratings       # noqa: E402

    con = get_connection()
    try:
        skaters = query_df(con, """
            SELECT name, team, position_group,
                   projected_goals_per_game  AS g,
                   projected_points_per_game AS p,
                   rate_source
            FROM player_rates WHERE position_group IN ('F','D')""")
        goalie_roster = query_df(con, """
            SELECT team, first_name || ' ' || last_name AS name
            FROM roster_2026_27 WHERE position_group = 'G'""")
        strength = query_df(con, "SELECT * FROM team_strength")
        standings = query_df(con, "SELECT team, mean_points FROM standings_2026_27")
    finally:
        con.close()
    return skaters, goalie_roster, strength, standings, compute_goalie_ratings()


# ------------------------------------------------------- projection models --
def team_context(strength: pd.DataFrame, standings: pd.DataFrame) -> pd.DataFrame:
    t = strength.merge(standings, on="team")
    league_gf = 2.85
    t["xga"] = (league_gf
                * (t["def_rating"] / t["def_rating"].mean())
                * (t["goalie_mult"] / t["goalie_mult"].mean()))
    t["p_win"] = (t["mean_points"] / (3 * FULL_SEASON_GAMES)).clip(0.25, 0.72)
    return t


def goalie_points_per_game(xga: float, save_pct: float, p_win: float) -> float:
    shots = xga / (1 - save_pct)
    saves = shots - xga
    e_ga = sum(poisson.pmf(k, xga) * goals_against_points(k) for k in range(12))
    p_shutout = poisson.pmf(0, xga) * 0.85      # goalie changes forfeit the shutout
    wl = (WIN * p_win + LOSS * (1 - p_win)) * (1 - OT_SHARE) + TIE * OT_SHARE
    return save_points(saves) + e_ga + p_shutout * SHUTOUT + wl


def skater_points_per_game(row) -> float:
    """Goals/assists come from the model; the rest are position-level estimates
    (shots, blocks, plus-minus, stars, penalties) -- see README 'Assumptions'."""
    is_d = row["position_group"] == "D"
    core = GOAL_PTS["D" if is_d else "F"] * row["g"] + ASSIST_PTS["D" if is_d else "F"] * row["a"]
    q = np.clip(row["p"] / (0.45 if is_d else 0.55), 0.45, 1.7)   # usage proxy
    shots = (0.8 + 0.4 * q) if is_d else (0.9 + 0.6 * q)
    blocks = 1.4 if is_d else 0.5
    if is_d:
        pm = 3 * (1.15 * np.sqrt(q)) * row["off_rating"] - 2 * 1.20 * row["def_rating"]
    else:
        pm = 2 * (1.05 * np.sqrt(q)) * row["off_rating"] - 1 * 1.00 * row["def_rating"]
    stars = (0.18 if is_d else 0.25) * q
    return core + shots + blocks + pm + stars - 0.45


# ----------------------------------------------------------------- solving --
PRICE_UNIT = 5_000        # every price in the list is a multiple of this


def _knapsack(df, k):
    """Exact 'pick exactly k players' DP over the whole pool, indexed by budget."""
    max_u = BUDGET // PRICE_UNIT
    price_u = (df["price"].values // PRICE_UNIT).astype(int)
    val = df["fp"].values
    dp = np.full((k + 1, max_u + 1), -np.inf)
    dp[0, :] = 0.0
    par = np.full((k + 1, max_u + 1), -1, dtype=int)
    prev = np.full((k + 1, max_u + 1), -1, dtype=int)
    for i in range(len(df)):
        p = price_u[i]
        if p > max_u:
            continue
        for c in range(k, 0, -1):
            cand = dp[c - 1, :max_u + 1 - p] + val[i]
            tgt = dp[c, p:]
            better = cand > tgt
            if better.any():
                idx = np.nonzero(better)[0]
                dp[c, p + idx] = cand[idx]
                par[c, p + idx] = i
                prev[c, p + idx] = idx
    return dp, par, prev


def _backtrack(par, prev, k, budget_u):
    picks, c, b = [], k, budget_u
    while c > 0:
        picks.append(par[c, b])
        b = prev[c, b]
        c -= 1
    return picks


def best_lineup_exact(fwd, dfn, goalies):
    """Exact optimum over the FULL player pool (no truncation, no constraints).

    Uses a dynamic program per position, so cheap 'punt' picks that a top-N
    shortlist would discard are still considered.
    """
    f = fwd.reset_index(drop=True)
    d = dfn.reset_index(drop=True)
    dpf, parf, prevf = _knapsack(f, 3)
    dpd, pard, prevd = _knapsack(d, 2)

    def running_max(row):
        best_v, best_i = -np.inf, 0
        out_v, out_i = np.empty_like(row), np.zeros(len(row), dtype=int)
        for b in range(len(row)):
            if row[b] > best_v:
                best_v, best_i = row[b], b
            out_v[b], out_i[b] = best_v, best_i
        return out_v, out_i

    f_best, f_arg = running_max(dpf[3])
    d_best, d_arg = running_max(dpd[2])

    best = None
    for _, gr in goalies.iterrows():
        rem_u = (BUDGET - int(gr["price"])) // PRICE_UNIT
        if rem_u < 0:
            continue
        for bf in range(rem_u + 1):
            total = gr["fp"] + f_best[bf] + d_best[rem_u - bf]
            if best is None or total > best[0]:
                best = (total, gr, f_arg[bf], d_arg[rem_u - bf])
    total, gr, fb, db = best
    fi = _backtrack(parf, prevf, 3, fb)
    di = _backtrack(pard, prevd, 2, db)
    price = int(f.loc[fi, "price"].sum() + d.loc[di, "price"].sum() + gr["price"])
    return (total, price, gr, f.loc[fi], d.loc[di])


def best_lineup(fwd, dfn, goalies, price_band=None, max_per_team=None, pool=(40, 35, 9)):
    """Exhaustive search over the top-N pools (defence side vectorised).

    Returns (total_points, total_price, goalie_row, forwards_df, defence_df).
    """
    f = fwd.nlargest(pool[0], "fp").reset_index(drop=True)
    d = dfn.nlargest(pool[1], "fp").reset_index(drop=True)
    g = goalies.nlargest(pool[2], "fp").reset_index(drop=True)

    # pre-compute every defence pair once
    dcomb = list(itertools.combinations(range(len(d)), 2))
    dpr = d["price"].values
    dfp = d["fp"].values
    d_price = np.array([dpr[list(c)].sum() for c in dcomb])
    d_val = np.array([dfp[list(c)].sum() for c in dcomb])
    d_min = np.array([dpr[list(c)].min() for c in dcomb])
    d_max = np.array([dpr[list(c)].max() for c in dcomb])
    d_teams = [tuple(d["team"].values[i] for i in c) for c in dcomb]

    best = None
    for _, gr in g.iterrows():
        remaining = BUDGET - gr["price"]
        for fi in itertools.combinations(range(len(f)), 3):
            fpr = f["price"].values[list(fi)]
            if fpr.sum() > remaining:
                continue
            teams_gf = [gr["team"]] + [f["team"].values[i] for i in fi]
            if max_per_team and max(Counter(teams_gf).values()) > max_per_team:
                continue

            ok = d_price <= remaining - fpr.sum()
            if price_band:
                lo = min(fpr.min(), gr["price"])
                hi = max(fpr.max(), gr["price"])
                ok &= (np.minimum(d_min, lo) >= np.maximum(d_max, hi) - price_band)
            idx = np.nonzero(ok)[0]
            if idx.size == 0:
                continue

            fval = f["fp"].values[list(fi)].sum()
            order = idx[np.argsort(-d_val[idx])]
            for j in order:                       # best-first; team cap rarely bites
                if max_per_team:
                    if max(Counter(teams_gf + list(d_teams[j])).values()) > max_per_team:
                        continue
                total = gr["fp"] + fval + d_val[j]
                if best is None or total > best[0]:
                    best = (total, int(fpr.sum() + d_price[j] + gr["price"]),
                            gr, f.loc[list(fi)], d.loc[list(dcomb[j])])
                break                             # first feasible pair is the best one
    return best


def show(label, best):
    if not best:
        print(f"\n{label}: no feasible lineup")
        return
    total, price, g, f, d = best
    print(f"\n{label}  ->  {total:.0f} FP | {price:,} EUR")
    print(f"  G  {g['Name']:<20} {g['team']:<9} {int(g['price']):>7,}  "
          f"{g['games']:.0f}gm ~{g['exp_starts']:.1f} starts  {g['fp']:.0f} FP")
    for _, r in f.iterrows():
        print(f"  F  {r['Name']:<20} {r['team']:<9} {int(r['price']):>7,}  "
              f"{r['games']:.0f}gm  {r['fp']:.0f} FP")
    for _, r in d.iterrows():
        print(f"  D  {r['Name']:<20} {r['team']:<9} {int(r['price']):>7,}  "
              f"{r['games']:.0f}gm  {r['fp']:.0f} FP")
    cap = pd.concat([f, d]).nlargest(1, "fp").iloc[0]
    cap_name, cap_fp = (g["Name"], g["fp"]) if g["fp"] > cap["fp"] else (cap["Name"], cap["fp"])
    print(f"  CAPTAIN: {cap_name} (1.3x on ~{cap_fp:.0f} FP -> +{0.3*cap_fp:.0f})")


# --- expected share of team games each goalie starts (judgement + workload) ---
STARTER_SHARE = {
    "Bartosak Patrik": .83, "Heljanko Christian": .70, "Rimpinen Petteri": .68,
    "Bednar Jan": .70, "Lekkas Stefanos": .67, "Rubin Niklas": .60,
    "Randelin Eetu": .57, "Vehviläinen Veini": .55, "Ortio Joni": .53,
    "Mäkiniemi Eetu": .50, "Piiroinen Kari": .50, "Raanta Antti": .50,
    "Salminen Oskari": .50, "Myrenberg Jesper": .50, "Crespin Jakob": .50,
    "Armalis Mantas": .50, "Juel Tim": .45, "Grigals Gustavs": .47,
    "Rifalk Christoffer": .47, "Härkönen Masi": .40, "Alnefelt Hugo": .40,
    "Väyrynen Max": .43, "Patrikainen Jasper": .40, "Eriksson Ek Olle": .37,
    "Vedenpää Visa": .33, "Vali Noa": .30, "Metsola Juha": .30,
    "Salonen Daniel": .37, "Herpin Matthieu": .37, "Setänen Oskari": .37,
    "Korhonen Rasmus": .30, "Taponen Roope": .27, "Rajaniemi Sami": .30,
    "Niittymäki Aatu": .23, "Ruusu Markus": .20, "Olkinuora Jussi": .20,
    "Hannikainen Otto": .20, "Karjalainen Aleksi": .17, "Elias Rastislav": .23,
    "Hiltunen Ville-Veikko": .17, "Kolehmainen Ville": .17, "Selin Lukas": .13,
    "Lammi Pyry": .10, "Poletin Frantisek": .10, "Saarinen Kim": .0,
}
MIN_STARTER_SHARE = 0.50


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--full-season", action="store_true",
                    help="ignore the fixture window and project a 60-game season")
    args = ap.parse_args()

    prices = pd.read_csv(HERE / "data" / "player_prices.csv")
    prices["price"] = (prices["Price"].str.replace("€", "", regex=False)
                       .str.replace(" ", "", regex=False).astype(int))
    prices["norm"] = prices["Name"].map(flip_name)

    skaters, goalie_roster, strength, standings, gratings = load_projections()
    ctx = team_context(strength, standings)
    fixtures = load_fixtures()
    if args.full_season:
        fixtures["games"] = FULL_SEASON_GAMES

    # ---- skaters
    skaters["norm"] = skaters["name"].map(norm)
    sk = prices[prices["Position"] != "Goalie"].merge(
        skaters[["norm", "g", "p", "position_group"]], on="norm", how="left")
    sk = sk.merge(skaters[["norm", "team"]], on="norm", how="left")
    for pos, pg in (("Forward", "F"), ("Defense", "D")):
        miss = (sk["Position"] == pos) & sk["g"].isna()
        sk.loc[miss, "g"] = skaters.loc[skaters["position_group"] == pg, "g"].quantile(.20)
        sk.loc[miss, "p"] = skaters.loc[skaters["position_group"] == pg, "p"].quantile(.20)
        sk.loc[miss, "position_group"] = pg
    sk = sk.merge(ctx[["team", "off_rating", "def_rating"]], on="team", how="left")
    for c in ("off_rating", "def_rating"):
        sk[c] = sk[c].fillna(sk[c].mean())
    sk["a"] = (sk["p"] - sk["g"]).clip(lower=0)
    sk["ppg"] = sk.apply(skater_points_per_game, axis=1)
    sk = sk.merge(fixtures, on="team", how="left")
    sk["games"] = sk["games"].fillna(fixtures["games"].median())
    sk["fp"] = sk["ppg"] * sk["games"]

    # ---- goalies
    goalie_roster["norm"] = goalie_roster["name"].map(norm)
    gratings["norm"] = gratings["name"].map(norm)
    gl = prices[prices["Position"] == "Goalie"].merge(goalie_roster[["norm", "team"]],
                                                      on="norm", how="left")
    gl = gl.merge(gratings[["norm", "proj_save_pct"]], on="norm", how="left")
    gl["proj_save_pct"] = gl["proj_save_pct"].fillna(0.903)
    gl = gl.merge(ctx[["team", "xga", "p_win"]], on="team", how="left").dropna(subset=["team"])
    gl = gl.merge(fixtures, on="team", how="left")
    gl["share"] = gl["Name"].map(STARTER_SHARE).fillna(0.25)
    gl["exp_starts"] = gl["share"] * gl["games"]
    gl["ppg"] = gl.apply(lambda r: goalie_points_per_game(r["xga"], r["proj_save_pct"],
                                                          r["p_win"]), axis=1)
    gl["fp"] = gl["ppg"] * gl["exp_starts"]
    starters = gl[gl["share"] >= MIN_STARTER_SHARE]

    mode = "FULL SEASON" if args.full_season else "FIXTURE WINDOW"
    print(f"\n===== Liigaporssi optimiser -- {mode} =====")
    print("\nGames available per team:")
    print(fixtures.sort_values("games", ascending=False).to_string(index=False))

    fwd = sk[sk["Position"] == "Forward"]
    dfn = sk[sk["Position"] == "Defense"]
    show("MAX POINTS (exact, full pool)", best_lineup_exact(fwd, dfn, starters))
    show("EVEN SPREAD (price band 100k)", best_lineup(fwd, dfn, starters, price_band=100_000))
    show("EVEN SPREAD + max 2 per club",
         best_lineup(fwd, dfn, starters, price_band=100_000, max_per_team=2,
                     pool=(22, 18, 6)))


if __name__ == "__main__":
    main()
