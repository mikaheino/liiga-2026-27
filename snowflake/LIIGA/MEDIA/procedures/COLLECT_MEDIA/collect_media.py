"""Muut mediat (21.11.2026): Ilta-Sanomien, Iltalehden ja MTV Uutisten Liiga-otsikot ja linkit.

Tekoälykäyttö sallittu 22.11.2026 (Mika Heinon ilmoittama lupa; laajuus otsikot ja linkit).
Julkaisijoiden robots.txt kieltää yhä tekoälyrobotit (ClaudeBot, GPTBot, Google-Extended ym.), joten
tämä pysyy tavallisena syötteenlukijana: talteen vain otsikko, aika, linkki ja joukkue (avainsanoista),
ei artikkelitekstiä eikä ingressiä. Otsikoista poimitaan tapahtumat (EXTRACT_MEDIA_EVENTS ->
MEDIA_EVENTS) agentin liiga_media-hakuun (LIIGA_MEDIA_SEARCH).

Kutsuu control plane (workflow liiga-mediat): CALL LIIGA.MEDIA.COLLECT_MEDIA().
"""
import html
import re
from email.utils import parsedate_to_datetime

import requests

UA = "liiga-predict/0.1 (personal hobby project)"
SOURCES = [
    ("Ilta-Sanomat", "https://www.is.fi/rss/jaakiekko.xml"),
    ("Iltalehti", "https://www.iltalehti.fi/rss/jaakiekko.xml"),
    ("MTV Uutiset", "https://api.mtvuutiset.fi/mtvuutiset/api/feed/rss/urheilu"),
]
LIIGA_CATS = {"liiga", "sm-liiga", "smliiga"}
TEAMS = {  # avainsana (pienillä) -> joukkue
    "hifk": "HIFK", "hpk": "HPK", "ilves": "Ilves", "jokerit": "Jokerit", "jokere": "Jokerit", "jyp": "JYP",
    "jukurit": "Jukurit", "kalpa": "KalPa", "kärpät": "Kärpät", "kärpi": "Kärpät", "k-espoo": "K-Espoo",
    "kiekko-espoo": "K-Espoo", "kookoo": "KooKoo", "lukko": "Lukko", "lukon": "Lukko", "pelicans": "Pelicans",
    "saipa": "SaiPa", "vaasan sport": "Sport", "tappara": "Tappara", "tps": "TPS", "ässät": "Ässät", "ässi": "Ässät",
}


def _text(block: str, tag: str) -> list[str]:
    vals = re.findall(rf"<{tag}[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</{tag}>", block, re.S)
    return [" ".join(html.unescape(re.sub(r"<[^>]+>", " ", v)).replace("\xad", "").split()) for v in vals]


def _teams(*texts: str) -> str:
    low = " ".join(texts).lower()
    found = sorted({team for key, team in TEAMS.items() if re.search(rf"(?<![\w-]){re.escape(key)}", low)})
    return ", ".join(found)


def _published(item: str) -> str:
    pub = (_text(item, "pubDate") or [""])[0]
    try:
        return parsedate_to_datetime(pub).isoformat() if pub else ""
    except (TypeError, ValueError):
        return ""


def _liiga_items(xml: str, known: set[str]):
    """(otsikko, linkki, joukkue, julkaistu) vain Liiga-jutuista, joita ei vielä ole talletettu."""
    for item in re.findall(r"<item>(.*?)</item>", xml, re.S):
        title = (_text(item, "title") or [""])[0]
        link = (_text(item, "link") or [""])[0]
        if not title or not link.startswith("https://") or link in known:
            continue
        cats = _text(item, "category")
        team = _teams(title, " ".join(cats))
        if {c.lower() for c in cats} & LIIGA_CATS or team:   # ei NHL:ää, maajoukkuetta eikä muita lajeja
            yield title, link, team, _published(item)


def _collect(session, source: str, url: str, known: set[str]) -> str:
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=20)
        r.raise_for_status()
    except Exception as e:  # noqa: BLE001  (yksittäinen katko ei pysäytä muita)
        return f"virhe: {str(e)[:120]}"
    n = 0
    for title, link, team, published in _liiga_items(r.text, known):
        session.sql(
            "insert into LIIGA.MEDIA.MEDIA_LINKS (published, source, team, title, url)"
            " select try_to_timestamp_tz(?), ?, nullif(?, ''), ?, ?",
            [published, source, team, title[:300], link[:500]]).collect()
        known.add(link)
        n += 1
    return f"uusia {n}"


def run(session) -> dict:
    known = {r[0] for r in session.sql(
        "select url from LIIGA.MEDIA.MEDIA_LINKS where fetched_at > dateadd(day, -60, current_timestamp())").collect()}
    status = {source: _collect(session, source, url, known) for source, url in SOURCES}
    new = sum(int(v.split()[-1]) for v in status.values() if v.startswith("uusia"))
    return {"uusia": new, "lähteet": status}
