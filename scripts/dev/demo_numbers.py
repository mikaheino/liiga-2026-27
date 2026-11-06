"""Demon luvut moottorilla demopäivänä (J1-demo, docs/demo_skenaario.md).

Demossa ei näytetä yhtään käsin kirjoitettua lukua: tämä laskee ne paikallisesta
kannasta samalla moottorilla kuin sovellus, Pages ja Snowflake. Snowflaken luvut
voivat erota, jos sen ennuste on eri päivältä (näkymä kertoo perustan).

    .venv/bin/python scripts/dev/demo_numbers.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "tools"))
import skenaario  # noqa: E402

PHRASE = {"avoid_relegation": "putoaa", "top10": "pudotuspeleihin", "top6": "kuuden joukkoon", "win": "voittaa runkosarjan"}


def shown(r: dict, p: float) -> float:
    return 1 - p if r["goal"] == "avoid_relegation" else p


def main() -> None:
    st = json.loads(skenaario.run_json('[{"stakes": {"days": 14}}]'))
    print(f"Ennuste {st['forecast_date']}\n\n1) Panokset (suurimmat, seuraavat 14 pv):")
    for s in sorted(st["stakes"], key=lambda x: -abs(x["top"]["delta"]))[:3]:
        t = s["top"]
        print(f"   {s['date']} {s['home']}–{s['away']}: {t['team']} {PHRASE[t['goal']]} "
              f"{100 * shown(t, t['p_home_win']):.0f} % ↔ {100 * shown(t, t['p_away_win']):.0f} % "
              f"(nyt {100 * shown(t, t['p_now']):.0f} %)")
    sc = [{"team": "HPK", "result": "loss", "from": "2026-12-20", "until": "2027-01-06"},
          {"team": "Jokerit", "result": "win", "games": 3}]
    r = json.loads(skenaario.run_json(json.dumps(sc)))
    print(f"\n2) 'HPK häviää kaikki ottelunsa joulun yli ja Jokerit voittaa seuraavat kolme' "
          f"({len(r['scenario_canonical'])} sirua, uskottavuus {100 * r['plausibility']:.1f} %, sha {r['scenario_sha']}):")
    for t in r["teams"]:
        if t["team"] in ("HPK", "Jokerit", "KooKoo"):
            print(f"   {t['team']}: putoaa {100 * t['p_relegation_now']:.1f} % -> {100 * t['p_relegation_scenario']:.1f} %")
    hpk_only = [i for i in r["scenario_canonical"] if "Jokerit voittaa" not in i["label"] or "HPK" in i["label"]]
    r2 = json.loads(skenaario.run_json(json.dumps([{k: v for k, v in i.items() if k != "label"} for i in hpk_only])))
    print("\n3) Siru pois (Jokerien voitot), uusi laskenta ilman agenttia:")
    for t in r2["teams"]:
        if t["team"] in ("HPK", "Jokerit"):
            print(f"   {t['team']}: putoaa {100 * t['p_relegation_now']:.1f} % -> {100 * t['p_relegation_scenario']:.1f} %")


if __name__ == "__main__":
    main()
