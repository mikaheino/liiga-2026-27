"""Uutishaastajan kausiennuste (27.10.2026; docs/uutismalli_suunnitelma.md).

Käyttäjä 27.10.: "jos Lucas Wernblom on poissa kuusi ottelua, noille kuudelle
ottelulle pitäisi laskea uusi ennuste, mikä vaikuttaa koko kauden ennusteeseen."
Kaikki voimassa olevat poissaolot (OK-nappi, absences.csv) viedään niihin
otteluihin, joita ne koskevat, ja kausi simuloidaan uudelleen samalla
skenaariologiikalla kuin agentin liiga_skenaario (compute: samat satunnaisluvut
perustasossa ja haastajassa, joten ero on poissaolojen eikä arpajaisten).

Ajetaan Pages-käännöksessä aamun ennusteen jälkeen (pages.yml), tulos sovelluksen
tauluihin:
  challenger_teams   joukkueittain virallinen vs. haastaja (pisteet, voitto, top 6, putoaminen)
  challenger_games   tulevien otteluiden haastajatodennäköisyydet (vain muuttuneet)

    python scripts/news/challenger_season.py NEWSDIR
"""
from __future__ import annotations

import csv
import datetime as dt
import importlib.util
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

import duckdb
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("skenaario", ROOT / "scripts/tools/skenaario.py")
sk = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sk)
sim = sk.sim


def active_absences(news: Path, today: str) -> list[dict]:
    """Voimassa olevat poissaolot skenaariotyökalun muodossa: pelaaja ja paluupäivä."""
    path = news / "absences.csv"
    rows = list(csv.DictReader(path.open(encoding="utf-8"))) if path.exists() else []
    latest: dict[str, dict] = {}
    for r in rows:                       # myöhempi kirjaus (esim. paluu) korvaa aiemman
        latest[r["player"]] = r
    return [{"injury": r["player"], "until": r["until"]} for r in latest.values()
            if r["kind"] == "out" and r["until"] > today]


TEAM_COLS = ["team", "points_now", "points_scenario", "p_title_now", "p_title_scenario",
             "p_top6_now", "p_top6_scenario", "p_relegation_now", "p_relegation_scenario"]


def forecast(con, items: list[dict], today: str) -> tuple[pd.DataFrame, pd.DataFrame, str]:
    """(joukkueet, muuttuneet ottelut, ennusteen päivä) poissaoloilla."""
    games, banked, published, w, snap, played = sk.load(con)
    teams_df = pd.DataFrame(columns=TEAM_COLS)
    games_df = pd.DataFrame(columns=["date", "home_team", "away_team", "p_home_win"])
    if not items:
        return teams_df, games_df, snap
    model = {**sk.load_model(con), "today": today}
    valid = []
    for it in items:
        try:
            sim.find_player(it["injury"], model["players"], model["goalies"])
            valid.append(it)
        except sim.ScenarioError as e:
            print(f"ohitettu: {e}")
    if not valid:
        return teams_df, games_df, snap
    res = sim.compute(valid, games, banked, published, w, played, model)
    changed, _ = sim.apply_injuries(valid, games, model, today)
    games_df = pd.DataFrame([
        {"date": c["iso"], "home_team": c["home_team"], "away_team": c["away_team"],
         "p_home_win": c["p_home_reg"] + c["p_overtime"] * c["p_home_ot_win"]}
        for g, c in zip(games, changed) if abs(c["p_home_reg"] - g["p_home_reg"]) > 1e-9],
        columns=games_df.columns)
    for x in res["injuries"]:
        print(f"{x['name']} ({x['team']}): {x['n_games']} ottelua, voitto {x['win_before']:.1%} -> {x['win_after']:.1%}")
    return pd.DataFrame(res["teams"])[TEAM_COLS], games_df, snap


def main(news: Path) -> int:
    today = dt.datetime.now(ZoneInfo("Europe/Helsinki")).date().isoformat()
    items = active_absences(news, today)
    db = str(sk.ROOT / "data/liiga.duckdb")
    # Luku ja kirjoitus eri yhteyksillä: DuckDB 2.0 ei salli kirjoitusta yhteydellä,
    # jolla on kesken jäänyt tulos (skenaariotyökalun fetchone-kyselyt).
    con = duckdb.connect(db, read_only=True)
    try:
        teams_df, games_df, snap = forecast(con, items, today)
    finally:
        con.close()
    con = duckdb.connect(db)
    try:
        for name, df in (("challenger_teams", teams_df), ("challenger_games", games_df)):
            con.register("_df", df)
            con.execute(f"CREATE OR REPLACE TABLE {name} AS SELECT * FROM _df").fetchall()
            con.unregister("_df")
    finally:
        con.close()
    moved = teams_df[(teams_df["points_scenario"] - teams_df["points_now"]).abs() >= 0.3] if len(teams_df) else teams_df
    for r in moved.itertuples(index=False):
        print(f"{r.team}: {r.points_now:.1f} -> {r.points_scenario:.1f} p, top 6 {r.p_top6_now:.1%} -> {r.p_top6_scenario:.1%}")
    print(f"poissaoloja {len(items)}, muuttuneita otteluita {len(games_df)} (ennuste {snap})")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(Path(sys.argv[1])))
