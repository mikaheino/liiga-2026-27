"""Automaattinen haastaja tämän kauden pelatuissa otteluissa (27.10.2026).

Käyttäjä 27.10.: "Miten paljon näillä jo automaattisesti kerätyillä tiedoilla
haastajamalli eroaa päämallista?" Ajetaan haastajan automaattinen osa takautuvasti
kauden 2026-27 otteluihin, vain ottelua edeltävillä tiedoilla:

- perusta: virallinen ennuste ennen ottelua (prediction_games, viimeisin snapshot
  ottelupäivänä tai ennen; sama kuin sovelluksen Ottelut-sivulla),
- puuttuvat vakiopelaajat: kenttäpelaaja kokoonpanossa >= 70 % joukkueen
  viimeisistä (enintään 10, vähintään 5) otteluista, mutta ei tässä ottelussa
  (toteutunut kokoonpano = klo 14 -ajon kokoonpano; myöhäiset muutokset harvinaisia),
- aloittava maalivahti: esikauden taso (data/goalie_levels_2027.csv) - joukkueen
  kauden aiempien aloittajien keskitaso,
- vaikutukset samoilla funktioilla kuin tuotannon haastaja (scripts/news/challenger.py).

Ei mukana: käyttäjän kirjaukset ja uutisten automaattiset kirjaukset (ei historiaa).

    .venv/bin/python scripts/experiments/challenger_2027.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "news"))
import challenger as ch  # noqa: E402

sim = ch.sim
MIN_PRIOR, LAST, SHARE = 5, 10, 0.7


def load(con):
    games = con.execute("""
        SELECT g.game_id, SUBSTR(g.start_ts, 1, 10) AS d, g.start_ts, g.home_team, g.away_team,
               g.home_goals, g.away_goals, p.p_home_reg, p.p_overtime, p.p_home_ot_win, p.p_home_win
        FROM stg_games g
        JOIN prediction_games p ON p.game_id = g.game_id
         AND p.snapshot_date = (SELECT MAX(p2.snapshot_date) FROM prediction_games p2
                                WHERE p2.game_id = g.game_id AND p2.snapshot_date <= SUBSTR(g.start_ts, 1, 10))
        WHERE g.season = 2027 AND g.ended ORDER BY g.start_ts""").df()
    lineups = con.execute("""
        SELECT game_id, team, first_name || ' ' || last_name AS name, position_group, line
        FROM game_lineups WHERE season = 2027 AND line IS NOT NULL""").df()
    starters = con.execute("""
        SELECT game_id, team, CAST(player_id AS VARCHAR) AS pid FROM game_goalies
        WHERE season = 2027 AND started""").df()
    return games, lineups, starters


def missing_regulars(team: str, gid: int, history: list[int], lineups: pd.DataFrame) -> list[str]:
    prior = history[-LAST:]
    if len(prior) < MIN_PRIOR:
        return []
    sk = lineups[(lineups["team"] == team) & (lineups["position_group"] != "G")]
    counts = sk[sk["game_id"].isin(prior)]["name"].value_counts()
    regulars = set(counts[counts >= SHARE * len(prior)].index)
    return sorted(regulars - set(sk[sk["game_id"] == gid]["name"]))


def main() -> None:
    levels = {r["player_id"]: float(r["level"]) for r in ch._read(ch.LEVELS)}
    con = duckdb.connect(str(ROOT / "data" / "liiga.duckdb"), read_only=True)
    try:
        model = ch._model(con)
        games, lineups, starters = load(con)
    finally:
        con.close()
    names = {p["name"] for p in model["players"]}
    team_games: dict[str, list[int]] = {}
    team_starts: dict[str, list[str]] = {}
    rows = []
    for g in games.itertuples(index=False):
        base = {"game_id": g.game_id, "date": g.d, "iso": g.d, "home_team": g.home_team, "away_team": g.away_team,
                "p_home_reg": g.p_home_reg, "p_overtime": g.p_overtime, "p_home_ot_win": g.p_home_ot_win}
        miss = {t: [n for n in missing_regulars(t, g.game_id, team_games.get(t, []), lineups) if n in names]
                for t in (g.home_team, g.away_team)}
        items = [{"injury": n} for t in miss for n in miss[t]]
        try:
            new = sim.apply_injuries(items, [base], model, g.d)[0][0] if items else base
        except sim.ScenarioError:
            new = base
        diffs = {}
        for t in (g.home_team, g.away_team):
            s = starters[(starters["game_id"] == g.game_id) & (starters["team"] == t)]["pid"]
            prev = [levels.get(p, 0.0) for p in team_starts.get(t, [])]
            if len(s) and prev:
                diffs[t] = levels.get(s.iloc[0], 0.0) - float(np.mean(prev))
        if diffs:
            new = ch._apply_goalies(new, model["strength"], diffs.get(g.home_team, 0.0), diffs.get(g.away_team, 0.0))
        p_ch = new["p_home_reg"] + new["p_overtime"] * new["p_home_ot_win"]
        rows.append({"date": g.d, "game": f"{g.home_team}–{g.away_team}", "y": int(g.home_goals > g.away_goals),
                     "p_base": g.p_home_win, "p_ch": p_ch, "n_missing": sum(len(v) for v in miss.values()),
                     "missing": "; ".join(f"{t}: {', '.join(v)}" for t, v in miss.items() if v),
                     "goalie": "; ".join(f"{t} {d:+.2f}" for t, d in diffs.items() if abs(d) >= 0.05)})
        for t in (g.home_team, g.away_team):
            team_games.setdefault(t, []).append(g.game_id)
            team_starts.setdefault(t, []).extend(starters[(starters["game_id"] == g.game_id) & (starters["team"] == t)]["pid"])
    report(pd.DataFrame(rows))


def report(r: pd.DataFrame) -> None:
    eps = 1e-9
    ll = lambda p: -(r["y"] * np.log(np.clip(p, eps, 1 - eps)) + (1 - r["y"]) * np.log(np.clip(1 - p, eps, 1 - eps)))  # noqa: E731
    r["d"] = r["p_ch"] - r["p_base"]
    r["dll"] = ll(r["p_ch"]) - ll(r["p_base"])
    moved = r[r["d"].abs() >= 0.005]
    print(f"otteluita {len(r)}; haastaja poikkesi (≥ 0,5 %-yks.) {len(moved)} ottelussa")
    print(f"|ero| keskimäärin {100 * r['d'].abs().mean():.2f} %-yks., mediaani {100 * r['d'].abs().median():.2f}, "
          f"90 % {100 * r['d'].abs().quantile(0.9):.2f}, suurin {100 * r['d'].abs().max():.2f}")
    print(f"puuttuvia vakiopelaajia keskimäärin {r['n_missing'].mean():.2f} / ottelu; otteluita, joissa ≥ 1: {(r['n_missing'] > 0).sum()}")
    se = r["dll"].std(ddof=1) / np.sqrt(len(r))
    print(f"log-loss: päämalli {ll(r['p_base']).mean():.4f}, haastaja {ll(r['p_ch']).mean():.4f}, "
          f"ero {r['dll'].mean():+.4f} ± {se:.4f} (t = {r['dll'].mean() / se:+.2f})")
    hit = lambda p: ((p >= 0.5).astype(int) == r["y"]).sum()  # noqa: E731
    print(f"voittaja oikein: päämalli {hit(r['p_base'])}, haastaja {hit(r['p_ch'])} / {len(r)}; "
          f"eri suosikki {((r['p_base'] >= 0.5) != (r['p_ch'] >= 0.5)).sum()} ottelussa")
    print("\nsuurimmat erot:")
    for x in r.reindex(r["d"].abs().sort_values(ascending=False).index).head(8).itertuples(index=False):
        res = "koti voitti" if x.y else "vieras voitti"
        print(f"  {x.date} {x.game}: {100 * x.p_base:.1f} -> {100 * x.p_ch:.1f} % ({res}) | {x.missing or '-'} | MV {x.goalie or '-'}")


if __name__ == "__main__":
    main()
