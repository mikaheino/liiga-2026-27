"""Kotiedun historiatesti (docs/model_improvement_ideas.md, kohta 2.1).

Kysymys: onko mallin kotietu liian pieni? Tällä kaudella malli antaa
kotijoukkueelle keskimäärin 53,0 %, toteuma 58,7 % (104 ottelua, 16.10.).

Kotietu on kahdessa paikassa:
  * Poisson-osa (40 %): config.yaml match_model.home_ice = 1.08
  * MOV-Elo (60 %):     elo._DEFAULT_HOME_ADV = 36 (kalibroitu 55,2 %:iin)

Testi käyttää tuotannon ensemblea (sama kuin ensemble.backtest_ensemble,
poisson_weight 0,4) ja projektin vuotamatonta kehystä: jokaisen kauden
luokitukset vain sitä edeltävistä kausista. Arvo valitaan
leave-one-season-out: paras yhdistelmä kahdesta kaudesta, mitattuna
kolmannella. Ei kirjoita mihinkään eikä muuta mallia.

    .venv/bin/python scripts/experiments/home_advantage.py
"""
from __future__ import annotations

import copy
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
from liiga.config import load_config  # noqa: E402
from liiga.db import get_connection, query_df  # noqa: E402
from liiga.elo import _ot_rate_before, elo_game_probs, elo_ratings_as_of  # noqa: E402
from liiga.ensemble import ensemble_game_probs  # noqa: E402
from liiga.model import _brier, _log_loss, _ratings_as_of, calibrate_ties, predict_games  # noqa: E402

SEASONS = [2024, 2025, 2026]
POISSON_WEIGHT = 0.4
HOME_ICE = [1.04, 1.08, 1.12, 1.16, 1.20]
ELO_HFA = [20.0, 36.0, 50.0, 65.0, 80.0]
CURRENT = (1.08, 36.0)


def run() -> pd.DataFrame:
    cfg = load_config()
    con = get_connection()
    rows = []
    try:
        for s in SEASONS:
            games = query_df(con, f"SELECT home_team, away_team, home_win FROM stg_games "
                                  f"WHERE season = {s} AND ended")
            y = games["home_win"].to_numpy().astype(float)
            pratings = _ratings_as_of(con, s, cfg, use_goaltending=True)
            ot_rate = _ot_rate_before(con, s)
            ppred = {}
            for hi in HOME_ICE:
                c = copy.deepcopy(cfg)
                c["match_model"]["home_ice"] = hi
                p = predict_games(games, pratings, c)
                if c["match_model"].get("tie_calibration", True):
                    p = calibrate_ties(p, ot_rate)
                ppred[hi] = p
            for ha in ELO_HFA:
                er = elo_ratings_as_of(con, s, home_adv=ha)
                epred = elo_game_probs(games, er, home_adv=ha, ot_rate=ot_rate,
                                       ot_lean=cfg["match_model"]["ot_favourite_lean"])
                for hi in HOME_ICE:
                    pr = ensemble_game_probs(ppred[hi], epred, POISSON_WEIGHT)["p_home_win"].to_numpy()
                    rows.append({"season": s, "home_ice": hi, "elo_hfa": ha, "n": len(y),
                                 "home_rate": y.mean(), "mean_p": pr.mean(),
                                 "logloss": _log_loss(y, pr), "brier": _brier(y, pr),
                                 "acc": ((pr > 0.5) == y).mean(),
                                 "base_logloss": _log_loss(y, np.full_like(y, y.mean()))})
    finally:
        con.close()
    return pd.DataFrame(rows)


def main() -> None:
    r = run()
    cur = r[(r.home_ice == CURRENT[0]) & (r.elo_hfa == CURRENT[1])].set_index("season")
    print("Nykyinen malli (home_ice 1.08, Elo 36):")
    print(cur[["n", "home_rate", "mean_p", "acc", "logloss", "base_logloss"]].round(4).to_string())

    print("\nLeave-one-season-out: arvo valitaan kahdesta kaudesta, mitataan kolmannella")
    out = []
    for held in SEASONS:
        train = r[r.season != held].groupby(["home_ice", "elo_hfa"]).logloss.mean()
        hi, ha = train.idxmin()
        test = r[(r.season == held) & (r.home_ice == hi) & (r.elo_hfa == ha)].iloc[0]
        base = cur.loc[held]
        out.append({"pidetty_kausi": held, "valittu_home_ice": hi, "valittu_elo_hfa": ha,
                    "mean_p": test.mean_p, "home_rate": test.home_rate,
                    "logloss_nyk": base.logloss, "logloss_uusi": test.logloss,
                    "parannus": base.logloss - test.logloss,
                    "acc_nyk": base.acc, "acc_uusi": test.acc})
    o = pd.DataFrame(out)
    print(o.round(4).to_string(index=False))
    print(f"\nKeskimääräinen parannus kaudelle jota ei käytetty valintaan: "
          f"{o.parannus.mean():+.4f} log-lossia "
          f"({(o.parannus > 0).sum()}/{len(o)} kautta paranee)")

    allb = r.groupby(["home_ice", "elo_hfa"]).agg(logloss=("logloss", "mean"), mean_p=("mean_p", "mean"))
    print("\nKaikki kaudet yhdessä (vain suuntaa varten, EI valintaperuste):")
    print(allb.logloss.unstack().round(4).to_string())
    print(f"toteutunut kotivoitto 2024–26: {r.groupby('season').home_rate.first().mean():.3f}")


if __name__ == "__main__":
    main()
