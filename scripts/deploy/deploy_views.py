"""LIIGA.MODEL-näkymät Snowflakeen järjestyksessä (snowflake/LIIGA/MODEL/views/).

    python scripts/deploy/deploy_views.py           # kaikki, _order.txt:n järjestyksessä
    python scripts/deploy/deploy_views.py --print   # näytä yhdistetty SQL, älä aja

Yksi tiedosto per näkymä (tiedosto = objektin nimi). Järjestys on tiedostossa,
koska näkymät riippuvat toisistaan (V_ROUND_PREVIEW_TEXT -> V_ROUND_PREVIEW ->
V_UPCOMING_PREDICTIONS -> V_GAMES_NOW). Ajetaan yhtenä `snow sql -f` -kutsuna
kuten ennen (ei Scripting-lohkoja, joten puolipisteillä katkominen on turvallista).
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from snow_conn import conn as _conn  # noqa: E402

VIEWS = ROOT / "snowflake" / "LIIGA" / "MODEL" / "views"


def files() -> list[Path]:
    names = [l.strip() for l in (VIEWS / "_order.txt").read_text(encoding="utf-8").splitlines()
             if l.strip() and not l.startswith("#")]
    missing = sorted({p.name for p in VIEWS.glob("V_*.sql")} - set(names))
    if missing:
        raise SystemExit(f"_order.txt:stä puuttuu: {', '.join(missing)}")
    return [VIEWS / n for n in names]


def sql() -> str:
    return "\n".join(p.read_text(encoding="utf-8") for p in files())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--print", action="store_true")
    a = ap.parse_args()
    body = sql()
    if a.print:
        print(body)
        return
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False, encoding="utf-8") as fh:
        fh.write(body)
    r = subprocess.run(["snow", "sql", *_conn(), "-f", fh.name], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit((r.stderr or r.stdout).strip()[-1500:])
    print(f"näkymät: {len(files())} ({', '.join(p.stem for p in files())})")


if __name__ == "__main__":
    main()
