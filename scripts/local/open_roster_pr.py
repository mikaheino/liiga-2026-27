"""Rosterityön PR (23.11.2026, katselmointi): ainoa tapa, jolla rosteriagentti (control plane liiga-rosteri) vie
muutokset gitiin. Agentilla ei ole vapaita git- tai gh-komentoja; tämä skripti tekee kaiken kiinteästi:

    .venv/bin/python scripts/local/open_roster_pr.py --title "Rosteri: ..." --body "lisätyt pelaajat, lähteet ..."

  - haara roster/<päivä>[-n] (Helsinki), ei käyttäjän antamaa haaran nimeä eikä refspeciä (':' hylätään)
  - vain sallitut tiedostot (ROSTER_FILES); muu muutos työhakemistossa -> kieltäytyy, ei committia
  - push vain tähän haaraan, ei koskaan mainiin; PR: gh pr create --base main. Ei yhdistämistä.
  - lopuksi takaisin lähtöhaaraan (main), muutokset ovat PR-haarassa
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
ROSTER_FILES = {"data/transfers_2026_27.txt", "data/rosters_2026_27.csv", "data/external_players.csv",
                "data/external_raw.txt", "data/external_returnees_raw.txt", "data/goalies_raw.txt",
                "data/roster_impact.csv", "data/preseason_player_rates.csv"}
MAX_TEXT = 4000


def git(*args: str, check: bool = True) -> str:
    r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=False)
    if check and r.returncode:
        raise SystemExit(f"git {' '.join(args)}: {r.stderr.strip()[:500]}")
    return r.stdout


def changed() -> list[str]:
    out = []
    for line in git("status", "--porcelain").splitlines():
        path = line[3:].split(" -> ")[-1].strip().strip('"')
        out.append(path)
    return out


def branch_name(existing: set[str], today: str) -> str:
    name, n = f"roster/{today}", 1
    while name in existing:
        n += 1
        name = f"roster/{today}-{n}"
    return name


def check_files(paths: list[str]) -> tuple[list[str], list[str]]:
    """(roster-tiedostot, muut). Muut eivät saa kuulua committiin; ne estävät PR:n, jos ne ovat seurattuja."""
    ok = [p for p in paths if p in ROSTER_FILES]
    return ok, [p for p in paths if p not in ROSTER_FILES]


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--title", required=True)
    ap.add_argument("--body", required=True)
    a = ap.parse_args(argv)
    if any(len(t) > MAX_TEXT for t in (a.title, a.body)) or "\0" in a.title + a.body:
        print("otsikko tai kuvaus liian pitkä", file=sys.stderr)
        return 2
    start = git("rev-parse", "--abbrev-ref", "HEAD").strip()
    if start != "main":
        print(f"aja mainista (nyt {start})", file=sys.stderr)
        return 2
    roster, other = check_files(changed())
    tracked_other = [p for p in other if git("ls-files", "--error-unmatch", p, check=False).strip()]
    if not roster:
        print("ei rosterimuutoksia: ei haaraa eikä PR:ää")
        return 0
    if tracked_other:
        print(f"muita muutettuja tiedostoja, ei PR:ää: {tracked_other}", file=sys.stderr)
        return 2
    today = datetime.now(ZoneInfo("Europe/Helsinki")).strftime("%Y-%m-%d")
    remote = {ln.split("refs/heads/")[-1] for ln in git("ls-remote", "--heads", "origin", "roster/*").splitlines()}
    local = set(git("branch", "--list", "roster/*", "--format=%(refname:short)").split())
    name = branch_name(remote | local, today)
    if ":" in name or not name.startswith("roster/"):
        raise SystemExit("virheellinen haara")
    git("checkout", "-q", "-b", name)
    try:
        git("add", "--", *roster)
        git("commit", "-q", "-m", a.title, "-m", a.body)
        git("push", "-q", "-u", "origin", f"refs/heads/{name}")
        r = subprocess.run(["gh", "pr", "create", "--base", "main", "--head", name, "--title", a.title, "--body", a.body],
                           cwd=ROOT, capture_output=True, text=True, check=False)
        if r.returncode:
            print(f"haara {name} työnnetty, PR:n avaus epäonnistui: {r.stderr.strip()[:500]}", file=sys.stderr)
            return 1
        print(r.stdout.strip())
        return 0
    finally:
        git("checkout", "-q", start)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
