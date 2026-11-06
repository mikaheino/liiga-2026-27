"""Uutiskanta erillään mallikannasta (6.11.2026, docs/claude/skenaario.md J2/N0).

Uutis- ja haastajataulut (news_*, challenger_*, prediction_games_news) kirjoitetaan
tiedostoon, jota git ei seuraa (data/news.duckdb, .gitignore): repo on julkinen, eikä
uutisdata kuulu commitoituun data/liiga.duckdb:hen. Mallikanta luetaan vain
luettavaksi. Kirjoittaja antaa polun ympäristömuuttujassa LIIGA_NEWS_DUCKDB; ilman
sitä kirjoitus on virhe, jotta mikään ajo ei kirjoita vahingossa väärään kantaan.
Sovellus (scripts/local/duckdb_query.py) liittää uutiskannan lukutilassa.
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODEL_DB = ROOT / "data" / "liiga.duckdb"
DEFAULT = ROOT / "data" / "news.duckdb"


def target() -> Path:
    p = os.environ.get("LIIGA_NEWS_DUCKDB")
    if not p:
        raise SystemExit("LIIGA_NEWS_DUCKDB puuttuu: uutistaulut kirjoitetaan omaan kantaansa "
                         "(esim. data/news.duckdb), ei mallikantaan data/liiga.duckdb.")
    path = Path(p) if Path(p).is_absolute() else ROOT / p
    if path.resolve() == MODEL_DB.resolve():
        raise SystemExit("LIIGA_NEWS_DUCKDB ei saa olla mallikanta data/liiga.duckdb")
    return path
