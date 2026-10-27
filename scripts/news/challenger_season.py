"""Uutishaastajan kausiennuste (27.10.2026; docs/uutismalli_suunnitelma.md).

Käyttäjä 27.10.: "jos Lucas Wernblom on poissa kuusi ottelua, noille kuudelle
ottelulle pitäisi laskea uusi ennuste, mikä vaikuttaa koko kauden ennusteeseen."
Kaikki voimassa olevat poissaolot (OK-nappi, absences/) viedään niihin
otteluihin, joita ne koskevat, ja kausi simuloidaan uudelleen samalla
skenaariologiikalla kuin agentin liiga_skenaario (compute: samat satunnaisluvut
perustasossa ja haastajassa, joten ero on poissaolojen eikä arpajaisten).

Ajetaan Pages-käännöksessä aamun ennusteen jälkeen (pages.yml), tulos sovelluksen
tauluihin:
  challenger_teams   joukkueittain virallinen vs. haastaja (pisteet, voitto, top 6, putoaminen)
  challenger_games   tulevien otteluiden haastajatodennäköisyydet (vain muuttuneet)
  challenger_events  kirjaushistoria (historiasivu): jokainen kirjaus tilan ja,
                     voimassa olevalle, vaikutuksen kanssa
  news_effects       uutiskohtainen vaikutus (pelikielto, loukkaantuminen): hyväksytystä
                     kirjattu kesto, muuten otsikosta arvattu -- "paljonko tämä muuttaa"

    python scripts/news/challenger_season.py NEWSDIR [HISTORYDIR]   # HISTORYDIR = pages-data
"""
from __future__ import annotations

import datetime as dt
import importlib.util
import re
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parent))
import absences  # noqa: E402
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("skenaario", ROOT / "scripts/tools/skenaario.py")
sk = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sk)
sim = sk.sim


def active_absences(news: Path, today: str) -> list[dict]:
    """Voimassa olevat ja tulevat poissaolot skenaariotyökalun muodossa: pelaaja ja paluupäivä."""
    return [{"injury": r["player"], "until": r["until"]} for r in absences.latest(news).values()
            if r["kind"] == "out" and r["until"] > today]


# Lukusanat genetiivissä ("kuuden ottelun") ja perusmuodossa ("kuusi ottelua");
# väli "2-4 viikkoa" -> suurempi. Sama sääntö kuin sovelluksen lomakkeessa.
NUMERALS = {"yhden": 1, "kahden": 2, "kolmen": 3, "neljän": 4, "viiden": 5, "kuuden": 6,
            "seitsemän": 7, "kahdeksan": 8, "yhdeksän": 9, "kymmenen": 10,
            "yksi": 1, "kaksi": 2, "kolme": 3, "neljä": 4, "viisi": 5, "kuusi": 6}
NUM = r"(?:\d+\s*[-–]\s*)?(\d+|" + "|".join(NUMERALS) + ")"
EFFECT_COLS = ["url", "player", "team", "n_games", "win_before", "win_after", "xp_delta", "approved"]


def guess_item(title: str, player: str) -> dict:
    """Otsikon kesto skenaariotyökalun muotoon (sama sääntö kuin sovelluksen lomake)."""
    t = title.lower()
    n = lambda w: NUMERALS.get(w) or int(w)              # noqa: E731
    if m := re.search(NUM + r" ottelu", t):
        return {"injury": player, "games": n(m.group(1))}
    if m := re.search(NUM + r" viik", t):
        return {"injury": player, "days": 7 * n(m.group(1))}
    if m := re.search(NUM + r" kuukau", t):
        return {"injury": player, "days": 30 * n(m.group(1))}
    if re.search(r"viikon|viikoksi", t):
        return {"injury": player, "days": 7}
    if re.search(r"kuukauden|kuukaudeksi", t):
        return {"injury": player, "days": 30}
    if re.search(r"pitkään|loppukau|koko kauden", t):
        return {"injury": player}
    return {"injury": player, "games": 1}


def news_effects(con, news: Path, games: list[dict], model: dict, today: str) -> pd.DataFrame:
    """Vaikutus uutisen pelaajan otteluihin yksinään: hyväksytyt kirjaukset
    (kirjattu kesto) ja tuoreet pelikieltouutiset, joilla on yksi pelaaja (kesto
    otsikosta). Hyväksymättömälle loukkaantumiselle ei arviota: kesto on arvaus ja
    pelaaja on voinut jo palata (Huuhtanen 16.10. sivussa, 23.10. takaisin)."""
    approved = {(r["url"], r["player"]): r for r in absences.latest(news).values() if r["kind"] == "out" and r["url"]}
    since = (dt.date.fromisoformat(today) - dt.timedelta(days=14)).isoformat()
    rows = con.execute("""
        SELECT c.url, c.player, n.title || ' ' || COALESCE(n.summary, ''), n.flags FROM news_candidates c JOIN news_items n USING (url)
        WHERE regexp_matches(n.flags, 'pelikielto|loukkaantuminen')
          AND COALESCE(NULLIF(n.published, ''), n.fetched_at) >= ?""", [since]).fetchall()
    per_url: dict[str, list] = {}
    for url, player, title, flags in rows:
        if "pelikielto" in flags or (url, player) in approved:
            per_url.setdefault(url, []).append((player, title))
    out = []
    for url, cands in per_url.items():
        if len(cands) != 1:                       # monitulkintainen: ei arviota
            continue
        player, title = cands[0]
        ap = approved.get((url, player))
        if ap and ap["until"] <= today:
            continue
        item = {"injury": player, "until": ap["until"]} if ap else guess_item(title, player)
        try:
            _, info = sim.apply_injuries([item], games, model, today)
        except sim.ScenarioError:
            continue
        x = info[0]
        out.append({"url": url, "player": x["name"], "team": x["team"], "n_games": x["n_games"],
                    "win_before": x["win_before"], "win_after": x["win_after"],
                    "xp_delta": x["xp_window_after"] - x["xp_window_before"], "approved": bool(ap)})
    return pd.DataFrame(out, columns=EFFECT_COLS)


EVENT_COLS = ["approved_at", "url", "player", "team", "kind", "games", "start", "until", "source", "status",
              "n_games", "win_before", "win_after", "xp_delta"]


def _status(r: dict, later: list[dict], today: str, after: list[dict] = ()) -> str:
    if r["kind"] == "dismiss":
        return "ohitettu"
    if r["url"] and any(x["kind"] == "dismiss" and x["url"] == r["url"] for x in after):
        return "peruttu"
    if r["kind"] == "back":
        return "kokoonpano lopetti" if r["url"] == "kokoonpano" else "palasi"
    if any(x["kind"] == "back" for x in later):
        return "lopetettu"
    if any(x["kind"] == "out" for x in later):
        return "korvattu"
    return "voimassa" if r["until"] > today else "päättyi"


def event_history(news: Path, games: list[dict], model: dict, today: str) -> pd.DataFrame:
    """Kaikki kirjaukset uusimmasta vanhimpaan; voimassa olevalle poissaololle
    vaikutus jäljellä oleviin otteluihin (pelaaja yksin)."""
    ev = absences.events(news)
    out = []
    for i, r in enumerate(ev):
        later = [x for x in ev[i + 1:] if r["player"] and x["player"] == r["player"]]
        row = {k: r.get(k, "") for k in EVENT_COLS[:9]} | {"status": _status(r, later, today, ev[i + 1:]),
                                                           "n_games": None, "win_before": None, "win_after": None, "xp_delta": None}
        if row["status"] == "voimassa":
            try:
                _, info = sim.apply_injuries([{"injury": r["player"], "until": r["until"]}], games, model, today)
                x = info[0]
                row |= {"n_games": x["n_games"], "win_before": x["win_before"], "win_after": x["win_after"],
                        "xp_delta": x["xp_window_after"] - x["xp_window_before"]}
            except sim.ScenarioError:
                pass
        out.append(row)
    return pd.DataFrame(out[::-1], columns=EVENT_COLS)


TEAM_COLS = ["team", "points_now", "points_scenario", "p_title_now", "p_title_scenario",
             "p_top6_now", "p_top6_scenario", "p_relegation_now", "p_relegation_scenario"]


def forecast(con, news: Path, items: list[dict], today: str) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, str]:
    """(joukkueet, muuttuneet ottelut, uutisten vaikutukset, ennusteen päivä) poissaoloilla."""
    games, banked, published, w, snap, played = sk.load(con)
    teams_df = pd.DataFrame(columns=TEAM_COLS)
    games_df = pd.DataFrame(columns=["date", "home_team", "away_team", "p_home_win"])
    model = {**sk.load_model(con), "today": today}
    try:
        effects = news_effects(con, news, games, model, today)
    except duckdb.Error:                          # uutistauluja ei ole (ennen load_news-ajoa)
        effects = pd.DataFrame(columns=EFFECT_COLS)
    effects.attrs["history"] = event_history(news, games, model, today)
    if not items:
        return teams_df, games_df, effects, snap
    valid = []
    for it in items:
        try:
            sim.find_player(it["injury"], model["players"], model["goalies"])
            valid.append(it)
        except sim.ScenarioError as e:
            print(f"ohitettu: {e}")
    if not valid:
        return teams_df, games_df, effects, snap
    res = sim.compute(valid, games, banked, published, w, played, model)
    changed, _ = sim.apply_injuries(valid, games, model, today)
    games_df = pd.DataFrame([
        {"date": c["iso"], "home_team": c["home_team"], "away_team": c["away_team"],
         "p_home_win": c["p_home_reg"] + c["p_overtime"] * c["p_home_ot_win"]}
        for g, c in zip(games, changed) if abs(c["p_home_reg"] - g["p_home_reg"]) > 1e-9],
        columns=games_df.columns)
    for x in res["injuries"]:
        print(f"{x['name']} ({x['team']}): {x['n_games']} ottelua, voitto {x['win_before']:.1%} -> {x['win_after']:.1%}")
    return pd.DataFrame(res["teams"])[TEAM_COLS], games_df, effects, snap


def save_history(teams_df: pd.DataFrame, today: str, folder: Path | None) -> None:
    """Haastajan kausiennuste talteen päivittäin (käyttäjä 27.10.: "tallentuuhan
    haastaja, jotta voimme harkita käyttöönottoa"): pages-data/challenger_history.csv,
    päivän ajo korvaa saman päivän rivit. Ilman poissaoloja haastaja = virallinen."""
    if folder is None:
        return
    path = folder / "challenger_history.csv"
    old = pd.read_csv(path, dtype={"snapshot_date": str}) if path.exists() else pd.DataFrame()
    if len(old):
        old = old[old["snapshot_date"] != today]
    new = teams_df.assign(snapshot_date=today)[["snapshot_date", *TEAM_COLS]] if len(teams_df) else pd.DataFrame()
    pd.concat([old, new], ignore_index=True).to_csv(path, index=False, float_format="%.5f")


def main(news: Path, history_dir: Path | None = None) -> int:
    today = dt.datetime.now(ZoneInfo("Europe/Helsinki")).date().isoformat()
    items = active_absences(news, today)
    db = str(sk.ROOT / "data/liiga.duckdb")
    # Luku ja kirjoitus eri yhteyksillä: DuckDB 2.0 ei salli kirjoitusta yhteydellä,
    # jolla on kesken jäänyt tulos (skenaariotyökalun fetchone-kyselyt).
    con = duckdb.connect(db, read_only=True)
    try:
        teams_df, games_df, effects, snap = forecast(con, news, items, today)
    finally:
        con.close()
    save_history(teams_df, today, history_dir)
    con = duckdb.connect(db)
    try:
        history = effects.attrs.get("history", pd.DataFrame(columns=EVENT_COLS))
        for name, df in (("challenger_teams", teams_df), ("challenger_games", games_df), ("news_effects", effects),
                         ("challenger_events", history)):
            con.register("_df", df)
            con.execute(f"CREATE OR REPLACE TABLE {name} AS SELECT * FROM _df").fetchall()
            con.unregister("_df")
    finally:
        con.close()
    moved = teams_df[(teams_df["points_scenario"] - teams_df["points_now"]).abs() >= 0.3] if len(teams_df) else teams_df
    for r in moved.itertuples(index=False):
        print(f"{r.team}: {r.points_now:.1f} -> {r.points_scenario:.1f} p, top 6 {r.p_top6_now:.1%} -> {r.p_top6_scenario:.1%}")
    for e in effects.itertuples(index=False):
        print(f"uutinen: {e.player} ({e.team}) {e.n_games} ott., voitto {e.win_before:.1%} -> {e.win_after:.1%}, "
              f"{e.xp_delta:+.2f} p{'' if e.approved else ' (arvio)'}")
    print(f"poissaoloja {len(items)}, muuttuneita otteluita {len(games_df)} (ennuste {snap})")
    return 0


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    sys.exit(main(Path(sys.argv[1]), Path(sys.argv[2]) if len(sys.argv) == 3 else None))
