"""Puuttuvien päivien sijaintijakauma uudelleen sen päivän koodilla ja datalla (6.11.2026).

Jakaumasta oli tallessa vain git-versioiden 19 päivää (backfill_position_history.py).
Käyttäjä: "jos meillä on kaikki rosterimuutokset tiedossa ja malli muutokset, niin
eikö puuttuvat päivät pysty laskemaan noiden avulla uusiksi?" -- pystyy, ja tulos
voidaan TODENTAA, koska prediction_history on tallessa joka päivältä.

Päivälle D (aamuajo klo 08.30 Suomen aikaa):
  1. koodi + asetukset + kanta = git-työpuu viimeisimmässä commitissa ennen ajoa.
     Kanta on gitissä, ja jokainen rosterimuutoserä on commitoitu yhdessä sen kanssa
     (roster_changes.commit), joten työpuun kannassa on juuri D:n rosteri ja pelaajatahdit.
  2. tulokset: työpuun kantaan lisätään nykyisestä kannasta ne ottelut, jotka D:n
     viimeisessä ajossa oli pelattu -- määrä = prediction_history.games_played[D].
  3. muunnokset + joukkuevahvuus + ennuste sen päivän koodilla (päätietokantaan ei kirjoiteta).
  4. todennus: odotetut pisteet ja sijat vs. prediction_history[D]; git-päivinä koko jakauma.
     Kirjoitetaan VAIN todennetut päivät; alkuperä tauluun position_distribution_rebuilds.

Tulos 6.11.2026: pilotti (26.9., 2.10., 31.10.) toisti git-versioiden jakauman bitilleen
(ero 0,0), ja 45/47 puuttuvaa päivää osui prediction_historyyn täsmälleen (ero 0,0000,
18 koodiversiota). 7.10. ja 8.10. eivät osu (0,15 / 0,22 p) vaikka ottelut ja pisteet
täsmäävät virallisen sarjataulukon kanssa (raw_standings) eikä myöhempi koodi tai 9.10.
rosterierä selitä eroa -- jokin commitoimaton kantamuutos; niitä EI kirjoitettu.

    .venv/bin/python scripts/tools/rebuild_position_history.py --pilot           # 3 tunnettua päivää
    .venv/bin/python scripts/tools/rebuild_position_history.py --dates 2026-09-20 ...
    .venv/bin/python scripts/tools/rebuild_position_history.py --missing [--write]
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from zoneinfo import ZoneInfo

import duckdb
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "data" / "liiga.duckdb"
SEASON = 2027
TABLE = "position_distribution_history"
RANKS = [f"rank_{k}" for k in range(1, 18)]
PER_GAME = ["raw_games", "raw_goal_events", "raw_assists", "raw_periods", "raw_on_ice",
            "game_lineups", "game_goalies", "game_penalties", "game_referees"]
HEL = ZoneInfo("Europe/Helsinki")
# Pilotti: tunnetut päivät, joiden kantaversio EI ole rosterimuutoserä -- edellinen
# versio sisältää siis saman rosterin, ja testi mittaa vain menetelmää.
PILOT = ["2026-09-26", "2026-10-02", "2026-10-31"]
TOLERANCE = 0.05          # odotettujen pisteiden suurin sallittu ero (pistettä)
LOG = "position_distribution_rebuilds"   # alkuperä: millä koodilla ja kannalla, mikä ero
LINES = "line_history"                    # 14 parhaan raja per päivä (pipeline.LINE_HISTORY_COLUMNS)

RUN = """
import json
from liiga.db import get_connection
from liiga.transform import run_transforms
from liiga.team_strength import build_team_strength
from liiga.pipeline import forecast
con = get_connection(); run_transforms(con); con.close()
build_team_strength()
res = forecast()
meta = res["meta"].iloc[0].to_dict()
# Otteluennusteet ja kerätyt pisteet talteen: ennen 27.10. koodi ei laskenut pisterajaa,
# joten se johdetaan samasta simulaatiosta nykykoodilla (LINE_RUN).
import pickle
from liiga.config import load_config
from liiga.pipeline import build_prediction
c2 = get_connection(); pred, banked, _ = build_prediction(c2, load_config()); c2.close()
pickle.dump({"pred": pred, "banked": banked}, open("_sim_input.pkl", "wb"))
print("@@" + json.dumps({"n_played": int(res["n_played"]),
    "line": {k: meta.get(k) for k in ("line_rank", "line_likely", "line_safe")},
    "position": res["position"].to_dict("records"),
    "standings": res["standings"][["team", "proj_rank", "mean_points"]].to_dict("records")}, default=float))
"""


# Sama simulaatio nykykoodilla: tarkistus (jakauma täsmälleen sama) + pisteraja.
LINE_RUN = """
import json, pickle, sys
import duckdb
from liiga.simulate import simulate
d = pickle.load(open(sys.argv[1], "rb"))
con = duckdb.connect(sys.argv[2], read_only=True)
res = simulate(con=con, pred=d["pred"], base_points=d["banked"])
pos = res["position_distribution"].reset_index().rename(columns={"index": "team"})
pos.columns = ["team"] + [f"rank_{c}" for c in pos.columns[1:]]
print("@@" + json.dumps({"position": pos.to_dict("records"), "line": res["line"]}, default=float))
"""


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()


def run_time(day: str) -> dt.datetime:
    """Aamuajo 08.30 Suomen aikaa (launchd) UTC:nä."""
    return dt.datetime.fromisoformat(f"{day}T08:30:00").replace(tzinfo=HEL).astimezone(dt.UTC)


def commit_before(ts: dt.datetime, *paths: str) -> str:
    return git("rev-list", "-1", f"--before={ts.isoformat()}", "main", "--", *paths)


def truth(day: str) -> tuple[int, pd.DataFrame, pd.DataFrame | None]:
    """Pelattujen määrä ja odotetut pisteet D:n viimeisestä ajosta; git-päivinä myös jakauma."""
    con = duckdb.connect(str(DB), read_only=True)
    try:
        hist = con.execute("SELECT team, games_played, proj_rank, mean_points FROM prediction_history "
                           "WHERE CAST(snapshot_date AS VARCHAR) = ?", [day]).df()
        try:
            dist = con.execute(f"SELECT team, {', '.join(RANKS)} FROM {TABLE} WHERE CAST(snapshot_date AS VARCHAR) = ?",
                               [day]).df()
        except duckdb.Error:
            dist = pd.DataFrame()
    finally:
        con.close()
    if hist.empty:
        raise SystemExit(f"{day}: prediction_historyssa ei riviä")
    return int(hist.games_played.iloc[0]), hist, (dist if not dist.empty else None)


def advance(wt_db: Path, n_played: int) -> int:
    """Lisää työpuun kantaan ne ottelut, jotka D:n ajossa oli pelattu (nykyisestä kannasta)."""
    cur = duckdb.connect(str(DB), read_only=True)
    wt = duckdb.connect(str(wt_db))
    try:
        # Ensimmäiset N pelattua nykyisillä aloitusajoilla. Todennettu 7.-8.10.
        # joukkuekohtaisesti virallista sarjataulukkoa (raw_standings) vasten: sama joukko.
        target = [r[0] for r in cur.execute(
            "SELECT game_id FROM raw_games WHERE season = ? AND ended ORDER BY start_time, game_id LIMIT ?",
            [SEASON, n_played]).fetchall()]
        have = {r[0] for r in wt.execute("SELECT game_id FROM raw_games WHERE season = ? AND ended", [SEASON]).fetchall()}
        extra = have - set(target)
        if extra:
            raise SystemExit(f"työpuun kannassa on {len(extra)} ottelua, joita D:n ajossa ei ollut pelattu")
        add = [g for g in target if g not in have]
        if not add:
            return 0
        wt_tables = {r[0] for r in wt.execute("SELECT table_name FROM information_schema.tables").fetchall()}
        ids = ", ".join(str(int(g)) for g in add)
        for table in PER_GAME:
            if table not in wt_tables:
                continue                    # vanha skeema: taulua ei vielä ollut, vanha koodi ei sitä lue
            cols_wt = [r[0] for r in wt.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table}'").fetchall()]
            cols_cur = {r[0] for r in cur.execute(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table}'").fetchall()}
            cols = [c for c in cols_wt if c in cols_cur]
            if "season" not in cols or "game_id" not in cols:
                continue
            df = cur.execute(f"SELECT {', '.join(cols)} FROM {table} WHERE season = {SEASON} AND game_id IN ({ids})").df()
            wt.execute(f"DELETE FROM {table} WHERE season = {SEASON} AND game_id IN ({ids})")
            if not df.empty:
                wt.register("add_df", df)
                wt.execute(f"INSERT INTO {table} ({', '.join(cols)}) SELECT {', '.join(cols)} FROM add_df")
                wt.unregister("add_df")
        return len(add)
    finally:
        cur.close()
        wt.close()


def rebuild(day: str, code: str, db_commit: str, n_played: int, keep: bool = False) -> dict:
    tmp = Path(tempfile.mkdtemp(prefix=f"rebuild-{day}-"))
    wt = tmp / "wt"
    git("worktree", "add", "--detach", "--quiet", str(wt), code)
    try:
        (wt / "data").mkdir(exist_ok=True)
        with (wt / "data" / "liiga.duckdb").open("wb") as fh:
            subprocess.run(["git", "show", f"{db_commit}:data/liiga.duckdb"], cwd=ROOT, stdout=fh, check=True)
        added = advance(wt / "data" / "liiga.duckdb", n_played)
        p = subprocess.run([sys.executable, "-c", RUN], cwd=wt, capture_output=True, text=True,
                           env={"PYTHONPATH": str(wt / "src"), "PATH": "/usr/bin:/bin", "HOME": str(Path.home())})
        line = next((ln for ln in p.stdout.splitlines() if ln.startswith("@@")), None)
        if line is None:
            raise RuntimeError(f"{day}: ajo epäonnistui: {(p.stderr or p.stdout).strip().splitlines()[-1:]}")
        out = json.loads(line[2:])
        out.update(added=added, code=code[:9], db=db_commit[:9])
        if (out.get("line") or {}).get("line_likely") is None and (wt / "_sim_input.pkl").exists():
            out["line"] = derived_line(wt, out["position"])
        return out
    finally:
        if not keep:
            git("worktree", "remove", "--force", str(wt))
            shutil.rmtree(tmp, ignore_errors=True)


def derived_line(wt: Path, position: list[dict]) -> dict | None:
    """Pisteraja samasta simulaatiosta nykykoodilla -- vain jos jakauma toistuu täsmälleen."""
    p = subprocess.run([sys.executable, "-c", LINE_RUN, str(wt / "_sim_input.pkl"), str(wt / "data" / "liiga.duckdb")],
                       cwd=ROOT, capture_output=True, text=True,
                       env={"PYTHONPATH": str(ROOT / "src"), "PATH": "/usr/bin:/bin", "HOME": str(Path.home())})
    line = next((ln for ln in p.stdout.splitlines() if ln.startswith("@@")), None)
    if line is None:
        return None
    now = json.loads(line[2:])
    a = pd.DataFrame(position).set_index("team")[RANKS].sort_index()
    b = pd.DataFrame(now["position"]).set_index("team")[RANKS].reindex(a.index)
    if float((a - b).abs().max().max()) > 1e-12:
        return None                     # eri simulaatio: rajaa ei johdeta
    ln = now["line"] or {}
    return {"line_rank": ln.get("rank"), "line_likely": ln.get("likely"), "line_safe": ln.get("safe")}


def compare(out: dict, hist: pd.DataFrame, dist: pd.DataFrame | None) -> dict:
    st = pd.DataFrame(out["standings"]).merge(hist, on="team", suffixes=("", "_true"))
    res = {"n_played": out["n_played"], "n_true": int(hist.games_played.iloc[0]),
           "max_points_diff": float((st.mean_points - st.mean_points_true).abs().max()),
           "rank_mismatch": int((st.proj_rank != st.proj_rank_true).sum())}
    if dist is not None:
        pos = pd.DataFrame(out["position"]).set_index("team")[RANKS]
        d = dist.set_index("team")[RANKS].reindex(pos.index)
        res["max_cell_diff_pp"] = float((pos - d).abs().max().max() * 100)
    res["ok"] = res["n_played"] == res["n_true"] and res["max_points_diff"] <= TOLERANCE and res["rank_mismatch"] == 0
    return res


def pilot() -> None:
    for day in PILOT:
        n, hist, dist = truth(day)
        own_db = commit_before(run_time(day) + dt.timedelta(hours=16), "data/liiga.duckdb")   # D:n oma versio
        prev_db = git("rev-list", "-1", f"{own_db}~1", "--", "data/liiga.duckdb")               # sitä edellinen
        code = own_db                                                                            # D:n ajon koodi
        out = rebuild(day, code, prev_db, n)
        print(day, json.dumps({**compare(out, hist, dist), "added_games": out["added"], "code": out["code"], "db": out["db"]}))


def missing_days() -> list[str]:
    """Kauden päivät (pelattu > 0), joilta prediction_history on mutta jakauma puuttuu; ei tätä päivää."""
    con = duckdb.connect(str(DB), read_only=True)
    try:
        today = str(con.execute("SELECT updated_at FROM prediction_meta").fetchone()[0])[:10]
        return [r[0] for r in con.execute(f"""
            SELECT DISTINCT CAST(snapshot_date AS VARCHAR) AS d FROM prediction_history
            WHERE games_played > 0 AND CAST(snapshot_date AS VARCHAR) < ?
              AND CAST(snapshot_date AS VARCHAR) NOT IN (SELECT CAST(snapshot_date AS VARCHAR) FROM {TABLE})
            ORDER BY d""", [today]).fetchall()]
    finally:
        con.close()


def line_days() -> list[str]:
    """Kelaimen päivät, joilta raja puuttuu (6.11.: tarvittavat pisteet kelattaessa)."""
    con = duckdb.connect(str(DB), read_only=True)
    try:
        today = str(con.execute("SELECT updated_at FROM prediction_meta").fetchone()[0])[:10]
        try:
            have = {r[0] for r in con.execute(f"SELECT CAST(snapshot_date AS VARCHAR) FROM {LINES}").fetchall()}
        except duckdb.Error:
            have = set()
        days = [r[0] for r in con.execute(f"SELECT DISTINCT CAST(snapshot_date AS VARCHAR) AS d FROM {TABLE} "
                                          "WHERE games_played > 0 ORDER BY d").fetchall()]
        return [d for d in days if d < today and d not in have]
    finally:
        con.close()


def write_line(day: str, out: dict) -> bool:
    """Raja kantaan; False jos sen päivän koodi ei vielä laskenut rajaa."""
    line = out.get("line") or {}
    if line.get("line_likely") is None:
        return False
    row = pd.DataFrame([{"snapshot_date": day, "games_played": out["n_played"], **line}])
    con = duckdb.connect(str(DB))
    try:
        con.register("line_df", row)
        con.execute(f"CREATE TABLE IF NOT EXISTS {LINES} AS SELECT * FROM line_df WHERE FALSE")
        con.execute(f"DELETE FROM {LINES} WHERE CAST(snapshot_date AS VARCHAR) = ?", [day])
        con.execute(f"INSERT INTO {LINES} SELECT * FROM line_df")
    finally:
        con.close()
    return True


def candidates(day: str) -> list[str]:
    """Aamuajon koodi ensin, sitten saman päivän myöhemmät commitit (iltaisin tehty käsiajo)."""
    morning = commit_before(run_time(day))
    end = dt.datetime.fromisoformat(f"{day}T23:59:59").replace(tzinfo=HEL).astimezone(dt.UTC)
    later = git("rev-list", "--reverse", f"--after={run_time(day).isoformat()}", f"--before={end.isoformat()}", "main").split()
    return [morning, *later]


def verified(day: str) -> tuple[dict, dict] | None:
    """Ensimmäinen ehdokaskoodi, jonka tulos osuu prediction_historyyn toleranssin sisällä."""
    n, hist, dist = truth(day)
    last = None
    for code in candidates(day):
        ts = dt.datetime.fromisoformat(git("show", "-s", "--format=%cI", code))
        db_commit = commit_before(ts + dt.timedelta(seconds=1), "data/liiga.duckdb")
        try:
            out = rebuild(day, code, db_commit, n)
        except (RuntimeError, SystemExit) as exc:
            last = {"error": str(exc)[:200], "code": code[:9]}
            continue
        cmp = compare(out, hist, dist)
        last = {**cmp, "code": out["code"], "db": out["db"], "added_games": out["added"]}
        if cmp["ok"]:
            return out, last
    print(day, "EI TODENNETTU", json.dumps(last))
    return None


def write(day: str, out: dict, info: dict) -> None:
    pos = pd.DataFrame(out["position"])[["team", *RANKS]]
    pos.insert(0, "snapshot_date", day)
    pos.insert(1, "games_played", out["n_played"])
    log = pd.DataFrame([{"snapshot_date": day, "code_commit": info["code"], "db_commit": info["db"],
                         "added_games": info["added_games"], "max_points_diff": info["max_points_diff"],
                         "rebuilt_at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds")}])
    con = duckdb.connect(str(DB))
    try:
        con.register("pos_df", pos)
        con.execute(f"DELETE FROM {TABLE} WHERE CAST(snapshot_date AS VARCHAR) = ?", [day])
        con.execute(f"INSERT INTO {TABLE} SELECT * FROM pos_df")
        con.register("log_df", log)
        con.execute(f"CREATE TABLE IF NOT EXISTS {LOG} AS SELECT * FROM log_df WHERE FALSE")
        con.execute(f"DELETE FROM {LOG} WHERE snapshot_date = ?", [day])
        con.execute(f"INSERT INTO {LOG} SELECT * FROM log_df")
    finally:
        con.close()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pilot", action="store_true")
    ap.add_argument("--dates", nargs="*")
    ap.add_argument("--missing", action="store_true", help="kaikki puuttuvat kauden päivät")
    ap.add_argument("--write", action="store_true", help="kirjoita todennetut päivät kantaan")
    ap.add_argument("--lines", action="store_true", help="kelaimen päivien pisterajat (todennettu ajo)")
    a = ap.parse_args()
    if a.pilot:
        pilot()
        return
    if a.lines:
        days, wrote, old_code = line_days(), 0, 0
        for day in days:
            got = verified(day)
            if got is None:
                continue
            out, info = got
            if not a.write:
                print(day, "OK", json.dumps(out.get("line")))
            elif write_line(day, out):
                wrote += 1
            else:
                old_code += 1
        print(f"rajat: {len(days)} päivää, kirjoitettu {wrote}, sen päivän koodi ei laskenut rajaa {old_code}")
        return
    days = missing_days() if a.missing else (a.dates or [])
    ok = 0
    for day in days:
        got = verified(day)
        if got is None:
            continue
        out, info = got
        ok += 1
        print(day, "OK", json.dumps(info))
        if a.write:
            write(day, out, info)
    print(f"{ok}/{len(days)} päivää todennettu{' ja kirjoitettu' if a.write else ' (ei kirjoitettu)'}")


if __name__ == "__main__":
    main()
