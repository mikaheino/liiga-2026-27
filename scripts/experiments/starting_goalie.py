"""Aloittavan maalivahdin historiatesti (27.10.2026; docs/uutismalli_suunnitelma.md,
vaihe 2).

Kysymys: paraneeko ottelukohtainen ennuste, kun tiedetään kuka aloittaa maalilla?
Klo 14 -ajo saa aloittajan liiga.fi:n kokoonpanosta, joten tämä on haastajan
maalivahtiosan yläraja historiassa.

Menetelmä (walk-forward, ei vuotoa; sama toisto kuin liiga.inseason):
- Maalivahdin taso = pelastetut maalit yli odotetun per ottelu:
  vastustajan xG - päästetyt (tyhjä maali pois), vain aloitukset, joissa sama
  vahti pelasi koko ottelun. Painotettu kausittain (decay), regressoitu nollaan
  n0 näennäisottelulla. Tila "esikausi" käyttää vain aiempia kausia
  (`model_improvement_ideas.md` 2.3: kauden alkuvire tasoittuu, r_gk = 0,17),
  "tähän asti" myös kuluvan kauden aiemmat ottelut.
- Joukkueen oletus = sen kauden aiempien aloittajien tasojen keskiarvo
  (aloitusten painoin); malli ei tiedä kuka aloittaa, joten se ennustaa
  keskimääräisellä vahdilla. Ero = aloittaja - oletus.
- Poisson: vastustajan maaliodottama lambda -> lambda - ero (joukkueen
  def_rating kerrotaan 1 - ero / lambda). Elo ei tunne maalivahteja:
  "poisson" säätää vain Poisson-osaa (paino 0,4 kuten tuotannossa), "koko"
  lisää saman todennäköisyysmuutoksen koko ensembleen.

Kaudet 2023-2026 (2022 vain historiaksi) ja kuluva 2027. Ottelutiedot haetaan
liiga.fi:stä kerran .cache/game_details/-hakemistoon (gitin ulkopuolella).

    .venv/bin/python scripts/experiments/starting_goalie.py            # testi
    .venv/bin/python scripts/experiments/starting_goalie.py --levels   # data/goalie_levels_2027.csv
"""
from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src"))

from liiga.config import load_config  # noqa: E402
from liiga.db import get_connection, query_df  # noqa: E402
from liiga.elo import _ot_rate_before, elo_game_probs  # noqa: E402
from liiga.ensemble import ensemble_game_probs  # noqa: E402
from liiga.inseason import _GAME_SQL, _day_elo, _score, _season_elo, poisson_probs  # noqa: E402
from liiga.model import _ratings_as_of  # noqa: E402
from liiga.results import _parse_goalies  # noqa: E402

CACHE = ROOT / ".cache" / "game_details"
HISTORY = (2022, 2023, 2024, 2025, 2026)
EVAL = (2023, 2024, 2025, 2026, 2027)
DECAY = 0.7
POISSON_WEIGHT = 0.4
PROB_COLS = ["p_home_reg", "p_away_reg", "p_overtime"]


# ---- data ---------------------------------------------------------------------

def _fetch(season: int, game_id: int, cfg: dict) -> Path:
    path = CACHE / f"game_{season}_{game_id}.json"
    if not path.exists():
        r = requests.get(f"{cfg['api_base']}/games/{season}/{game_id}",
                         headers={"User-Agent": cfg["user_agent"], "Accept": "application/json"},
                         timeout=cfg["request_timeout_seconds"])
        r.raise_for_status()
        path.write_text(r.text, encoding="utf-8")
        time.sleep(0.1)
    return path


def goalie_starts(con) -> pd.DataFrame:
    """Every starter of every game 2022-2027 with goals against and opponent xG."""
    cfg = load_config()["ingestion"]
    CACHE.mkdir(parents=True, exist_ok=True)
    ids = query_df(con, f"SELECT season, game_id FROM stg_games WHERE ended AND season IN {HISTORY}")
    with ThreadPoolExecutor(max_workers=3) as ex:
        paths = list(ex.map(lambda r: _fetch(int(r[0]), int(r[1]), cfg), ids.itertuples(index=False)))
    parts = [_parse_goalies(json.loads(p.read_text(encoding="utf-8")), int(s))
             for p, s in zip(paths, ids["season"])]
    parts.append(query_df(con, "SELECT * FROM game_goalies WHERE season = 2027"))
    g = pd.concat(parts, ignore_index=True)
    g = g[g["started"].astype(bool)]
    games = query_df(con, """SELECT season, game_id, SUBSTR(start_ts, 1, 10) AS gdate,
                                    home_team, away_team, home_xg, away_xg FROM stg_games WHERE ended""")
    g = g.merge(games, on=["season", "game_id"])
    g["xga"] = np.where(g["is_home"].astype(bool), g["away_xg"], g["home_xg"])
    g["gsax"] = g["xga"] - g["goals_against"]          # NaN kun vaihto kesken ottelun
    return g[["season", "game_id", "gdate", "team", "is_home", "player_id", "last_name", "gsax"]]


# ---- goalie levels as of a game -------------------------------------------------

def levels(starts: pd.DataFrame, n0: float, mode: str) -> pd.DataFrame:
    """Starter level and team default for every game, from prior games only."""
    starts = starts.sort_values(["gdate", "game_id"]).reset_index(drop=True)
    hist: dict[int, list[tuple[int, str, float]]] = {}
    team_starts: dict[tuple[int, str], list[int]] = {}
    out = []

    def level(pid: int, season: int, gdate: str) -> float:
        num = den = 0.0
        for s, d, v in hist.get(pid, []):
            if d >= gdate or (mode == "esikausi" and s >= season) or np.isnan(v):
                continue
            w = DECAY ** (season - s)
            num, den = num + w * v, den + w
        return num / (den + n0)

    for gdate, day in starts.groupby("gdate", sort=True):
        for r in day.itertuples(index=False):
            prev = team_starts.get((r.season, r.team), [])
            own = level(r.player_id, r.season, gdate)
            default = float(np.mean([level(p, r.season, gdate) for p in prev])) if prev else own
            out.append({"season": r.season, "game_id": r.game_id, "team": r.team,
                        "starter": r.last_name, "level": own, "diff": own - default})
        for r in day.itertuples(index=False):
            hist.setdefault(r.player_id, []).append((r.season, gdate, r.gsax))
            team_starts.setdefault((r.season, r.team), []).append(r.player_id)
    return pd.DataFrame(out)


# ---- walk-forward replay --------------------------------------------------------

def _adjusted_ratings(day: pd.DataFrame, ratings: pd.DataFrame, diff: dict, cfg: dict) -> pd.DataFrame:
    """def_rating per team for this day: opponent lambda minus the starter's edge."""
    r = ratings.set_index("team")
    avg, home_ice = cfg["team_strength"]["league_avg_goals_per_game"], cfg["match_model"]["home_ice"]
    adj = r.copy()
    for g in day.itertuples(index=False):
        for team, opp, ice in ((g.home_team, g.away_team, 1.0), (g.away_team, g.home_team, home_ice)):
            if team not in r.index or opp not in r.index:
                continue
            lam_opp = avg * r.at[opp, "off_rating"] * r.at[team, "def_rating"] * ice
            d = diff.get((int(g.game_id), team), 0.0)
            adj.at[team, "def_rating"] = r.at[team, "def_rating"] * float(np.clip(1 - d / lam_opp, 0.6, 1.4))
    return adj.reset_index()


def _full(ens: pd.DataFrame, pois_base: pd.DataFrame, pois_adj: pd.DataFrame) -> pd.DataFrame:
    out = ens.copy()
    for c in PROB_COLS:
        out[c] = np.clip(ens[c] + pois_adj[c] - pois_base[c], 1e-6, 1)
    s = out[PROB_COLS].sum(axis=1)
    for c in PROB_COLS:
        out[c] = out[c] / s
    out["p_home_win"] = out["p_home_reg"] + out["p_overtime"] * out["p_home_ot_win"]
    return out


def replay(con, cfg, season: int, diffs: dict[str, dict]) -> pd.DataFrame:
    prior = _ratings_as_of(con, season, cfg, use_goaltending=True)
    ot_rate = _ot_rate_before(con, season)
    ot_lean = cfg["match_model"]["ot_favourite_lean"]
    history = query_df(con, _GAME_SQL.format(op="<", s=int(season)))
    games = query_df(con, _GAME_SQL.format(op="=", s=int(season)))
    start = _season_elo(history, {"goals": {}})
    rows = []
    for gdate, day in games.groupby("gdate", sort=True):
        before = games[games["gdate"] < gdate]
        elo = elo_game_probs(day, _day_elo(start, before, {"goals": {}})["goals"], ot_rate=ot_rate, ot_lean=ot_lean)
        pois = poisson_probs(day, prior, cfg, ot_rate)
        base = ensemble_game_probs(pois, elo, poisson_weight=POISSON_WEIGHT)
        preds = {"lukittu": base}
        for name, diff in diffs.items():
            pa = poisson_probs(day, _adjusted_ratings(day, prior, diff, cfg), cfg, ot_rate)
            preds[f"{name} poisson"] = ensemble_game_probs(pa, elo, poisson_weight=POISSON_WEIGHT)
            preds[f"{name} koko"] = _full(base, pois, pa)
        for variant, pred in preds.items():
            sc = _score(pred)
            sc["variant"], sc["season"], sc["game_id"] = variant, season, day["game_id"].values
            rows.append(sc)
    return pd.concat(rows, ignore_index=True)


def main() -> None:
    cfg = load_config()
    con = get_connection()
    try:
        starts = goalie_starts(con)
        print(f"aloituksia {len(starts)}, joista xG-tasolle kelpaa {starts['gsax'].notna().sum()}")
        lv = {f"{mode} n0={n0:g}": levels(starts, n0, mode)
              for mode in ("esikausi", "tähän asti") for n0 in (20.0, 50.0, 100.0)}
        diffs = {k: {(int(r.game_id), r.team): r.diff for r in v.itertuples(index=False)} for k, v in lv.items()}
        scored = pd.concat([replay(con, cfg, s, diffs) for s in EVAL], ignore_index=True)
    finally:
        con.close()

    pd.set_option("display.width", 200)
    hist = scored[scored["season"] < 2027]
    summ = pd.DataFrame({"ll2 2023-26": hist.groupby("variant")["ll2"].mean(),
                         "ll3 2023-26": hist.groupby("variant")["ll3"].mean(),
                         "ll2 2027": scored[scored["season"] == 2027].groupby("variant")["ll2"].mean(),
                         "ll3 2027": scored[scored["season"] == 2027].groupby("variant")["ll3"].mean()})
    print("\nlukittu malli, log-loss:")
    print(summ.loc["lukittu"].round(4).to_string())
    summ = summ - summ.loc["lukittu"]
    print("\nlog-loss-muutos lukittuun malliin (negatiivinen = parempi):")
    print(summ.sort_values("ll2 2023-26").round(4).to_string())
    print("\nkausittain, ll2-muutos:")
    piv = scored.pivot_table(index="variant", columns="season", values="ll2")
    print((piv - piv.loc["lukittu"]).round(4).sort_values(2026).to_string())
    best = min(lv, key=lambda k: summ.at[f"{k} koko", "ll2 2023-26"])
    d = lv[best]
    print(f"\n{best}: aloittajan ero joukkueen oletukseen |ero| (maalia/ottelu): "
          f"mediaani {d['diff'].abs().median():.3f}, 90 % {d['diff'].abs().quantile(0.9):.3f}, max {d['diff'].abs().max():.3f}")
    big = d[d["diff"].abs() >= 0.15][["season", "game_id"]].drop_duplicates()
    sub = scored.merge(big, on=["season", "game_id"])
    print("\nparittainen merkitsevyys:")
    for v in (f"{best} koko", f"{best} poisson"):
        significance(scored, v)
    print(f"ottelut, joissa |ero| >= 0,15 jommallakummalla ({len(big)} kpl), ll2:")
    print(sub.groupby("variant")["ll2"].mean().sub(sub[sub.variant == "lukittu"]["ll2"].mean()).round(4)
          .loc[["lukittu", f"{best} poisson", f"{best} koko"]].to_string())


def season_levels(starts: pd.DataFrame, season: int, n0: float) -> pd.DataFrame:
    """Esikauden taso jokaiselle maalivahdille: vain kautta `season` edeltävät
    kaudet (sama kaava kuin levels(mode="esikausi")). Haastaja lukee tämän."""
    prior = starts[(starts["season"] < season) & starts["gsax"].notna()].copy()
    prior["w"] = DECAY ** (season - prior["season"])
    prior["wv"] = prior["w"] * prior["gsax"]
    g = prior.groupby("player_id").agg(name=("last_name", "last"), wv=("wv", "sum"), w=("w", "sum"), starts=("gsax", "size"))
    g["level"] = g["wv"] / (g["w"] + n0)
    return g.reset_index()[["player_id", "name", "starts", "level"]].sort_values("level", ascending=False)


def significance(scored: pd.DataFrame, variant: str) -> None:
    """Parittainen ero ja keskivirhe: sama ottelu, kaksi ennustetta."""
    base = scored[scored.variant == "lukittu"].set_index(["season", "game_id"])["ll2"]
    alt = scored[scored.variant == variant].set_index(["season", "game_id"])["ll2"]
    d = (alt - base).dropna()
    for label, part in (("2023-26", d[d.index.get_level_values(0) < 2027]), ("2027", d[d.index.get_level_values(0) == 2027]),
                        ("kaikki", d)):
        se = part.std(ddof=1) / np.sqrt(len(part))
        print(f"  {variant} {label}: ero {part.mean():+.4f} ± {se:.4f} (t = {part.mean() / se:+.2f}, n = {len(part)})")


if __name__ == "__main__":
    if sys.argv[1:] == ["--levels"]:
        con = get_connection()
        try:
            lv = season_levels(goalie_starts(con), 2027, 20.0)
        finally:
            con.close()
        out = ROOT / "data" / "goalie_levels_2027.csv"
        lv.to_csv(out, index=False, float_format="%.4f")
        print(f"{out}: {len(lv)} maalivahtia")
        print(lv.head(8).to_string(index=False))
        print(lv.tail(4).to_string(index=False))
    else:
        main()
