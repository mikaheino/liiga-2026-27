"""A/B: champion (prediction_games) vs challenger (prediction_games_challenger).

Scores both on the SAME games -- those played after the challenger's first
snapshot -- using each table's last snapshot before game day, as in
docs/model_improvements_in_season.md. Reports the paired log-loss difference
with its standard error; negative = challenger better.

    python scripts/dev/ab_report.py
"""
from __future__ import annotations

import numpy as np

from liiga.config import load_config
from liiga.db import get_connection, query_df

_SQL = """
SELECT g.game_id, g.home_win, g.home_goals, g.away_goals, g.result_category,
       p.p_home_win, p.p_home_reg, p.p_away_reg, p.p_overtime
FROM stg_games g
JOIN {table} p ON p.game_id = g.game_id
WHERE g.season = {season} AND g.ended
  AND SUBSTR(g.start_ts, 1, 10) > '{start}'
  AND p.snapshot_date = (SELECT MAX(snapshot_date) FROM {table} p2
                         WHERE p2.game_id = g.game_id
                           AND p2.snapshot_date < SUBSTR(g.start_ts, 1, 10))
"""


def _loglosses(df):
    eps = 1e-12
    y = df["home_win"].astype(float).to_numpy()
    p = np.clip(df["p_home_win"].to_numpy(), eps, 1 - eps)
    ot = df["result_category"].isin(["overtime", "shootout"]).to_numpy()
    home = (df["home_goals"] > df["away_goals"]).to_numpy()
    p3 = np.where(ot, df["p_overtime"], np.where(home, df["p_home_reg"], df["p_away_reg"]))
    return -(y * np.log(p) + (1 - y) * np.log(1 - p)), -np.log(np.clip(p3, eps, 1))


def main() -> None:
    season = load_config()["ingestion"]["target_season"]
    con = get_connection()
    try:
        start = query_df(con, "SELECT MIN(snapshot_date) AS d FROM prediction_games_challenger")["d"].iloc[0]
        a = query_df(con, _SQL.format(table="prediction_games", season=season, start=start))
        b = query_df(con, _SQL.format(table="prediction_games_challenger", season=season, start=start))
    finally:
        con.close()
    m = a.merge(b[["game_id", "p_home_win", "p_home_reg", "p_away_reg", "p_overtime"]],
                on="game_id", suffixes=("", "_b"))
    print(f"A/B since {start}: {len(m)} games scored by both models")
    if m.empty:
        return
    la2, la3 = _loglosses(m)
    mb = m.drop(columns=["p_home_win", "p_home_reg", "p_away_reg", "p_overtime"])
    mb.columns = [c.removesuffix("_b") for c in mb.columns]
    lb2, lb3 = _loglosses(mb)
    for name, la, lb in (("2-way (home win)", la2, lb2), ("3-way (H/OT/A)", la3, lb3)):
        d = lb - la
        se = d.std(ddof=1) / np.sqrt(len(d)) if len(d) > 1 else float("nan")
        print(f"{name:17s} champion {la.mean():.4f}  challenger {lb.mean():.4f}  "
              f"diff {d.mean():+.4f} ± {se:.4f} (SE)")
    print("Backtest expectation 2023-26: diff about -0.002 (2-way) / -0.003 (3-way).")


if __name__ == "__main__":
    main()
