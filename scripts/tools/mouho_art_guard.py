#!/usr/bin/env python3
"""Mouho-grafiikkaputken vahti: sallii muutokset vain piirtokoodiin.

Käyttäjän sääntö (18.10.2026): "Älä koske pelin koodilogiikkaan." Vertaa työpuun muutoksia
annettuun git-viitteeseen ja hylkää, jos muutos osuu
  - engine.js:ään tai index.html:ään (moottori ja käyttöliittymä),
  - game.js:ään muualle kuin esinekuvakkeisiin (ITEMS.x.icon) tai esikatselulohkoon (?nayta=),
  - nimettyihin logiikka- tai sijaintifunktioihin muissa tiedostoissa (DENY).
Tulostaa OK tai rivit FAIL: ... ja palaa koodilla 1.

Käyttö: python scripts/tools/mouho_art_guard.py <git-viite>
"""
import re
import subprocess
import sys

DIR = "snowflake/LIIGA/CODE/application_services/LIIGA_ENNUSTE/public/mouho/"
FORBIDDEN_FILES = {"engine.js", "index.html"}
# Funktiot ja vakiot, joihin peli nojaa (ajoitus, puheet, kävely-, osuma- ja visa-alueet).
DENY = {
    "prologue.js": {"prologue", "travel", "flightAt", "LAND", "BOX_AT", "flown"},
    "call.js": {"phoneCall", "PANEL", "ease"},
    "kaivokatu.js": {"ending", "mouho2027Form"},
    "rooms.js": {"KEYS", "streetX", "templeX", "QUIZ_AREA", "quizFlag", "keyAt", "keyQuad", "lotX", "VPK", "BASE", "CHASM", "floorX", "boulderY"},
    "art.js": set(), "faces.js": set(), "southpark.js": set(), "pixfaces.js": set(),
}
TOP = re.compile(r"^(?:async\s+)?function\s+([A-Za-z0-9_]+)|^(?:const|let)\s+([A-Za-z0-9_]+)\s*=")


def owners(text):
    """Rivinumero (1-) -> ylimmän tason funktion tai vakion nimi."""
    cur, out = None, {}
    for i, line in enumerate(text.splitlines(), 1):
        m = TOP.match(line)
        if m:
            cur = m.group(1) or m.group(2)
        out[i] = cur
    return out


def git(*a):
    return subprocess.run(["git", *a], capture_output=True, text=True, check=True).stdout


def main(base):
    fails = []
    files = [f for f in git("diff", "--name-only", base, "--", DIR).split() if f]
    files += [f for f in git("ls-files", "--others", "--exclude-standard", DIR).split() if f.endswith(".js")]
    for path in files:
        name = path.rsplit("/", 1)[-1]
        if name in FORBIDDEN_FILES:
            fails.append(f"{name}: tiedostoa ei saa muuttaa")
            continue
        diff = git("diff", "-U0", base, "--", path)
        if not diff:
            continue
        old = git("show", f"{base}:{path}") if name != "southpark.js" or diff else ""
        new = open(path, encoding="utf-8").read()
        own_old, own_new = owners(old), owners(new)
        new_lines = new.splitlines()
        for h in re.finditer(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", diff, re.M):
            o0, on, n0, nn = int(h[1]), int(h[2] or 1), int(h[3]), int(h[4] or 1)
            touched = {own_old.get(i) for i in range(o0, o0 + on)} | {own_new.get(i) for i in range(n0, n0 + nn)}
            if name == "game.js":
                for i in range(n0, n0 + nn):
                    ln = new_lines[i - 1] if i - 1 < len(new_lines) else ""
                    if nn and not re.match(r"^ITEMS\.\w+\.icon\s*=", ln) and own_new.get(i) not in (None,) and "nayta" not in ln and not _in_preview(new_lines, i):
                        fails.append(f"game.js:{i}: vain ITEMS.*.icon ja ?nayta-esikatselu ovat sallittuja")
                        break
                if on and not nn:
                    fails.append(f"game.js: rivejä poistettu kohdasta {o0}")
                continue
            bad = touched & DENY.get(name, set())
            if bad:
                fails.append(f"{name}:{n0}: logiikka/sijainti {sorted(bad)} ei saa muuttua")
    if fails:
        print("\n".join(f"FAIL: {f}" for f in fails))
        return 1
    print("OK")
    return 0


def _in_preview(lines, i):
    """Onko rivi ?nayta-esikatselulohkossa (game.js:n loppu, kehityskäyttö)."""
    for j in range(i - 1, -1, -1):
        if "esikatselu (kehitys)" in lines[j]:
            return True
        if lines[j].startswith("// ----") and "esikatselu" not in lines[j]:
            return False
    return False


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "HEAD"))
