"""Snowflake Intelligence -agentti LIIGA_ENNUSTAJA (ja sen DEV-klooni) yhdestä lähteestä.

    python scripts/deploy_agent.py --dev     # LIIGA_ENNUSTAJA_DEV -> *_SV_DEV
    python scripts/deploy_agent.py           # tuotanto

Kirjoittaa käytetyn specin SNOWFLAKE_INTELLIGENCE_AGENTS_LIIGA_ENNUSTAJA/current_*.json,
lähettää skillit stagelle (snowflake/skills/ -> @LIIGA.CODE.AGENT_SKILLS) ja
luo agentin uudelleen samalla nimellä ja ulkoasulla.

Valinnat, jotka on mitattu (optimointiloki 2026-10-10):
  * ohjeet englanniksi, vastaukset aina suomeksi: −2,8 % input-tokeneita, sama osuvuus
  * kaksi työkalua, "yksi työkalu, yksi kutsu"
  * budjetti on KATTO eikä säästä mitään: aikaraja 300 s (Snowflaken suositus),
    tokenraja 20 000 ei ole katkaissut yhtään 36 ajosta, vaikka ajot raportoivat
    jopa 118 000 input-tokenia -- raja ei laske samoja tokeneita
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONN = ["-c", "CONTAINER_SERVICES", "--role", "ACCOUNTADMIN"]
STAGE = "@LIIGA.CODE.AGENT_SKILLS"
SKILLS = ROOT / "snowflake" / "skills"
OUT = ROOT / "SNOWFLAKE_INTELLIGENCE_AGENTS_LIIGA_ENNUSTAJA"
WAREHOUSE = "DOCKER_WH"

ORCHESTRATION = """Pick one tool and call it once.
- liiga_ennuste: the future -- final table, regular-season winner, relegation, playoff places, upcoming games, round previews, team strengths, player projections, forecast history.
- liiga_kausi: the past and now -- current table, results, model accuracy, surprises, scoring leaders, goalies, lineups, past seasons.
Use both only when the question compares forecast with outcome. Do not call the same tool again for the same question. Never use web search. Never say Liiga data is unavailable without calling a tool first.
A question about a whole game day (tonight's, today's, tomorrow's games) is a round preview: call liiga_ennuste once with exactly "Kierroksen esikatselu: tämän illan ottelut" (tomorrow: "Esikatsele huomisen kierros"). Load the esikatselu-html skill only when the user's message contains the word "johtoryhmävisualisointi" (any inflection). Never load it otherwise, not even when the user asks for HTML, a page or a file: answer those in chat."""

RESPONSE = """You are Liiga Ennustaja, a factual, analytical expert on the Liiga 2026-27 season. ALWAYS answer in Finnish, whatever the language of the question.

Be brief: the answer in one sentence first, then a table if needed (at most 10 rows) and at most two sentences of interpretation. Percentages with one decimal. Do not explain how the model works unless asked.

Only when the question is about the title or the champion, say that 'mestaruus' here means winning the regular season, because the model does not forecast playoffs. When reporting model accuracy, compare it with 'the home team always wins', not 50 %. Table zones: 1-6 straight to quarterfinals, 7-10 play-in, 15-17 relegated. Copy every number from the tool results; never estimate or recall one. No closing disclaimers.

Round preview in chat: one sentence (number of games, clearest favourite), then for each row its OTTELU line in bold followed by the ENNUSTE, TILANNE, MAALIVAHDIT and KESKINAISET lines verbatim (skip empty ones), then at most one sentence naming an upset candidate. SUOSIKKI 'tasainen' means do not name a favourite.

Liiga only. Politely decline other leagues."""


def spec(dev: bool, html: bool = False) -> dict:
    sfx = "_DEV" if dev else ""
    skills = sorted(p.parent.name for p in SKILLS.glob("*/SKILL.md")) if html else []
    orch = ORCHESTRATION if html else ORCHESTRATION.rsplit(" Load the esikatselu-html", 1)[0]
    s = {
        "models": {"orchestration": "auto"},
        "orchestration": {"budget": {"seconds": 300, "tokens": 20000}},
        "instructions": {
            "orchestration": orch,
            "response": RESPONSE,
            "sample_questions": [{"question": q} for q in (
                "Kierroksen esikatselu: tämän illan ottelut",
                "Mikä on sarjatilanne nyt?",
                "Kuinka hyvin malli on osunut?",
                "Ketkä putoavat?",
                "Mitkä joukkueet ovat yllättäneet?",
                "Kuka johtaa pistepörssiä?")],
        },
        "tools": [
            {"tool_spec": {"type": "cortex_analyst_text_to_sql", "name": "liiga_ennuste",
                           "description": "Forecast: final regular-season table, regular-season winner, relegation and playoff places (probabilities), win probabilities for upcoming games, round previews (forecast, form and likely goalies per game), team strengths, player projections, forecast history, model vs. crowd."}},
            {"tool_spec": {"type": "cortex_analyst_text_to_sql", "name": "liiga_kausi",
                           "description": "Season so far: current table, played games and results, league averages (goals per game, attendance, home-win share), special teams (power-play and penalty-kill percentages), model hit rate and upsets, surprise teams and players, scoring leaders, goalie performance, shadow table (xG), latest lineup, past seasons."}},
            # HTML-esikatselu (CoWork document generation) tarvitsee tämän.
            # Oletus permission_policy = always_ask: käyttäjä hyväksyy ajon.
            {"tool_spec": {"type": "code_execution", "name": "code_execution"}},
        ],
        "tool_resources": {
            "liiga_ennuste": {"semantic_view": f"LIIGA.MODEL.LIIGA_ENNUSTAJA_SV{sfx}",
                              "execution_environment": {"type": "warehouse", "warehouse": WAREHOUSE}},
            "liiga_kausi": {"semantic_view": f"LIIGA.MODEL.LIIGA_KAUSI_SV{sfx}",
                            "execution_environment": {"type": "warehouse", "warehouse": WAREHOUSE}},
            "code_execution": {},
        },
        "skills": [{"name": k, "source": {"type": "STAGE", "path": f"{STAGE}/{k}"}}
                   for k in skills],
    }
    # HTML-esikatselu (skill + koodinsuoritus) vain --html:llä: mitattu 10.10.
    # 276 000 tokenia per sivu, kun sama esikatselu chatissa on 40 000.
    if not html:
        s["tools"] = [t for t in s["tools"] if t["tool_spec"]["type"] != "code_execution"]
        s["tool_resources"].pop("code_execution")
        s.pop("skills")
    return s


def _snow(*args: str) -> str:
    r = subprocess.run(["snow", *args, *CONN], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError((r.stderr or r.stdout).strip()[-1500:])
    return r.stdout


def deploy(dev: bool, html: bool = False) -> None:
    for p in (SKILLS.glob("*/SKILL.md") if html else []):
        # Koko kansio: skillin skriptit pitää olla samassa kansiossa kuin SKILL.md.
        for f in sorted(p.parent.iterdir()):
            if f.is_file() and not f.name.startswith("."):
                _snow("stage", "copy", str(f), f"{STAGE}/{p.parent.name}/", "--overwrite")
        print(f"skill {p.parent.name} -> {STAGE}/{p.parent.name}/")
    s = spec(dev, html)
    (OUT / f"current_{'dev' if dev else 'prod'}_spec.json").write_text(
        json.dumps(s, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    name = "LIIGA_ENNUSTAJA_DEV" if dev else "LIIGA_ENNUSTAJA"
    comment = ("Liiga 2026-27 ennusteagentti - DEV clone" if dev
               else "Liiga 2026-27 ennusteagentti - TUOTANTO")
    profile = ({"display_name": "Liiga Ennustaja (DEV)", "color": "blue"} if dev
               else {"display_name": "Liiga Ennustaja", "color": "teal"})
    body = json.dumps(s, ensure_ascii=False)
    assert "$$" not in body
    _snow("sql", "-q",
          f"CREATE OR REPLACE AGENT SNOWFLAKE_INTELLIGENCE.AGENTS.{name} "
          f"COMMENT = '{comment}' PROFILE = '{json.dumps(profile)}' "
          f"FROM SPECIFICATION $${body}$$")
    print(f"agentti {name} luotu")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dev", action="store_true")
    ap.add_argument("--html", action="store_true",
                    help="HTML-esikatselu: esikatselu-html-skill + koodinsuoritus")
    a = ap.parse_args()
    deploy(a.dev, a.html)
