"""Muut mediat (21.11.2026): Ilta-Sanomien, Iltalehden ja MTV Uutisten Liiga-otsikot ja linkit.

EI TEKOÄLYLLE. Nämä julkaisijat kieltävät tekoälykäytön robots.txt:ssä (ClaudeBot, GPTBot,
Google-Extended ym. Disallow: /), mutta sallivat tavalliset lukijat (User-agent: *). Siksi tämä on
pelkkä syötteenlukija ihmiselle: talteen vain otsikko, aika, linkki ja joukkue (avainsanoista),
ei artikkelitekstiä eikä ingressiä. LIIGA.MEDIA-skeemaa ei anneta agentti- eikä mallirooleille,
eikä sitä viedä uutissignaaleihin, semanttisiin malleihin, hakuun tai agentin työkaluihin.

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


def run(session) -> dict:
    known = {r[0] for r in session.sql(
        "select url from LIIGA.MEDIA.MEDIA_LINKS where fetched_at > dateadd(day, -60, current_timestamp())").collect()}
    status, new = {}, 0
    for source, url in SOURCES:
        try:
            r = requests.get(url, headers={"User-Agent": UA}, timeout=20)
            r.raise_for_status()
        except Exception as e:  # noqa: BLE001  (yksittäinen katko ei pysäytä muita)
            status[source] = f"virhe: {str(e)[:120]}"
            continue
        n = 0
        for item in re.findall(r"<item>(.*?)</item>", r.text, re.S):
            title = (_text(item, "title") or [""])[0]
            link = (_text(item, "link") or [""])[0]
            cats = _text(item, "category")
            if not title or not link.startswith("https://") or link in known:
                continue
            team = _teams(title, " ".join(cats))
            if not ({c.lower() for c in cats} & LIIGA_CATS or team):
                continue  # vain Liiga: ei NHL:ää, maajoukkuetta eikä muita lajeja
            pub = (_text(item, "pubDate") or [""])[0]
            try:
                published = parsedate_to_datetime(pub).isoformat() if pub else None
            except (TypeError, ValueError):
                published = None
            session.sql(
                "insert into LIIGA.MEDIA.MEDIA_LINKS (published, source, team, title, url)"
                " select try_to_timestamp_tz(?), ?, nullif(?, ''), ?, ?",
                [published or "", source, team, title[:300], link[:500]]).collect()
            known.add(link)
            n += 1
        status[source] = f"uusia {n}"
        new += n
    return {"uusia": new, "lähteet": status}
