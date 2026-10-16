"""Koodin laatu: sama tarkistus CI:ssä ja omalla koneella (2026-10-16).

    python scripts/dev/quality.py                    # kaikki: ruff, monimutkaisuus, testit + kattavuus
    python scripts/dev/quality.py --fast             # ilman testejä (pre-push -hook ajaa kaiken)
    python scripts/dev/quality.py --update-baseline  # lukitse parannukset uudeksi lähtötasoksi
    python scripts/dev/quality.py --init             # ensimmäinen lähtötaso nykytilasta

Kolme porttia:

  1. ruff (asetukset pyproject.toml:ssa) -- ei yhtään löydöstä.
  2. Monimutkaisuus (radon, syklomaattinen) -- raja LIMIT. Nykyiset rajan ylittävät
     funktiot ovat lähtötasossa (quality_baseline.json): ne saavat jäädä, mutta
     eivät monimutkaistua. Uusi funktio ei saa ylittää rajaa.
  3. Testit ja kattavuus (pytest-cov) -- kaikki testit läpi, ja kattavuus ei saa
     laskea lähtötasosta.

Ratchet: kun funktio yksinkertaistuu tai kattavuus nousee, --update-baseline
lukitsee uuden tason, eikä sitä voi enää heikentää. Näin putki on käytössä heti
ilman, että mallin ydintä refaktoroidaan kesken kauden (AGENTS.md §10).

CI kirjoittaa saman tuloksen GitHubin yhteenvetoon (GITHUB_STEP_SUMMARY).
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASELINE = Path(__file__).resolve().parent / "quality_baseline.json"
LIMIT = 15
APP = ROOT / "snowflake" / "LIIGA" / "CODE" / "application_services" / "LIIGA_ENNUSTE"
CODE_DIRS = ["src", "scripts", "snowflake", "streamlit_app", "tests"]
COVER = ["src/liiga", "snowflake/LIIGA/MODEL/procedures", "snowflake/LIIGA/CODE/stages/AGENT_SKILLS",
         "scripts/tools"]


def _py_files() -> list[Path]:
    """Vain gitissä olevat tiedostot (kuten ruff): generoitu tai ignoroitu koodi,
    esim. streamlit_app/output/, ei saa tehdä paikallisesta tuloksesta eri kuin CI:n."""
    r = subprocess.run(["git", "-C", str(ROOT), "ls-files", "--", *[f"{d}/*.py" for d in CODE_DIRS]],
                       capture_output=True, text=True, check=True)
    return sorted(ROOT / f for f in r.stdout.split() if (ROOT / f).exists())


def ruff() -> tuple[bool, str]:
    exe = Path(sys.executable).with_name("ruff")
    cmd = [str(exe) if exe.exists() else "ruff", "check", "--output-format", "concise", str(ROOT)]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
    return r.returncode == 0, (r.stdout + r.stderr).strip()


def typescript() -> tuple[bool, str] | None:
    """Next.js-sovelluksen tyypit (sama kuin ci.yml:n app-job). Ohitetaan, jos
    riippuvuuksia ei ole asennettu (npm ci) -- CI tarkistaa ne silloinkin."""
    if not (APP / "node_modules").exists():
        return None
    r = subprocess.run(["npm", "run", "-s", "typecheck"], capture_output=True, text=True, cwd=APP)
    return r.returncode == 0, (r.stdout + r.stderr).strip()


def complexity() -> dict[str, int]:
    """{tiedosto::funktio: syklomaattinen kompleksisuus} rajan ylittäville."""
    from radon.complexity import cc_visit
    out = {}
    for p in _py_files():
        try:
            blocks = cc_visit(p.read_text(encoding="utf-8"))
        except SyntaxError as exc:
            raise SystemExit(f"{p}: {exc}") from exc
        for b in blocks:
            for item in [b, *getattr(b, "methods", [])]:
                if item.complexity > LIMIT:
                    name = f"{getattr(item, 'classname', None) + '.' if getattr(item, 'classname', None) else ''}{item.name}"
                    out[f"{p.relative_to(ROOT)}::{name}"] = item.complexity
    return out


def tests() -> tuple[bool, float, str]:
    report = Path(tempfile.mkdtemp()) / "coverage.json"
    cmd = [sys.executable, "-m", "pytest", "-q", "tests", "-p", "no:cacheprovider",
           *[f"--cov={c}" for c in COVER], f"--cov-report=json:{report}", "--cov-report="]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
    pct = json.loads(report.read_text())["totals"]["percent_covered"] if report.exists() else 0.0
    return r.returncode == 0, pct, (r.stdout + r.stderr).strip().splitlines()[-1] if (r.stdout + r.stderr).strip() else ""


class Report:
    """Kerää tarkistusten tulokset: rivit tulostukseen, hylkäykset ja huomiot."""

    def __init__(self) -> None:
        self.rows: list[tuple[str, str]] = []
        self.fails: list[str] = []
        self.notes: list[str] = []


def check_lint(r: Report) -> None:
    ok, out = ruff()
    r.rows.append(("ruff", "läpi" if ok else "LÖYDÖKSIÄ"))
    if not ok:
        r.fails.append("ruff:\n" + out)
    ts = typescript()
    r.rows.append(("typescript", "ohitettu (ei node_modules)" if ts is None else ("läpi" if ts[0] else "VIRHEITÄ")))
    if ts is not None and not ts[0]:
        r.fails.append("typescript:\n" + ts[1])


def check_complexity(r: Report, old: dict[str, int], init: bool) -> dict[str, int]:
    cx = complexity()
    r.rows.append(("monimutkaisuus", f"{len(cx)} funktiota yli rajan {LIMIT} (lähtötaso {len(old)})"))
    if not init:
        r.fails += [f"uusi funktio yli monimutkaisuusrajan {LIMIT}: {k} = {v}" for k, v in cx.items() if k not in old]
    r.fails += [f"monimutkaisuus kasvoi: {k} {old[k]} -> {v}" for k, v in cx.items() if k in old and v > old[k]]
    r.notes += [f"parantui: {k} {o} -> {cx.get(k, 0)}" + (" (alle rajan)" if cx.get(k, 0) <= LIMIT else "")
                for k, o in old.items() if cx.get(k, 0) < o]
    return cx


def check_tests(r: Report, minimum: float) -> float:
    ok, pct, line = tests()
    r.rows.append(("testit", line or ("läpi" if ok else "KAATUI")))
    r.rows.append(("kattavuus", f"{pct:.1f} % (lähtötaso {minimum:.1f} %)"))
    if not ok:
        r.fails.append(f"testit kaatuivat: {line}")
    if pct + 0.05 < minimum:
        r.fails.append(f"kattavuus laski: {minimum:.1f} % -> {pct:.1f} %")
    elif pct >= minimum + 1.0:
        r.notes.append(f"kattavuus nousi: {minimum:.1f} % -> {pct:.1f} %")
    return pct


def publish(r: Report, locking: bool) -> None:
    for name, val in r.rows:
        print(f"{name:16} {val}")
    for n in r.notes:
        print("  +", n)
    if r.notes and not locking:
        print("  -> lukitse parannukset: python scripts/dev/quality.py --update-baseline")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        failed = "".join(f"- {f.splitlines()[0]}\n" for f in r.fails)
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as fh:
            fh.write("### Koodin laatu\n\n| tarkistus | tulos |\n|---|---|\n"
                     + "".join(f"| {n} | {v} |\n" for n, v in r.rows)
                     + (f"\n**Hylätty:**\n\n{failed}" if r.fails else ""))
    if r.fails:
        print("\nLAATUPORTTI EI LÄPI:")
        for f in r.fails:
            print(" -", f)
        raise SystemExit(1)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fast", action="store_true", help="ilman testejä")
    ap.add_argument("--update-baseline", action="store_true")
    ap.add_argument("--init", action="store_true", help="kirjaa nykyinen monimutkaisuus lähtötasoksi")
    a = ap.parse_args()
    if (a.update_baseline or a.init) and a.fast:
        raise SystemExit("--update-baseline vaatii testit (ilman --fast)")
    base = json.loads(BASELINE.read_text()) if BASELINE.exists() else {"complex_functions": {}, "coverage_min": 0.0}
    r = Report()
    check_lint(r)
    cx = check_complexity(r, base["complex_functions"], a.init)
    pct = None if a.fast else check_tests(r, base["coverage_min"])
    publish(r, a.update_baseline or a.init)
    if a.update_baseline or a.init:
        BASELINE.write_text(json.dumps({"limit": LIMIT, "coverage_min": round(pct, 1),
                                        "complex_functions": dict(sorted(cx.items()))},
                                       ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"lähtötaso päivitetty: {BASELINE.relative_to(ROOT)}")
    print("laatuportti läpi")


if __name__ == "__main__":
    main()
