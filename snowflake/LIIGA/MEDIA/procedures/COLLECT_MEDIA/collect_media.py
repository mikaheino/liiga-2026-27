"""Liiga-otsikot ja linkit muista medioista (21.11.2026; laaja haku 23.11.2026).

Tekoälykäyttö sallittu 22.11.2026 (Mika Heinon ilmoittama lupa; laajuus otsikot ja linkit). Laaja haku
(tier 'wide') otetaan käyttöön vain control planen ehdotuksen kautta, jolloin Kyllä-päätös laajentaa saman
luvan sen lähteisiin (kirjataan CONTROL_PLANE.CORE.AUDITiin). Julkaisijoiden robots.txt kieltää yhä
tekoälyrobotit, joten tämä pysyy tavallisena syötteenlukijana: talteen vain otsikko, aika, linkki ja
joukkue (avainsanoista), ei artikkelitekstiä eikä ingressiä.

Lähteet: LIIGA.MEDIA.MEDIA_SOURCES (enabled = true). Lajit:
  rss    syöte, jossa vain jääkiekko: Liiga-juttu = Liiga-kategoria tai joukkueen nimi
  sport  laaja urheilusyöte: vain jutut, joissa joukkueen nimi tai sana liiga
  search uutishaku joukkueittain (Bing News RSS, {q} = joukkue); linkki puretaan alkuperäiseen osoitteeseen

Kutsuu control plane: CALL LIIGA.MEDIA.COLLECT_MEDIA() (liiga-mediat, liiga-mediat-tihea).
"""
import html
import re
from email.utils import parsedate_to_datetime
from urllib.parse import parse_qs, quote_plus, urlparse

import requests

UA = "liiga-predict/0.1 (personal hobby project)"
LIIGA_CATS = {"liiga", "sm-liiga", "smliiga"}
TEAMS = {  # avainsana (pienillä) -> joukkue
    "hifk": "HIFK", "hpk": "HPK", "ilves": "Ilves", "jokerit": "Jokerit", "jokere": "Jokerit", "jyp": "JYP",
    "jukurit": "Jukurit", "kalpa": "KalPa", "kärpät": "Kärpät", "kärpi": "Kärpät", "k-espoo": "K-Espoo",
    "kiekko-espoo": "K-Espoo", "kookoo": "KooKoo", "lukko": "Lukko", "lukon": "Lukko", "pelicans": "Pelicans",
    "saipa": "SaiPa", "vaasan sport": "Sport", "tappara": "Tappara", "tps": "TPS", "ässät": "Ässät", "ässi": "Ässät",
}
SEARCH_TEAMS = ["HIFK", "HPK", "Ilves", "Jokerit", "JYP", "Jukurit", "KalPa", "Kärpät", "Kiekko-Espoo", "KooKoo",
                "Lukko", "Pelicans", "SaiPa", "Vaasan Sport", "Tappara", "TPS", "Ässät"]


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


def _real_link(link: str) -> str:
    """Bingin uutishaun linkki (apiclick.aspx?url=...) -> alkuperäinen osoite."""
    if "bing.com/news/apiclick" in link:
        return parse_qs(urlparse(link).query).get("url", [""])[0]
    return link


def _is_liiga(kind: str, title: str, cats: list[str], team: str) -> bool:
    """rss: jääkiekkosyöte, kategoria riittää; sport ja search: vaaditaan joukkue tai sana liiga otsikossa."""
    cat = bool({c.lower() for c in cats} & LIIGA_CATS)
    if kind == "rss":
        return cat or bool(team)
    return bool(team) or cat or bool(re.search(r"\bliiga", title.lower()))


def _items(xml: str, kind: str, known: set[str]):
    """(otsikko, linkki, joukkue, julkaistu, media) vain Liiga-jutuista, joita ei vielä ole talletettu."""
    for item in re.findall(r"<item>(.*?)</item>", xml, re.S):
        title = re.sub(r"^[\wÄÖäö-]+ \| ", "", (_text(item, "title") or [""])[0])   # HS: "Jääkiekko | ..."
        link = _real_link((_text(item, "link") or [""])[0])
        if not title or not link.startswith("https://") or link in known:
            continue
        cats = _text(item, "category")
        team = _teams(title, " ".join(cats))
        if _is_liiga(kind, title, cats, team):
            yield title, link, team, _published(item), (_text(item, "News:Source") or [""])[0]


def _get(url: str) -> str:
    r = requests.get(url, headers={"User-Agent": UA}, timeout=20)
    r.raise_for_status()
    return r.text


def _save(session, source: str, rows, known: set[str]) -> int:
    n = 0
    for title, link, team, published, media in rows:
        label = f"{media} (haku)" if media else source
        session.sql(
            "insert into LIIGA.MEDIA.MEDIA_LINKS (published, source, team, title, url)"
            " select try_to_timestamp_tz(?), ?, nullif(?, ''), ?, ?",
            [published, label[:80], team, title[:300], link[:500]]).collect()
        known.add(link)
        n += 1
    return n


def _collect(session, source: str, kind: str, url: str, known: set[str]) -> str:
    try:
        if kind == "search":
            n, errors = 0, 0
            for t in SEARCH_TEAMS:
                try:
                    n += _save(session, source, _items(_get(url.replace("{q}", quote_plus(f"{t} liiga"))), kind, known), known)
                except Exception:  # noqa: BLE001  (yksi haku ei pysäytä muita)
                    errors += 1
            return f"uusia {n}" if errors < len(SEARCH_TEAMS) else f"virhe: kaikki {errors} hakua epäonnistuivat"
        return f"uusia {_save(session, source, _items(_get(url), kind, known), known)}"
    except Exception as e:  # noqa: BLE001  (yksittäinen katko ei pysäytä muita)
        return f"virhe: {str(e)[:120]}"


def run(session) -> dict:
    known = {r[0] for r in session.sql(
        "select url from LIIGA.MEDIA.MEDIA_LINKS where fetched_at > dateadd(day, -60, current_timestamp())").collect()}
    sources = session.sql("select source, kind, url from LIIGA.MEDIA.MEDIA_SOURCES where enabled order by tier, source").collect()
    status = {r[0]: _collect(session, r[0], r[1], r[2], known) for r in sources}
    new = sum(int(v.split()[-1]) for v in status.values() if v.startswith("uusia"))
    session.sql("update LIIGA.MEDIA.MEDIA_SOURCES s set last_run_at = current_timestamp(), last_status = v.st"
                " from (select key as src, value::string as st from table(flatten(parse_json(?)))) v where s.source = v.src",
                [__import__("json").dumps(status)]).collect()
    return {"uusia": new, "lähteet": status}
