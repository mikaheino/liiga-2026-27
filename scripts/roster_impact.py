"""Kirjanpito rosterimuutosten vaikutuksesta joukkueiden aloituspisteisiin.

Jokainen committoitu versio tiedostosta data/transfers_2026_27.txt ajetaan
esikauden ennusteen läpi (refresh_standings: kaikki 544 ottelua nollasta,
esikauden Elo, siemen 42), ja KAIKKI MUU pidetään samana -- nykyinen koodi,
nykyiset tilastotiedostot ja tietokanta. Erot versioiden välillä ovat siis
pelkkää rosteria, eivät kauden aikana korjattuja bugeja tai pelattuja
otteluita.

Kirjoittaa:
    docs/roster_impact.md   luettava raportti: pisteet per versio, muutokset
                            vaiheittain ja ketkä lisättiin / poistettiin
    data/roster_impact.csv  sama data koneluettavana

Lähtötaso on viimeisin rosteriversio ennen ensimmäistä julkaistua
esikauden ennustetta (prediction_history, games_played = 0) -- se roster
jolla 1.9.2026 ennuste tehtiin.

Aja jokaisen committoidun rosterierän jälkeen:
    python scripts/roster_impact.py

Ajo tehdään erillisessä git worktreessä, joten oikea tietokanta ei muutu.
Koska jokainen versio lasketaan nykyisellä koodilla, vanhojenkin versioiden
luvut voivat liikkua hieman jos malli muuttuu -- se on tarkoitus: vertailu
on aina samalla mittatikulla.
"""
from __future__ import annotations

import csv
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TRANSFERS = "data/transfers_2026_27.txt"
COPY = ["data/liiga.duckdb", "data/external_players.csv",
        "data/goalies_raw.txt", "data/league_factors.csv"]
PY = sys.executable

RUN_ONE = r'''
import sys, json, contextlib, io
sys.path.insert(0, "src"); sys.path.insert(0, "scripts")
from liiga.transfers import build_rosters_from_article
from liiga.players import build_player_rates
from liiga.config import project_root
import refresh_standings, duckdb
from pathlib import Path
# Ajon pitää osua työkopioon eikä oikeaan repoon. resolve(): macOS:n /var on
# symlinkki /private/var:iin, ja raaka merkkijonovertailu hylkäsi oikean polun.
assert Path(project_root()).resolve() == Path(sys.argv[1]).resolve(), project_root()
with contextlib.redirect_stdout(io.StringIO()):
    build_rosters_from_article(); build_player_rates()
    refresh_standings.main(sync=False)
c = duckdb.connect("data/liiga.duckdb", read_only=True)
pts = {t: p for t, p in c.execute(
    "select team, mean_points from standings_2026_27").fetchall()}
ros = c.execute("""select team, trim(coalesce(first_name,'') || ' ' ||
                   coalesce(last_name,'')), position_group
                   from roster_2026_27""").fetchall()
print(json.dumps({"points": pts, "roster": ros}))
'''


def git(*args: str) -> str:
    return subprocess.run(["git", "-C", str(ROOT), *args], check=True,
                          capture_output=True, text=True).stdout


def versions() -> list[dict]:
    """Rosteriversiot vanhimmasta uusimpaan, lähtötasosta alkaen."""
    rows = []
    for line in git("log", "--reverse", "--format=%h|%cI|%s", "--",
                    TRANSFERS).splitlines():
        sha, when, subj = line.split("|", 2)
        rows.append({"sha": sha, "date": when[:10], "subject": subj})
    import duckdb
    con = duckdb.connect(str(ROOT / "data/liiga.duckdb"), read_only=True)
    try:
        pre = con.execute("""SELECT MAX(snapshot_date) FROM prediction_history
                             WHERE games_played = 0""").fetchone()[0]
    finally:
        con.close()
    pre = str(pre)[:10] if pre else None
    if pre:
        before = [i for i, r in enumerate(rows) if r["date"] <= pre]
        rows = rows[before[-1]:] if before else rows
    return rows


def run(vs: list[dict]) -> list[dict]:
    wt = Path(tempfile.mkdtemp(prefix="roster_impact_")) / "wt"
    git("worktree", "add", "--detach", str(wt), "HEAD")
    try:
        for f in COPY:
            shutil.copy2(ROOT / f, wt / f)
        for v in vs:
            (wt / TRANSFERS).write_text(git("show", f"{v['sha']}:{TRANSFERS}"),
                                        encoding="utf-8")
            out = subprocess.run([PY, "-c", RUN_ONE, str(wt)], cwd=wt,
                                 capture_output=True, text=True)
            if out.returncode:
                raise RuntimeError(f"{v['sha']}: {out.stderr.strip()[-400:]}")
            v.update(json.loads(out.stdout.strip().splitlines()[-1]))
            print(f"  {v['sha']} {v['date']}  roster {len(v['roster'])}")
    finally:
        git("worktree", "remove", "--force", str(wt))
        shutil.rmtree(wt.parent, ignore_errors=True)
    return vs


def _fi(x: float, sign: bool = False) -> str:
    if abs(x) < 0.05:
        x = 0.0
    s = f"{x:+.1f}" if sign and x else f"{x:.1f}"
    return s.replace("-", "−").replace(".", ",")


def _d(iso: str) -> str:
    y, m, d = iso.split("-")
    return f"{int(d)}.{int(m)}.{y}"


def write(vs: list[dict]) -> None:
    teams = sorted(vs[0]["points"], key=lambda t: vs[-1]["points"][t]
                   - vs[0]["points"][t], reverse=True)

    with open(ROOT / "data/roster_impact.csv", "w", newline="",
              encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["version", "commit", "date", "team", "points",
                    "change_from_previous", "change_from_baseline"])
        for i, v in enumerate(vs):
            for t in teams:
                p = v["points"][t]
                w.writerow([i, v["sha"], v["date"], t, round(p, 2),
                            round(p - vs[i - 1]["points"][t], 2) if i else 0.0,
                            round(p - vs[0]["points"][t], 2)])

    L = ["# Rosterimuutosten vaikutus aloituspisteisiin", "",
         "*Generoitu: `python scripts/roster_impact.py` — älä muokkaa käsin.*",
         "",
         "Esikauden ennuste (kaikki 544 ottelua, esikauden Elo) laskettuna "
         "jokaisella committoidulla rosteriversiolla. Kaikki muu pidetään "
         "samana, joten luvut kertovat pelkän rosterin vaikutuksen. "
         "Pisteiden summa on joka versiossa sama: kun joku vahvistuu, muut "
         "menettävät vähän, siksi muuttumattomillakin joukkueilla on pieni "
         "miinus.", "",
         f"Lähtötaso on **{_d(vs[0]['date'])}** ({vs[0]['sha']}), roster jolla "
         "kauden ensimmäinen ennuste tehtiin.", "",
         "## Pisteet versioittain", ""]
    head = "| joukkue | " + " | ".join(_d(v["date"]) for v in vs) + \
           " | muutos yhteensä |"
    L += [head, "|---|" + "---:|" * (len(vs) + 1)]
    for t in teams:
        cells = [_fi(v["points"][t]) for v in vs]
        tot = vs[-1]["points"][t] - vs[0]["points"][t]
        L.append(f"| {t} | " + " | ".join(cells) + f" | **{_fi(tot, True)}** |")
    L += ["", "## Vaiheittain", ""]
    for i in range(1, len(vs)):
        a, b = vs[i - 1], vs[i]
        L += [f"### {_d(b['date'])} — {b['subject']}", "",
              f"Commit `{b['sha']}`, roster {len(a['roster'])} → "
              f"{len(b['roster'])}.", ""]
        old = {(t, n) for t, n, _ in a["roster"]}
        new = {(t, n) for t, n, _ in b["roster"]}
        moved = sorted(teams, key=lambda t: b["points"][t] - a["points"][t],
                       reverse=True)
        L += ["| joukkue | muutos | lisätty | poistettu |", "|---|---:|---|---|"]
        for t in moved:
            add = sorted(n for tt, n in new - old if tt == t)
            rem = sorted(n for tt, n in old - new if tt == t)
            diff = b["points"][t] - a["points"][t]
            if add or rem or abs(diff) >= 0.5:
                L.append(f"| {t} | {_fi(diff, True)} | {', '.join(add) or '–'} "
                         f"| {', '.join(rem) or '–'} |")
        L += ["", "*Rivit näytetään joukkueille joiden rosteri muuttui tai joiden "
              "pisteet liikkuivat vähintään 0,5.*", ""]
    (ROOT / "docs/roster_impact.md").write_text("\n".join(L) + "\n",
                                                encoding="utf-8")


def main() -> None:
    vs = versions()
    print(f"{len(vs)} rosteriversiota, lähtötaso {vs[0]['sha']} {vs[0]['date']}")
    write(run(vs))
    print("kirjoitettu docs/roster_impact.md ja data/roster_impact.csv")


if __name__ == "__main__":
    main()
