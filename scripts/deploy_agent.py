"""Snowflake Intelligence -agentti LIIGA_ENNUSTAJA: versiot ja aliakset yhdestä lähteestä.

    python scripts/deploy_agent.py --alias DEV --html          # oma kokeilu (_DEV-mallit)
    python scripts/deploy_agent.py --alias STAGING --html -m "mitä muuttui"   # ehdokas (CI)
    python scripts/deploy_agent.py --promote VERSION$7         # tuotantoon (CI, hyväksytty)
    python scripts/deploy_agent.py --promote VERSION$3         # palautus = sama komento

ITEROINTI ALIAKSILLA (2026-10-16, Snowflaken "Cortex Agent versioning" -oppaan
mukaan: commit -> evaluoi nimetty versio -> siirrä production-alias):

  * Jokainen kierros on oma nimetty versio, joka luodaan suoraan stagelta
    (ALTER AGENT ... ADD VERSION FROM @stage) -- EI live-version kautta.
    Alias (DEV, STAGING) siirtyy uuteen versioon; edellinen saman aliaksen
    versio poistetaan, ellei se ole oletus. Historia = julkaisut + ehdokkaat.
  * Kutsu nimeää version: '<agentti>!DEV', '!STAGING', agent_eval --version.
    Alias tallentuu ISOILLA kirjaimilla ja on kirjainkokotarkka ('!dev' ei löydy).
  * Promootio siirtää aliaksen PRODUCTION ja DEFAULT_VERSIONin TÄSMÄLLEEN siihen
    versioon, joka evaluoitiin. Ei uutta committia, ei uutta evaluoitavaa.
  * Agentilla EI ole live-versiota. Mitattu 16.10.: kun live-versio on
    olemassa, päätteetön kutsu ja CoWork käyttävät SITÄ eivätkä oletusversiota
    (vastoin dokumentaatiota, myös eksplisiittisellä DEFAULT_VERSIONilla). Ilman
    live-versiota päätteetön kutsu seuraa DEFAULT_VERSIONia. Lisäksi ADD VERSION
    FROM @stage kieltäytyy, jos live-versio on olemassa. Siksi live-versio
    (esim. Snowsightin luonnos) commitoidaan pois ennen jokaista julkaisua.
  * Skillit ja spec kiinnitetään: @LIIGA.CODE.AGENT_SKILLS/<git-sha>/. Vanhaa
    kansiota ei ylikirjoiteta, joten vanha versio toimii vanhalla koodilla.
    DEV käyttää kansiota dev/ ja _DEV-malleja, eli se on tarkoituksella muuttuva.

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

Tool selection -- one tool, one call (the only exception: a morning brief request that lists its own steps):
- liiga_ennuste: the future (final table, zones, upcoming games and their 1X2, round previews, strengths, player projections, forecast history) and WHY a forecast changed.
- liiga_kausi: the past and now (table, results, model accuracy, surprises, scoring, goalies, special teams, past seasons).
- liiga_skenaario: what if (locked results), injuries or absences of named players for any period, and what a team needs (stay up, top 6, top 10, win).
- liiga_kokoonpanot: today's or tomorrow's published lineups, starting goalies, absences, lineup-corrected 1X2, fair odds and betting questions.
- liiga_tieto: how the model works, measured findings (backtests, home advantage, xG, 40 minutes, goalies), limitations (what the model cannot know) and data sources. Never answer these from table columns or memory.
- Two tools only when comparing forecast with outcome, or when a current number needs its meaning from liiga_tieto (e.g. "is the home advantage bigger than the model assumes": liiga_kausi + liiga_tieto). Never use web search.

Workflows:
- A whole game day is a round preview: liiga_ennuste once with exactly "Kierroksen esikatselu: tämän illan ottelut" (tomorrow: "Esikatsele huomisen kierros").
- Load the esikatselu-html skill only when the message contains the word "johtoryhmävisualisointi" (any inflection). HTML, page or file requests without it: the round preview in chat, plus one sentence that a page is made on request for a "johtoryhmävisualisointi".
- liiga_skenaario: follow its input schema. Convert any duration to "days" (1 kk = 30) or an "until" date; none given = rest of the season (say so). "Hidas alku" = ramp_games 3, ramp_effect 0.5. "Pysyy liigassa" = avoid_relegation. Teams named as rivals -> "rivals". Mestis teams are not in the model. SKENAARIOTA EI VOITU AJAA: say why in one sentence.
- Playoffs or champion: answer with the regular-season winner forecast (liiga_ennuste); do not refuse.

Errors: never say data is unavailable without calling a tool. No rows: say so in one sentence, naming what was looked for. An error: retry once with a simpler question, then say the data could not be fetched right now."""

RESPONSE = """You are Liiga Ennustaja, a factual analyst of the Liiga 2026-27 season. ALWAYS answer in Finnish. Start directly with the answer; never write your plan or reasoning into the reply, in any language.

Be brief: the answer in one sentence, then a table if needed (at most 10 rows, or the tool's game list), at most two sentences of interpretation. Percentages with one decimal; other numbers (ratings, averages) as precise as the tool gives them; decimal comma. Copy every number from the tools; never estimate one. Do not explain how the model works unless asked. No charts unless the user asks for a chart or graph (kaavio, kuvaaja, graafi). End with "Ennuste päivitetty D.M.YYYY." when the results contain the date; no other disclaimers.

Facts: when the question is about the title, the champion or who wins the regular season, say that 'mestaruus' here means winning the regular season, because the model does not forecast playoffs. Compare model accuracy with 'the home team always wins', not 50 %. Zones: 1-6 quarterfinals, 7-10 play-in, 15-17 relegated.

Round preview: one sentence (number of games; the clearest favourite = the highest win % among the rows), then each OTTELU line in bold followed by the ENNUSTE, TILANNE, MAALIVAHDIT and KESKINAISET lines verbatim (skip empty ones), then at most one upset sentence; SUOSIKKI 'tasainen' = no favourite.

Knowledge answers (liiga_tieto): plain Finnish, at most six lines or a short list, numbers as the knowledge base gives them; say when something is a limitation of the model.

Tool answers lead with the headline number, then the tool's table. Why changed: the total, then the three parts (tulokset vs. odotus, kokoonpanot, mallin uusi arvio), largest first. What if: the biggest change. What is required: the probability now and the points for an even chance, then the pace needed at 50/80/95 % vs. the pace so far, the points line, and whether it depends on the team or its rivals (3 = regulation win, 2 = overtime win, 1 = overtime loss). Injuries and lineups: the effect on the forecast, the game table, and one sentence that player changes move only the player-based 40 % of the model (the Elo 60 % does not know who plays).

Betting (pitkäveto, veto, kertoimet): numbers, not advice. 1X2 is regulation time, which is how Pitkäveto settles; fair odds = 1 / probability; positive expected value only when the offered odds exceed the fair odds; with the user's odds compute odds x probability - 1; every extra selection multiplies the bookmaker's margin. Name the most likely selections, never tell the user to bet or suggest stakes, and say the model has not shown an edge over the market.

Other leagues: decline in one sentence. Liiga playoffs are in scope: answer with the regular-season forecast."""


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
    from deploy_tools import suffix as tool_suffix
    tsfx = tool_suffix("SIMULATE_SCENARIO", dev)
    lsfx = tool_suffix("LINEUP_FORECAST", dev)
    from deploy_knowledge import suffix as knowledge_suffix
    ksfx = knowledge_suffix(dev)
    skills = sorted(p.parent.name for p in SKILLS.glob("*/SKILL.md")) if html else []
    orch = ORCHESTRATION if html else ORCHESTRATION.rsplit(" Load the esikatselu-html", 1)[0]
    s = {
        "models": {"orchestration": "auto"},
        "orchestration": {"budget": {"seconds": 300, "tokens": 20000}},
        "instructions": {
            "orchestration": orch,
            "response": RESPONSE,
            "sample_questions": [{"question": q} for q in (
                # Demon aloituskortit CoWorkissa: yksi per ominaisuus (16.10.).
                "Kierroksen esikatselu: tämän illan ottelut",
                "Miksi KooKoon ennuste on romahtanut?",
                "Mitä vaaditaan, että KooKoo pysyy Liigassa?",
                "Mitä tapahtuu, jos Patrik Bartosak loukkaantuu kahdeksi kuukaudeksi?",
                "Mitkä ovat tämän illan 1X2-todennäköisyydet ja kokoonpanot?",
                "Kuinka hyvin malli on osunut?")],
        },
        "tools": [
            {"tool_spec": {"type": "cortex_analyst_text_to_sql", "name": "liiga_ennuste",
                           "description": "WHAT: the model's forecast for the Liiga 2026-27 regular season, refreshed every morning. DATA: final-table forecast (points, rank, 5-95 % range), probabilities of winning the regular season, top 6, play-in and relegation, win and overtime probabilities for every unplayed game, round previews with form and likely goalies, team strength ratings, player projections, forecast history, model vs. crowd, and WHY the forecast changed (split into results vs. expectation, roster changes and model revision, versus pre-season, a week ago or the previous run). USE WHEN: the question is about what will happen, or why a team's forecast rose or fell. DO NOT USE: for the current table, played results, scoring leaders, model accuracy or anything that has already happened (liiga_kausi), or for playoffs (not forecast)."}},
            {"tool_spec": {"type": "cortex_analyst_text_to_sql", "name": "liiga_kausi",
                           "description": "WHAT: what has happened in Liiga 2026-27 so far, plus past seasons 2022-26. DATA: current table (liiga.fi order), every played game and result, model accuracy per game versus the home-team baseline, upsets, surprise teams and players versus pre-season expectations, scoring leaders, goalie performance versus expectation, shadow table from expected goals (xG), league averages (goals per game, attendance, home-win share), special teams, latest played lineup per team. USE WHEN: the question is about results, standings now, players' or goalies' season, or how well the model has done. DO NOT USE: for forecasts of the final table or upcoming games, or why a forecast changed (liiga_ennuste)."}},
            {"tool_spec": {"type": "generic", "name": "liiga_skenaario",
                           "description": "WHAT: what-if, injury and what-is-required simulator. Replays the rest of the Liiga 2026-27 regular season 10,000 times with the model's own game probabilities and the published forecast's random numbers, so the difference is the scenario alone. Locks results; removes injured players from their team's ratings for a period (optionally with a slow return) and lists the team's games in that period; with a goal (avoid_relegation, top6, top10, win) reads the probability, the final points and pace needed at 50/80/95 %, the points line and how the rivals must do. USE WHEN: 'entä jos', 'mitä jos', 'jos X voittaa/häviää/loukkaantuu', 'mitä X vaatii'. DO NOT USE: for the plain forecast (liiga_ennuste), played games (liiga_kausi) or a game day's real lineups (liiga_kokoonpanot).",
                           "input_schema": {"type": "object", "properties": {
                               "scenario": {"type": "string", "description":
                                   'JSON list of locked results and/or goals, e.g. [{"team": "Ilves", "result": "win"}, {"team": "Tappara", "result": "loss", "opponent": "Lukko"}, {"team": "KooKoo", "result": "win", "games": 3}] or [{"team": "KooKoo", "goal": "avoid_relegation"}]. goal: avoid_relegation | top6 | top10 | win; optional "rivals": [team names] whose required performance to show. Injury item: {"injury": "<player name>", "days": N | "until": "YYYY-MM-DD" | "games": N, "ramp_games": N, "ramp_effect": 0-1}. team, opponent and rivals are exact team names. result: win | loss (the model draws regulation vs. overtime) | reg_win | ot_win | ot_loss | reg_loss. games: the next N games of that team (default 1).'}},
                               "required": ["scenario"]}}},
            {"tool_spec": {"type": "generic", "name": "liiga_kokoonpanot",
                           "description": "WHAT: a game day's lineups from liiga.fi (published shortly before the games) and the lineup-corrected forecast. RETURNS per game: 1X2 probabilities for regulation time before -> after the lineup correction, expected goals, fair odds 1 / X / 2, the starting goalies and the missing players that matter for the forecast. The correction uses the model's own formulas (dressed skaters, starting goalie). USE WHEN: questions about today's or tomorrow's lineups, starting goalies, absences, 1X2, odds or betting for a game day. DO NOT USE: for future dates without published lineups (liiga_ennuste) or hypothetical injuries over a period (liiga_skenaario).",
                           "input_schema": {"type": "object", "properties": {
                               "day": {"type": "string", "description": "TODAY, TOMORROW or a date YYYY-MM-DD (Finnish time)."}},
                               "required": ["day"]}}},
            {"tool_spec": {"type": "cortex_search", "name": "liiga_tieto",
                           "description": "WHAT: the project's own knowledge base, in Finnish: how the forecast model works (player rates, age curve, league factors, goaltending, Poisson match model, overtime calibration, Elo, 40/60 blend, crowd signal, simulation), measured findings (backtest accuracy, home advantage test, xG and luck, 40-minute leaders, goalies), limitations and data sources. USE WHEN: 'miten malli toimii', 'miksi malli', 'onko X tilastollisesti merkitsevä', 'mitä malli ei tiedä', 'mistä data tulee'. DO NOT USE: for current numbers (other tools)."}},
            # HTML-esikatselu (CoWork document generation) tarvitsee tämän.
            # Oletus permission_policy = always_ask: käyttäjä hyväksyy ajon.
            {"tool_spec": {"type": "code_execution", "name": "code_execution"}},
        ],
        "tool_resources": {
            "liiga_ennuste": {"semantic_view": f"LIIGA.MODEL.LIIGA_ENNUSTAJA_SV{sfx}",
                              "execution_environment": {"type": "warehouse", "warehouse": WAREHOUSE}},
            "liiga_kausi": {"semantic_view": f"LIIGA.MODEL.LIIGA_KAUSI_SV{sfx}",
                            "execution_environment": {"type": "warehouse", "warehouse": WAREHOUSE}},
            "liiga_skenaario": {"type": "procedure", "identifier": f"LIIGA.MODEL.SIMULATE_SCENARIO{tsfx}",
                                "execution_environment": {"type": "warehouse", "warehouse": WAREHOUSE}},
            "liiga_kokoonpanot": {"type": "procedure", "identifier": f"LIIGA.MODEL.LINEUP_FORECAST{lsfx}",
                                  "execution_environment": {"type": "warehouse", "warehouse": WAREHOUSE}},
            "liiga_tieto": {"search_service": f"LIIGA.MODEL.LIIGA_TIETO{ksfx}", "max_results": 6,
                            "title_column": "SECTION", "id_column": "ID"},
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


FQN = "SNOWFLAKE_INTELLIGENCE.AGENTS.LIIGA_ENNUSTAJA"
# CoWorkin profiili. Agenttitason asetus EIKÄ versioitu, joten se asetetaan vasta
# tuotantojulkaisussa (promote), ei ehdokkaassa -- muuten se muuttuisi käyttäjille
# putken ohi. Väri EI näy CoWorkissa (16.10.: #CCA752, yellow, orange ja alkuperäinen
# teal -- käyttäjä ei nähnyt yhtään), joten pidetään alkuperäinen teal.
PROFILE = {"display_name": "Liiga Ennustaja", "color": "teal"}


def _num(v: str) -> int:
    return int(v.split("$")[1])


def _retire_live(fqn: str) -> None:
    """Live-versio kaappaa päätteettömät kutsut ja CoWorkin (ks. moduulin ohje),
    ja ADD VERSION FROM @stage vaatii ettei sitä ole. Sitä ei voi pudottaa,
    joten se commitoidaan omaksi versiokseen ilman aliasta -- luonnos säilyy."""
    if any(v["name"] is None for v in _versions(fqn)):
        _snow("sql", "-q", f"ALTER AGENT {fqn} COMMIT COMMENT = "
                           "'Live-luonnos siirretty pois julkaisun tieltä (ei aliasta)'")
        print("VAROITUS: agentilla oli live-versio (Snowsight-luonnos?); commitoitu pois.")


def candidate(alias: str, html: bool = False, message: str = "", fqn: str = FQN) -> str:
    """Uusi nimetty versio stagelta + alias. Palauttaa VERSION$N."""
    alias = alias.upper()
    if alias == "PRODUCTION":
        raise SystemExit("PRODUCTION siirretään --promote:lla evaluoituun versioon.")
    dev = alias == "DEV"
    if not dev and html and not skills_clean():
        raise SystemExit("snowflake/skills/ ei ole commitattu: versio kiinnittää "
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
    (OUT / f"current_{alias.lower()}_spec.json").write_text(
        json.dumps(s, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not dev:
        for t in s["tool_resources"].values():
            sv = t.get("semantic_view")
            if sv:
                got = json.loads(_snow("sql", "--format", "json", "-q",
                                       f"SHOW SEMANTIC VIEWS LIKE '{sv.split('.')[-1]}' IN SCHEMA LIIGA.MODEL"))
                if not got:
                    raise SystemExit(f"{sv} puuttuu: aja ensin python scripts/semantic_views.py --deploy")
            svc = t.get("search_service")
            if svc:
                from deploy_knowledge import exists as svc_exists
                if not svc_exists(svc):
                    raise SystemExit(f"{svc} puuttuu: aja ensin python scripts/deploy_knowledge.py")
            proc = t.get("identifier")
            if proc:
                from deploy_tools import exists
                if not exists(proc):
                    raise SystemExit(f"{proc} puuttuu: aja ensin python scripts/deploy_tools.py")
    # Spec omaan kansioonsa: ADD VERSION FROM lukee koko kansion.
    import tempfile
    import yaml
    tmp = Path(tempfile.mkdtemp()) / "agent_spec.yaml"
    tmp.write_text(yaml.safe_dump(s, allow_unicode=True, sort_keys=False), encoding="utf-8")
    src = f"{STAGE}/{sha}/_agent/"
    _snow("stage", "copy", str(tmp), src, "--overwrite")

    before = _versions(fqn)
    if not before:
        profile = {"display_name": "Liiga Ennustaja", "color": "teal"}
        body = json.dumps(s, ensure_ascii=False)
        assert "$$" not in body
        _snow("sql", "-q", f"CREATE AGENT {fqn} COMMENT = 'Liiga 2026-27 ennusteagentti' "
                           f"PROFILE = '{json.dumps(profile)}' FROM SPECIFICATION $${body}$$")
        print("agentti luotu (VERSION$1 + live)")
    _retire_live(fqn)
    before = _versions(fqn)
    prev = [v for v in before if (v.get("alias") or "").upper() == alias]
    note = f"{sha} {alias} {message}".strip().replace("'", "")[:250]
    _snow("sql", "-q", f"ALTER AGENT {fqn} ADD VERSION FROM {src} COMMENT = '{note}'")
    new = max((v["name"] for v in _versions(fqn) if v["name"]), key=_num)
    _snow("sql", "-q", f"ALTER AGENT {fqn} MODIFY VERSION {new} SET ALIAS = {alias}")
    for v in prev:   # edellinen saman aliaksen ehdokas, jota ei julkaistu
        if v["name"] != new and v.get("is_default") != "true":
            _snow("sql", "-q", f"ALTER AGENT {fqn} DROP VERSION {v['name']}")
            print(f"poistettu {v['name']} (korvattu, ei julkaistu)")
    print(f"agentti LIIGA_ENNUSTAJA: {new} (alias {alias}) -- {note}")
    return new


def promote(target: str, fqn: str = FQN) -> str:
    """PRODUCTION-alias ja oletusversio annettuun versioon tai aliaksen versioon.
    Sama komento palauttaa vanhaan versioon."""
    _retire_live(fqn)
    vs = _versions(fqn)
    t = target.upper()
    hit = [v["name"] for v in vs if v["name"] and (v["name"].upper() == t
                                                    or (v.get("alias") or "").upper() == t)]
    if len(hit) != 1:
        raise SystemExit(f"versiota {target} ei löydy: {[(v['name'], v.get('alias')) for v in vs]}")
    new = hit[0]
    _snow("sql", "-q", f"ALTER AGENT {fqn} MODIFY VERSION {new} SET ALIAS = PRODUCTION")
    _snow("sql", "-q", f"ALTER AGENT {fqn} SET DEFAULT_VERSION = '{new}'")
    _snow("sql", "-q", f"ALTER AGENT {fqn} SET PROFILE = '{json.dumps(PROFILE, ensure_ascii=False)}'")
    after = {v["name"]: v for v in _versions(fqn)}
    ok = (after[new].get("alias") or "").upper() == "PRODUCTION" and after[new]["is_default"] == "true"
    if not ok or None in after:
        raise SystemExit(f"promootio ei näy versiolistassa: {after}")
    print(f"agentti LIIGA_ENNUSTAJA: {new} (PRODUCTION, oletus)")
    return new


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--alias", help="uusi versio tällä aliaksella: DEV (oma kokeilu) tai STAGING (CI)")
    g.add_argument("--promote", metavar="VERSIO", help="VERSION$N tai alias -> PRODUCTION + oletus")
    ap.add_argument("--html", action="store_true",
                    help="HTML-esikatselu: esikatselu-html-skill + koodinsuoritus")
    ap.add_argument("-m", "--message", default="", help="version kommentti")
    a = ap.parse_args()
    if a.promote:
        promote(a.promote)
    else:
        candidate(a.alias, a.html, a.message)
