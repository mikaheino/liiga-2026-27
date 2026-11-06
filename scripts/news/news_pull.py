"""Uutiset paikalliseen sovellukseen (6.11.2026, docs/claude/skenaario.md J2/V8).

Hakee julkisen news-data-haaran (ei tokenia) välimuistiin ja ajaa samat vaiheet kuin
Pages-käännös: load_news.py -> challenger_season.py. Taulut kirjoitetaan uutiskantaan
data/news.duckdb (gitignore), jonka sovellus liittää lukutilassa: paikallinen /uutiset,
kierroskortin haastajarivi ja poissaolot toimivat kuten Pagesissa. OK-nappi (poissaolon
hyväksyntä) on vain Pagesissa. Uutisten tulkinta (challenger.py) ajetaan vain GitHubissa.

Agentti ei näe uutistekstiä: MCP-palvelin ei avaa uutiskantaa, ja sivun tilannekuva
välittää vain hyväksytyt poissaolot (lib/pageContext.ts).

    .venv/bin/python scripts/news/news_pull.py          # daily_update.py ajaa tämän lopuksi
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPO = "https://github.com/mikaheino/liiga-2026-27.git"
CACHE = Path.home() / ".cache" / "liiga-ennuste" / "news-data"
# Pagesin historia (challenger_history.csv: kauden kysymysten Uutiskorjattu-käyrä). Paikallinen
# ajo lisää välimuistin kopioon oman päivärivinsä; sitä ei koskaan pushata (reset seuraavalla haulla).
PAGES_CACHE = CACHE.parent / "pages-data"
NEWS_DB = ROOT / "data" / "news.duckdb"


def fetch(branch: str = "news-data", cache: Path = CACHE) -> Path:
    """Julkinen haara välimuistiin: ensimmäisellä kerralla klooni, sitten pull."""
    if (cache / ".git").exists():
        subprocess.run(["git", "-C", str(cache), "fetch", "-q", "--depth", "1", "origin", branch], check=True)
        subprocess.run(["git", "-C", str(cache), "reset", "-q", "--hard", f"origin/{branch}"], check=True)
    else:
        cache.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", "-q", "--depth", "1", "--branch", branch, REPO, str(cache)], check=True)
    return cache


def main() -> int:
    folder = fetch()
    pages = fetch("pages-data", PAGES_CACHE)
    env = {**os.environ, "LIIGA_NEWS_DUCKDB": str(NEWS_DB)}
    py = sys.executable
    for step in (["scripts/news/load_news.py", str(folder)], ["scripts/news/challenger_season.py", str(folder), str(pages)]):
        r = subprocess.run([py, *step], cwd=ROOT, env=env)
        if r.returncode:
            print(f"uutiset: {step[0]} päättyi koodiin {r.returncode}", file=sys.stderr)
            return r.returncode
    print(f"uutiset -> {NEWS_DB}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
