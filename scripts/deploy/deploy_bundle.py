"""LIIGA_DAILY Code Bundle Snowflakeen (8.11.2026).

Kokoaa paketin (daily.py, code_bundle.yml, requirements.txt, config.yaml, src/liiga, notebookin
datatiedostot), lähettää sen stagelle @LIIGA.CODE.CODE_BUNDLE_SRC/liiga_daily/<commit>/ ja luo
bundlen tai lisää uuden version. Versio = muuttumaton tilannekuva (Snowflake Code Bundles).

    python scripts/deploy/deploy_bundle.py            # CI / julkaisurooli
    python scripts/deploy/deploy_bundle.py --dry-run  # vain kokoaminen paikallisesti
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from snow_conn import conn  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
BUNDLE = ROOT / "snowflake/LIIGA/CODE/code_bundles/LIIGA_DAILY"
STAGE = "@LIIGA.CODE.CODE_BUNDLE_SRC"
NAME = "LIIGA.CODE.LIIGA_DAILY_BUNDLE"
# Samat kuin notebookin bootstrap-solussa (data/raw jätetään pois: 2800 välimuistitiedostoa).
DATA = ["crowd_predictions_2026_27.txt", "external_players.csv", "external_raw.txt",
        "external_returnees_raw.txt", "goalies_raw.txt", "league_factors.csv",
        "rosters_2026_27.csv", "transfers_2026_27.txt"]


def assemble(out: Path) -> None:
    for f in ("daily.py", "code_bundle.yml"):
        shutil.copy(BUNDLE / f, out / f)
    shutil.copy(ROOT / "config.yaml", out / "config.yaml")
    shutil.copytree(ROOT / "src/liiga", out / "src/liiga", ignore=shutil.ignore_patterns("__pycache__"))
    (out / "data/raw").mkdir(parents=True)
    for f in DATA:
        shutil.copy(ROOT / "data" / f, out / "data" / f)


def snow(sql: str) -> str:
    r = subprocess.run(["snow", "sql", *conn(), "-q", sql], capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"{sql[:80]}\n{r.stdout}{r.stderr}")
    return r.stdout


def main() -> None:
    sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, cwd=ROOT).stdout.strip()
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp)
        assemble(out)
        files = [p for p in out.rglob("*") if p.is_file()]
        print(f"paketti: {len(files)} tiedostoa")
        if "--dry-run" in sys.argv:
            return
        snow(f"CREATE STAGE IF NOT EXISTS {STAGE[1:]} DIRECTORY = (ENABLE = TRUE)")
        dest = f"{STAGE}/liiga_daily/{sha}"
        # PUT ei kulje alihakemistoihin (ja kaatuu hakemistoon): snow stage copy --recursive säilyttää rakenteen.
        r = subprocess.run(["snow", "stage", "copy", str(out), f"{dest}/", "--recursive", "--overwrite", *conn()],
                           capture_output=True, text=True)
        if r.returncode:
            sys.exit(f"stage copy\n{r.stdout}{r.stderr}")
        # JSON: tekstitulosteessa kysely itse toistuu, jolloin nimi "löytyi" aina (8.11.).
        r = subprocess.run(["snow", "sql", *conn(), "--format", "json", "-q", "SHOW CODE BUNDLES LIKE 'LIIGA_DAILY_BUNDLE' IN SCHEMA LIIGA.CODE"],
                           capture_output=True, text=True)
        exists = bool(json.loads(r.stdout or "[]")) if not r.returncode else False
        snow(f"ALTER CODE BUNDLE {NAME} ADD VERSION FROM {dest}/" if exists
             else f"CREATE CODE BUNDLE {NAME} FROM {dest}/ COMMENT = 'LIIGA_DAILY (src/liiga + data), commit {sha}'")
        print(f"{NAME}: {'uusi versio' if exists else 'luotu'} lähteestä {dest}/")


if __name__ == "__main__":
    main()
