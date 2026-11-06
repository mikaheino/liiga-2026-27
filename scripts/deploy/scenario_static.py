"""Pagesin skenaariopaneeli esilaskettuna (6.11.2026, docs/claude/skenaario.md V2).

Mobiili (GitHub Pages) on agentiton eikä sillä ole /api-reittejä, joten joukkuesivun
"mitä vaaditaan" ja "entä jos voittaa seuraavat 3/5/10" lasketaan käännöksessä:
yksi tiedosto per joukkue, avaimena "<tavoite>:<putki>". Sama moottori ja sama
muoto kuin paikallisen reitin (skenaario.py --panel) ja Snowflaken MODE 'panel'.
Yksi lataus ja yksi perustaso; jokaiselle (joukkue, putki) yksi simulaatio.

    .venv/bin/python scripts/deploy/scenario_static.py <hakemisto>   # pages_build.sh
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "tools"))
import skenaario  # noqa: E402

sim = skenaario.sim


def build(con) -> dict[str, dict]:
    games, banked, published, w, snap, played = skenaario.load(con)
    teams = sorted(published)
    base = sim.simulate(games, banked, teams)
    out = {}
    for team in teams:
        panels = {}
        for streak in sim.PANEL_STREAKS:
            for goal, res in sim.panel(team, sim.PANEL_GOALS, streak, games, banked, published, w, played,
                                       base=base).items():
                panels[f"{goal}:{streak}"] = {**res, "forecastDate": str(snap)}
        out[team] = {"forecastDate": str(snap), "panels": panels}
    return out


def main(target: str) -> None:
    dest = Path(target)
    dest.mkdir(parents=True, exist_ok=True)
    con = skenaario._connect()
    try:
        files = build(con)
    finally:
        con.close()
    for team, data in files.items():
        (dest / f"{team}.json").write_text(sim.to_json(data, data["forecastDate"]))
    print(f"skenaariot: {len(files)} joukkuetta -> {dest}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(ROOT / ".pages" / "skenaario"))
