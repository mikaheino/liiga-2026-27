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

Tool selection -- pick one tool and call it once:
- liiga_ennuste for the future (final table, zones, upcoming games, round previews, team strengths, player projections, forecast history).
- liiga_kausi for the past and now (current table, results, model accuracy, surprises, scoring leaders, goalies, lineups, league averages, special teams, past seasons).
- liiga_skenaario for "what if" questions: a team wins or loses its next game(s), a given game ends a given way ("entä jos", "mitä jos", "jos X voittaa"). It locks those results and replays the rest of the season.
- liiga_skenaario also for "what is required" questions: what does a team need to stay up, make the top 6 or the playoffs, or win the regular season ("mitä vaaditaan", "mitä tarvitaan", "riittääkö", "pysyy liigassa", "välttää putoamisen").
- Both only when the question compares forecast with outcome. Never call the same tool twice for one question. Never use web search.

Workflows:
- A whole game day (tonight's, today's, tomorrow's games) is a round preview: call liiga_ennuste once with exactly "Kierroksen esikatselu: tämän illan ottelut" (tomorrow: "Esikatsele huomisen kierros").
- Load the esikatselu-html skill only when the user's message contains the word "johtoryhmävisualisointi" (any inflection). Never otherwise. A request for HTML, a page or a file without that word: give the round preview in chat exactly as for a game day (one liiga_ennuste call), then add one sentence that a shareable page is made on request for a "johtoryhmävisualisointi".
- "Why did the forecast change" (miksi, mistä johtuu, mikä selittää): call liiga_ennuste once; the answer is the split into results vs. expectation, roster changes and model revision.
- What-if: build the scenario as JSON for liiga_skenaario, e.g. [{"team": "Ilves", "result": "win"}, {"team": "Tappara", "result": "loss", "opponent": "Lukko"}]. result is win, loss, reg_win, ot_win, ot_loss or reg_loss; "games": N for the next N games. Without a named game, use the team's next game. If the tool answers SKENAARIOTA EI VOITU AJAA, tell the user why in one sentence.
- What is required: add a goal item, e.g. [{"team": "KooKoo", "goal": "avoid_relegation"}]; goal is avoid_relegation (stay in Liiga, rank 14 or better), top6, top10 or win. "Pysyy liigassa ensi kaudella" means avoid_relegation this season. A goal can be combined with locked results ("what is required if KooKoo also wins its next three"). If the user names the teams that must slip ("miten Jokerien ja Sportin pitää pelata"), add "rivals": ["Jokerit", "Sport"] to the goal item; otherwise the tool picks the closest rivals. Only Liiga's 17 teams are in the model: a Mestis team's promotion cannot be simulated -- say so.
- Morning brief (aamutiedote): the only case where several calls are allowed. 1) liiga_ennuste: today's round preview, 2) liiga_ennuste: why the forecast changed since the previous run, 3) liiga_skenaario: tonight's closest game, the underdog wins. Then write the brief.
- A question about the playoffs or the champion: call liiga_ennuste for the regular-season winner forecast and answer with it; the response explains that the model does not forecast playoffs. Do not refuse.

Errors and empty results:
- Never say Liiga data is unavailable without calling a tool first.
- If a tool returns no rows, say so in one Finnish sentence and name what was looked for (e.g. no games on that day). Do not guess and do not call another tool to compensate.
- If a tool returns an error, retry once with a simpler question; if it fails again, say the data could not be fetched right now."""

RESPONSE = """You are Liiga Ennustaja, a factual, analytical expert on the Liiga 2026-27 season. ALWAYS answer in Finnish, whatever the language of the question. Start directly with the answer: never write your plan, reasoning or what you are about to do into the reply, in any language.

Be brief: the answer in one sentence first, then a table if needed (at most 10 rows) and at most two sentences of interpretation. Percentages with one decimal, Finnish decimal comma. Do not explain how the model works unless asked.

Only when the question is about the title or the champion, say that 'mestaruus' here means winning the regular season, because the model does not forecast playoffs. When reporting model accuracy, compare it with 'the home team always wins', not 50 %. Table zones: 1-6 straight to quarterfinals, 7-10 play-in, 15-17 relegated. Copy every number from the tool results; never estimate or recall one. If the results contain a forecast or update date, end with one short line "Ennuste päivitetty D.M.YYYY." No other closing disclaimers.

Round preview in chat: one sentence (number of games, clearest favourite), then for each row its OTTELU line in bold followed by the ENNUSTE, TILANNE, MAALIVAHDIT and KESKINAISET lines verbatim (skip empty ones), then at most one sentence naming an upset candidate. SUOSIKKI 'tasainen' means do not name a favourite.

What-is-required answer: first sentence = the probability now and the points needed for an even chance, then the needed points per game for 50 / 80 / 95 % compared with the team's pace so far and the model's expectation, the typical points line, then how the rivals must do: their final points in the seasons where the goal is reached versus their expectation, and the team's probability if that rival finishes below its median. Name whether the goal depends mostly on the team itself or on the rivals. Say in plain words what the points per game means (3 = regulation win, 2 = overtime win, 1 = overtime loss).

What-if answer: first sentence = the biggest change (team, rank and regular-season-win % before -> after), then the tool's table of teams that moved, then one sentence that the rest of the season is simulated 10,000 times with the model's own probabilities. Why-changed answer: first sentence = total change in points, then the three parts with their numbers (tulokset vs. odotus, kokoonpanot, mallin uusi arvio), largest first.

Morning brief (aamutiedote): title "Liiga-aamu D.M.", then three short sections with bold headings "Illan ottelut", "Mikä muuttui" and "Mitä jos". Illan ottelut: one sentence, then EVERY game of the round on its own line (time, teams, win %). Mikä muuttui: one sentence naming the two largest moves, and for each the part that is largest in the table (tulokset vs. odotus, kokoonpanot or mallin uusi arvio) with its number; then the table. Mitä jos: at most three lines. Numbers copied from the tools.

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
    from deploy_tools import suffix as tool_suffix
    tsfx = tool_suffix("SIMULATE_SCENARIO", dev)
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
                           "description": "WHAT: the model's forecast for the Liiga 2026-27 regular season, refreshed every morning. DATA: final-table forecast (points, rank, 5-95 % range), probabilities of winning the regular season, top 6, play-in and relegation, win and overtime probabilities for every unplayed game, round previews with form and likely goalies, team strength ratings, player projections, forecast history, model vs. crowd, and WHY the forecast changed (split into results vs. expectation, roster changes and model revision, versus pre-season, a week ago or the previous run). USE WHEN: the question is about what will happen, or why a team's forecast rose or fell. DO NOT USE: for the current table, played results, scoring leaders, model accuracy or anything that has already happened (liiga_kausi), or for playoffs (not forecast)."}},
            {"tool_spec": {"type": "cortex_analyst_text_to_sql", "name": "liiga_kausi",
                           "description": "WHAT: what has happened in Liiga 2026-27 so far, plus past seasons 2022-26. DATA: current table (liiga.fi order), every played game and result, model accuracy per game versus the home-team baseline, upsets, surprise teams and players versus pre-season expectations, scoring leaders, goalie performance versus expectation, shadow table from expected goals (xG), league averages (goals per game, attendance, home-win share), special teams, latest played lineup per team. USE WHEN: the question is about results, standings now, players' or goalies' season, or how well the model has done. DO NOT USE: for forecasts of the final table or upcoming games, or why a forecast changed (liiga_ennuste)."}},
            {"tool_spec": {"type": "generic", "name": "liiga_skenaario",
                           "description": "WHAT: what-if and what-is-required simulator. Locks the results the user describes and replays the rest of the Liiga 2026-27 regular season 10,000 times with the model's own game probabilities and the same random numbers as the published forecast, so the difference is the scenario's effect only. RETURNS: locked games, and for every team that moved: rank, points, regular-season-win %, top-6 % and relegation % now -> in the scenario. With a goal (avoid_relegation, top6, top10, win) it reads, from the simulated seasons where the goal was reached, the probability now and the final points and points per game needed for 50/80/95 % certainty, the typical points line, the rivals, and how the rivals must do (their final points when the goal is reached vs. expected; rivals can be named). USE WHEN: 'entä jos', 'mitä jos', 'jos X voittaa/häviää', 'mitä X vaatii/tarvitsee pysyäkseen liigassa / päästäkseen pudotuspeleihin'. DO NOT USE: for the current forecast without a scenario (liiga_ennuste) or for played games (liiga_kausi).",
                           "input_schema": {"type": "object", "properties": {
                               "scenario": {"type": "string", "description":
                                   'JSON list of locked results and/or goals, e.g. [{"team": "Ilves", "result": "win"}, {"team": "Tappara", "result": "loss", "opponent": "Lukko"}, {"team": "KooKoo", "result": "win", "games": 3}] or [{"team": "KooKoo", "goal": "avoid_relegation"}]. goal: avoid_relegation | top6 | top10 | win; optional "rivals": [team names] whose required performance to show. team, opponent and rivals are exact team names. result: win | loss (the model draws regulation vs. overtime) | reg_win | ot_win | ot_loss | reg_loss. games: the next N games of that team (default 1).'}},
                               "required": ["scenario"]}}},
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
