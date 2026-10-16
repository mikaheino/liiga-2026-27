"""Agentin tietopankki: docs/agentti/*.md -> Cortex Search -palvelu (2026-10-16).

    python scripts/deploy_knowledge.py --dev     # LIIGA_TIETO_DEV (korvataan)
    python scripts/deploy_knowledge.py           # LIIGA_TIETO_<sha> (ei korvata koskaan)

Agentti tunsi datan (semanttiset mallit) mutta ei menetelmää: "miten malli
toimii?" sekoitti Elon ja Poisson-osan ja sanoi 60 ottelua (oikea 64), ja
"onko kotietu suurempi?" arvasi merkitsevyyden, vaikka se oli testattu.
Tietopankki on KIRJOITETTU agentille (malli, havainnot, rajoitukset, data) --
ei CLAUDE.md:tä, joka on kehitysmuistio ja sekoittaisi agenttia.

Kiinnitys kuten semanttisilla malleilla ja proseduureilla: agenttiversio
viittaa palvelun nimeen, joten tuotannon palvelua ei korvata. Lähde on
samoin kiinnitetty taulu AGENT_KNOWLEDGE_<sha> (Cortex Search ei hyväksy
pelkkää vakiokyselyä).

Upotusmalli on monikielinen (snowflake-arctic-embed-l-v2.0): teksti ja
kysymykset ovat suomeksi.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from snow_conn import conn as _conn  # noqa: E402

CONN = _conn()
SRC = "docs/agentti"
NAME = "LIIGA_TIETO"
EMBED = "snowflake-arctic-embed-l-v2.0"


def _snow(*args: str) -> str:
    r = subprocess.run(["snow", *args, *CONN], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError((r.stderr or r.stdout).strip()[-1500:])
    return r.stdout


def sha() -> str:
    dirty = subprocess.run(["git", "-C", str(ROOT), "status", "--porcelain", "--", SRC],
                           capture_output=True, text=True, check=True).stdout.strip()
    if dirty:
        raise SystemExit(f"{SRC} ei ole commitattu: tuotannon palvelu nimetään git-commitin mukaan.")
    return subprocess.run(["git", "-C", str(ROOT), "log", "-1", "--format=%h", "--abbrev=7", "--", SRC],
                          capture_output=True, text=True, check=True).stdout.strip().upper()


def suffix(dev: bool) -> str:
    return "_DEV" if dev else "_" + sha()


def chunks() -> list[dict]:
    """Yksi rivi per ##-osio: hakutulos on kokonainen, itsenäinen kappale.
    Tiedoston otsikko (#) kulkee mukana, jotta osio ymmärretään yksinään."""
    out = []
    for f in sorted((ROOT / SRC).glob("*.md")):
        text = f.read_text(encoding="utf-8")
        title = re.search(r"^# (.+)$", text, re.M).group(1).strip()
        parts = re.split(r"^## ", text, flags=re.M)
        for p in parts[1:]:
            head, _, body = p.partition("\n")
            body = re.sub(r"\n{3,}", "\n\n", body).strip()
            out.append({"id": f"{f.stem}#{len(out)}", "doc": title, "section": head.strip(),
                        "text": f"{title} -- {head.strip()}\n\n{body}"})
    return out


def exists(fqn: str) -> bool:
    db, schema, name = fqn.split(".")
    out = _snow("sql", "--format", "json", "-q", f"SHOW CORTEX SEARCH SERVICES LIKE '{name}' IN SCHEMA {db}.{schema}")
    return bool(json.loads(out))


def deploy(dev: bool) -> str:
    fqn = f"LIIGA.MODEL.{NAME}{suffix(dev)}"
    if not dev and exists(fqn):
        print(f"{fqn}: olemassa, ei korvata")
        return fqn
    rows = chunks()
    for r in rows:
        assert "$$" not in r["text"]
    values = ",\n".join(f"('{r['id']}', $${r['doc']}$$, $${r['section']}$$, $${r['text']}$$)" for r in rows)
    table = f"LIIGA.MODEL.AGENT_KNOWLEDGE{suffix(dev)}"
    create = "CREATE OR REPLACE" if dev else "CREATE"
    # Cortex Search vaatii lähteeksi taulun (vakiokysely: "Dynamic Tables must have at
    # least one base table"). Taulu on kiinnitetty samalla nimellä kuin palvelu.
    sql = f"""{create} TABLE {table} (ID VARCHAR, DOC VARCHAR, SECTION VARCHAR, TEXT VARCHAR)
  CHANGE_TRACKING = TRUE
  COMMENT = 'Agentin tietopankki: {SRC}/*.md ({len(rows)} osiota). Lähde palvelulle {fqn}.'
AS SELECT column1, column2, column3, column4 FROM VALUES
{values};
{create} CORTEX SEARCH SERVICE {fqn}
  ON TEXT
  ATTRIBUTES DOC, SECTION
  WAREHOUSE = LIIGA_WH
  TARGET_LAG = '7 days'
  EMBEDDING_MODEL = '{EMBED}'
  COMMENT = 'Liiga Ennustaja -agentin tietopankki: {SRC}/*.md ({len(rows)} osiota).'
AS (SELECT ID, DOC, SECTION, TEXT FROM {table});
"""
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False, encoding="utf-8") as fh:
        fh.write(sql)
    _snow("sql", "-f", fh.name)
    print(f"{fqn}: luotu ({len(rows)} osiota, {EMBED})")
    return fqn


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dev", action="store_true")
    ap.add_argument("--list", action="store_true", help="näytä osiot, älä julkaise")
    a = ap.parse_args()
    if a.list:
        for r in chunks():
            print(f"{r['id']:16} {len(r['text']):>5}  {r['doc']} / {r['section']}")
    else:
        deploy(a.dev)
