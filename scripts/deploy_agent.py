"""Snowflake Intelligence -agentti LIIGA_ENNUSTAJA (ja sen DEV-klooni) yhdestä lähteestä.

    python scripts/deploy_agent.py --dev --html            # DEV: päivittää live-version
    python scripts/deploy_agent.py --html -m "mitä muuttui" # tuotanto: uusi VERSION$N

VERSIOINTI (2026-10-10). Aiemmin CREATE OR REPLACE AGENT pyyhki versiohistorian
joka kerta, ja skillin tiedostot ylikirjoitettiin stagella -- render.py:n vaihto
muutti tuotannon käytöstä ilman uutta versiota. Nyt:

  * tuotanto: spec live-versioon -> COMMIT (kommentissa git-commit) -> alias
    `production` uuteen versioon -> DEFAULT_VERSION siihen. Live-versiota ei
    jätetä tuotantoon, joten käytössä on aina lukittu versio.
  * skillit kiinnitetään: @LIIGA.CODE.AGENT_SKILLS/<git-sha>/<skill>/. Vanhaa
    kansiota ei ylikirjoiteta, joten vanha versio toimii vanhalla koodilla.
    Tuotantoon vienti vaatii, että snowflake/skills/ on commitattu.
  * DEV: vain live-version spec, ei commitia.
  * agentti luodaan vain jos sitä ei ole (CREATE tekee VERSION$1:n).

Palautus: ALTER AGENT ... SET DEFAULT_VERSION = 'VERSION$N' (ja alias perään).

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
import sys
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import sys as _sys
_sys.path.insert(0, str(Path(__file__).resolve().parent))
from snow_conn import conn as _conn  # noqa: E402
CONN = _conn()
STAGE = "@LIIGA.CODE.AGENT_SKILLS"
SKILLS = ROOT / "snowflake" / "skills"
OUT = ROOT / "SNOWFLAKE_INTELLIGENCE_AGENTS_LIIGA_ENNUSTAJA"
WAREHOUSE = "LIIGA_WH"   # oli DOCKER_WH; projektin oma varasto kustannusten kohdistamiseksi

ORCHESTRATION = """Scope: Liiga 2026-27 regular season, as forecast by this project's model and as played so far. Nothing else.

Tool selection -- pick one tool and call it once:
- liiga_ennuste for the future (final table, zones, upcoming games, round previews, team strengths, player projections, forecast history).
- liiga_kausi for the past and now (current table, results, model accuracy, surprises, scoring leaders, goalies, lineups, league averages, special teams, past seasons).
- Both only when the question compares forecast with outcome. Never call the same tool twice for one question. Never use web search.

Workflows:
- A whole game day (tonight's, today's, tomorrow's games) is a round preview: call liiga_ennuste once with exactly "Kierroksen esikatselu: tämän illan ottelut" (tomorrow: "Esikatsele huomisen kierros").
- Load the esikatselu-html skill only when the user's message contains the word "johtoryhmävisualisointi" (any inflection). Never otherwise. A request for HTML, a page or a file without that word: give the round preview in chat exactly as for a game day (one liiga_ennuste call), then add one sentence that a shareable page is made on request for a "johtoryhmävisualisointi".
- A question about the playoffs or the champion: call liiga_ennuste for the regular-season winner forecast and answer with it; the response explains that the model does not forecast playoffs. Do not refuse.

Errors and empty results:
- Never say Liiga data is unavailable without calling a tool first.
- If a tool returns no rows, say so in one Finnish sentence and name what was looked for (e.g. no games on that day). Do not guess and do not call another tool to compensate.
- If a tool returns an error, retry once with a simpler question; if it fails again, say the data could not be fetched right now."""

RESPONSE = """You are Liiga Ennustaja, a factual, analytical expert on the Liiga 2026-27 season. ALWAYS answer in Finnish, whatever the language of the question. Start directly with the answer: never write your plan, reasoning or what you are about to do into the reply, in any language.

Be brief: the answer in one sentence first, then a table if needed (at most 10 rows) and at most two sentences of interpretation. Percentages with one decimal, Finnish decimal comma. Do not explain how the model works unless asked.

Only when the question is about the title or the champion, say that 'mestaruus' here means winning the regular season, because the model does not forecast playoffs. When reporting model accuracy, compare it with 'the home team always wins', not 50 %. Table zones: 1-6 straight to quarterfinals, 7-10 play-in, 15-17 relegated. Copy every number from the tool results; never estimate or recall one. If the results contain a forecast or update date, end with one short line "Ennuste päivitetty D.M.YYYY." No other closing disclaimers.

Round preview in chat: one sentence (number of games, clearest favourite), then for each row its OTTELU line in bold followed by the ENNUSTE, TILANNE, MAALIVAHDIT and KESKINAISET lines verbatim (skip empty ones), then at most one sentence naming an upset candidate. SUOSIKKI 'tasainen' means do not name a favourite.

Other leagues and betting advice are out of scope: decline politely in one sentence and say what you can answer instead. Liiga playoffs are NOT out of scope: answer with the regular-season forecast as instructed."""


def git_sha() -> str:
    return subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--short", "HEAD"],
                          capture_output=True, text=True, check=True).stdout.strip()


def skills_clean() -> bool:
    r = subprocess.run(["git", "-C", str(ROOT), "status", "--porcelain", "--", "snowflake/skills"],
                       capture_output=True, text=True, check=True)
    return not r.stdout.strip()


def spec(dev: bool, html: bool = False, sha: str = "dev") -> dict:
    # Semanttiset mallit: DEV `_DEV`, tuotanto git-commitin mukaan nimetty
    # (semantic_views.sv_suffix) -- lukittu versio viittaa lukittuihin malleihin.
    if dev:
        sfx = "_DEV"
    else:
        from semantic_views import sv_sha
        sfx = "_" + sv_sha()
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
                           "description": "WHAT: the model's forecast for the Liiga 2026-27 regular season, refreshed every morning. DATA: final-table forecast (points, rank, 5-95 % range), probabilities of winning the regular season, top 6, play-in and relegation, win and overtime probabilities for every unplayed game, round previews with form and likely goalies, team strength ratings, player projections, forecast history, model vs. crowd. USE WHEN: the question is about what will happen. DO NOT USE: for the current table, played results, scoring leaders, model accuracy or anything that has already happened (liiga_kausi), or for playoffs (not forecast)."}},
            {"tool_spec": {"type": "cortex_analyst_text_to_sql", "name": "liiga_kausi",
                           "description": "WHAT: what has happened in Liiga 2026-27 so far, plus past seasons 2022-26. DATA: current table (liiga.fi order), every played game and result, model accuracy per game versus the home-team baseline, upsets, surprise teams and players versus pre-season expectations, scoring leaders, goalie performance versus expectation, shadow table from expected goals (xG), league averages (goals per game, attendance, home-win share), special teams, latest played lineup per team. USE WHEN: the question is about results, standings now, players' or goalies' season, or how well the model has done. DO NOT USE: for forecasts of the final table or upcoming games (liiga_ennuste)."}},
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
        "skills": [{"name": k, "source": {"type": "STAGE", "path": f"{STAGE}/{sha}/{k}"}}
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


def _versions(fqn: str) -> list[dict]:
    try:
        return json.loads(_snow("sql", "--format", "json", "-q", f"SHOW VERSIONS IN AGENT {fqn}"))
    except RuntimeError:
        return []


def deploy(dev: bool, html: bool = False, message: str = "") -> None:
    name = "LIIGA_ENNUSTAJA_DEV" if dev else "LIIGA_ENNUSTAJA"
    fqn = f"SNOWFLAKE_INTELLIGENCE.AGENTS.{name}"
    if not dev and html and not skills_clean():
        raise SystemExit("snowflake/skills/ ei ole commitattu: tuotantoversio kiinnittää "
                         "skillit git-committiin. Commitoi ensin.")
    sha = "dev" if dev else git_sha()
    for p in (SKILLS.glob("*/SKILL.md") if html else []):
        # Koko kansio: skillin skriptit pitää olla samassa kansiossa kuin SKILL.md.
        dest = f"{STAGE}/{sha}/{p.parent.name}/"
        for f in sorted(p.parent.iterdir()):
            if f.is_file() and not f.name.startswith("."):
                _snow("stage", "copy", str(f), dest, "--overwrite")
        print(f"skill {p.parent.name} -> {dest}")
    s = spec(dev, html, sha)
    (OUT / f"current_{'dev' if dev else 'prod'}_spec.json").write_text(
        json.dumps(s, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    body = json.dumps(s, ensure_ascii=False)
    assert "$$" not in body
    if not dev:
        for t in s["tool_resources"].values():
            sv = t.get("semantic_view")
            if sv:
                got = json.loads(_snow("sql", "--format", "json", "-q",
                                       f"SHOW SEMANTIC VIEWS LIKE '{sv.split('.')[-1]}' IN SCHEMA LIIGA.MODEL"))
                if not got:
                    raise SystemExit(f"{sv} puuttuu: aja ensin python scripts/semantic_views.py --deploy")
    versions = _versions(fqn)
    if not versions:
        comment = ("Liiga 2026-27 ennusteagentti - DEV clone" if dev
                   else "Liiga 2026-27 ennusteagentti - TUOTANTO")
        profile = ({"display_name": "Liiga Ennustaja (DEV)", "color": "blue"} if dev
                   else {"display_name": "Liiga Ennustaja", "color": "teal"})
        _snow("sql", "-q", f"CREATE AGENT {fqn} COMMENT = '{comment}' "
                           f"PROFILE = '{json.dumps(profile)}' FROM SPECIFICATION $${body}$$")
        print(f"agentti {name} luotu (VERSION$1)")
        return
    if not any(v["name"] is None for v in versions):          # ei live-versiota
        _snow("sql", "-q", f"ALTER AGENT {fqn} ADD LIVE VERSION FROM LAST")
    _snow("sql", "-q", f"ALTER AGENT {fqn} MODIFY LIVE VERSION SET SPECIFICATION = $${body}$$")
    if dev:
        print(f"agentti {name}: live-versio päivitetty")
        return
    note = f"{sha} {message}".strip().replace("'", "")
    _snow("sql", "-q", f"ALTER AGENT {fqn} COMMIT COMMENT = '{note}'")
    new = max((v["name"] for v in _versions(fqn) if v["name"]),
              key=lambda n: int(n.split("$")[1]))
    for v in _versions(fqn):
        if v["name"] and v["name"] != new and (v.get("alias") or "").lower() == "production":
            _snow("sql", "-q", f"ALTER AGENT {fqn} MODIFY VERSION {v['name']} UNSET ALIAS")
    _snow("sql", "-q", f"ALTER AGENT {fqn} MODIFY VERSION {new} SET ALIAS = production")
    _snow("sql", "-q", f"ALTER AGENT {fqn} SET DEFAULT_VERSION = '{new}'")
    print(f"agentti {name}: {new} (production, oletus) -- {note}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dev", action="store_true")
    ap.add_argument("--html", action="store_true",
                    help="HTML-esikatselu: esikatselu-html-skill + koodinsuoritus")
    ap.add_argument("-m", "--message", default="", help="tuotantoversion kommentti")
    a = ap.parse_args()
    deploy(a.dev, a.html, a.message)
