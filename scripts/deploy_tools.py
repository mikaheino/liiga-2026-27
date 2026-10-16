"""Agentin omat työkalut Snowflakeen proseduureina (2026-10-16).

    python scripts/deploy_tools.py --dev     # SIMULATE_SCENARIO_DEV (korvataan)
    python scripts/deploy_tools.py           # SIMULATE_SCENARIO_<sha> (ei korvata koskaan)

Kiinnitys kuten semanttisilla malleilla (semantic_views.sv_suffix): agentin
versio viittaa proseduurin NIMEEN, joten paikallaan korvattu proseduuri
muuttaisi lukitun version käytöstä. Nimen sha = viimeisin commit joka muutti
työkalun lähdettä, ei HEAD.

Lähde viedään stagelle @LIIGA.CODE.AGENT_SKILLS/<sha>/_tools/ ja proseduuri
importtaa sen sieltä: sama tiedosto jota tests/test_simulate_scenario.py testaa.
Proseduuri ajetaan omistajan (LIIGA_DEPLOYER) oikeuksin; käyttäjä tarvitsee vain
USAGEn (FUTURE-oikeus, snowflake/agent_tools.sql).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from snow_conn import conn as _conn  # noqa: E402

CONN = _conn()
STAGE = "@LIIGA.CODE.AGENT_SKILLS"
WAREHOUSE = "LIIGA_WH"

# nimi -> (lähde, allekirjoitus, käsittelijä, kuvaus)
TOOLS = {
    "SIMULATE_SCENARIO": ("snowflake/procedures/simulate_scenario.py", "SCENARIO VARCHAR",
                          "simulate_scenario.run",
                          "Mitä jos? -simulaattori: lukitut ottelutulokset, kausi loppuun 10 000 kertaa."),
    # Ei agentin työkalu vaan agentin käyttäjä: ajaa agentin ja lähettää vastauksen.
    "SEND_MORNING_BRIEF": ("snowflake/procedures/morning_brief.py", "VERSION VARCHAR",
                           "morning_brief.run",
                           "Aamutiedote: ajaa agentin (nimetty versio) ja lähettää vastauksen sähköpostina."),
}


def _snow(*args: str) -> str:
    r = subprocess.run(["snow", *args, *CONN], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError((r.stderr or r.stdout).strip()[-1500:])
    return r.stdout


def tool_sha(src: str) -> str:
    dirty = subprocess.run(["git", "-C", str(ROOT), "status", "--porcelain", "--", src],
                           capture_output=True, text=True, check=True).stdout.strip()
    if dirty:
        raise SystemExit(f"{src} ei ole commitattu: tuotannon proseduuri nimetään "
                         "git-commitin mukaan. Commitoi ensin.")
    return subprocess.run(["git", "-C", str(ROOT), "log", "-1", "--format=%h", "--abbrev=7", "--", src],
                          capture_output=True, text=True, check=True).stdout.strip().upper()


def suffix(name: str, dev: bool) -> str:
    return "_DEV" if dev else "_" + tool_sha(TOOLS[name][0])


def exists(fqn: str) -> bool:
    db, schema, name = fqn.split(".")
    out = _snow("sql", "--format", "json", "-q", f"SHOW PROCEDURES LIKE '{name}' IN SCHEMA {db}.{schema}")
    return bool(json.loads(out))


def deploy(dev: bool) -> dict[str, str]:
    done = {}
    for name, (src, sig, handler, desc) in TOOLS.items():
        sfx = suffix(name, dev)
        fqn = f"LIIGA.MODEL.{name}{sfx}"
        if not dev and exists(fqn):
            print(f"{fqn}: olemassa, ei korvata")
            done[name] = fqn
            continue
        folder = f"{STAGE}/{'dev' if dev else sfx[1:].lower()}/_tools/"
        _snow("stage", "copy", str(ROOT / src), folder, "--overwrite")
        create = "CREATE OR REPLACE" if dev else "CREATE"
        _snow("sql", "-q", f"""{create} PROCEDURE {fqn}({sig})
RETURNS VARCHAR
LANGUAGE PYTHON
RUNTIME_VERSION = '3.11'
PACKAGES = ('snowflake-snowpark-python', 'numpy')
IMPORTS = ('{folder}{Path(src).name}')
HANDLER = '{handler}'
COMMENT = '{desc} Lähde: {src}'
EXECUTE AS OWNER""")
        print(f"{fqn}: luotu ({folder}{Path(src).name})")
        done[name] = fqn
    return done


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dev", action="store_true")
    deploy(ap.parse_args().dev)
