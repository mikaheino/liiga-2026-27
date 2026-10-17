"""Jäädytä Mouhon salaisuus yhdeksi itsenäiseksi HTML-tiedostoksi.

    python scripts/tools/bundle_mouho.py v2      # -> releases/mouho/mouhon-salaisuus-v2.html

Upottaa engine.js:n, art.js:n, rooms.js:n ja game.js:n index.html:ään, jolloin
peli aukeaa suoraan tiedostona (file://) ilman palvelinta. Ainoa ulkoinen pyyntö on
VT323-fontti Google Fontsista; ilman verkkoa selain käyttää tasalevyistä varafonttia.
Käyttäjän pyyntö 17.10.: "Tee pelistä oma bundle", jotta versioon voi palata.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "snowflake/LIIGA/CODE/application_services/LIIGA_ENNUSTE/public/mouho"


def bundle(version: str) -> Path:
    html = (SRC / "index.html").read_text(encoding="utf-8")

    def inline(m: re.Match) -> str:
        js = (SRC / m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script")
        return f"<script>/* {m.group(1)} */\n{js}\n</script>"

    out, n = re.subn(r'<script src="([a-z]+\.js)"></script>', inline, html)
    if n == 0:
        raise SystemExit("index.html:stä ei löytynyt skriptejä upotettavaksi")
    out = out.replace("<title>Mouhon salaisuus</title>", f"<title>Mouhon salaisuus {version}</title>")
    dest = ROOT / "releases/mouho" / f"mouhon-salaisuus-{version}.html"
    dest.write_text(out, encoding="utf-8")
    print(f"{dest.relative_to(ROOT)}: {n} skriptiä upotettu, {dest.stat().st_size // 1024} kt")
    return dest


if __name__ == "__main__":
    bundle(sys.argv[1] if len(sys.argv) > 1 else "dev")
