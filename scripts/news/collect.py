"""Uutiskeräin, uutismallin vaihe 0 (27.10.2026; docs/uutismalli_suunnitelma.md).

Hakee Ylen urheilu-RSS:n ja seurojen omat sivut -- vain lähteet, joiden
robots.txt ei kiellä tekoälyä -- ja kirjaa uudet jutut CSV:hen: otsikko,
linkki, joukkue ja avainsanaliput. Ei kielimallia, ei artikkelitekstiä talteen
(vain otsikko ja linkki), ei vaikutusta ennusteeseen. Tarkoitus on mitata
kahden viikon ajan, kuinka paljon loukkaantumis-, siirto- ja valmentajatietoa
näistä lähteistä oikeasti tulee ja kuka julkaisee ensin.

Ajaa .github/workflows/news.yml kerran päivässä klo 14.00 Suomen aikaa yhdessä
kokoonpanojen kanssa (scripts/news/lineups.py; käyttäjä 27.10.); Ylen
SM-liiga-aihesyötteen 20 juttua kattavat noin viikon, seurojen syötteet 10-100
juttua. Tulos news-data-haaraan. Paikallisesti:

    python scripts/news/collect.py OUTDIR
"""
from __future__ import annotations

import csv
import datetime as dt
import html
import re
import sys
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin

import requests

UA = "liiga-predict/0.1 (personal hobby project)"
FIELDS = ["fetched_at", "published", "source", "team", "flags", "title", "url", "summary"]
SUMMARY_MAX = 400


def summary_of(text: str) -> str:
    """Syötteen ingressi lyhyenä (käyttäjä 27.10.: uutisen pitää voida lukea ja
    kirjata samassa näkymässä). Vain lähteet ilman AI-kieltoa (Yle, seurat), ja
    vain alku kuten syötteenlukijassa; koko artikkelia ei tallenneta."""
    plain = " ".join(html.unescape(re.sub(r"<[^>]+>", " ", text or "")).split())
    if len(plain) <= SUMMARY_MAX:
        return plain
    return plain[:SUMMARY_MAX].rsplit(" ", 1)[0] + " …"

# (lähde, joukkue, muoto, osoite). Joukkue None = päätellään Ylen kategorioista.
# Tarkistettu 27.10.: ei AI-kieltoja robots.txt:ssä. Puuttuu: Tappara, Pelicans,
# TPS, KalPa (ei löytynyt syötettä) ja Jokerit (AI-kielto).
SOURCES = [
    # Ylen SM-liiga-aihe (18-188906): 20 juttua ~7 vrk. Yleinen urheilusyöte
    # kattoi 20 jutulla vain ~15 h, mikä olisi vaatinut tunneittaisen haun.
    ("Yle", None, "rss", "https://yle.fi/rss/t/18-188906/fi"),
    ("HIFK", "HIFK", "rss", "https://hifk.fi/feed/"),
    ("HPK", "HPK", "rss", "https://hpk.fi/feed/"),
    ("Ilves", "Ilves", "rss", "https://www.ilves.com/feed/"),
    ("JYP", "JYP", "rss", "https://www.jypliiga.fi/feed/"),
    ("K-Espoo", "K-Espoo", "rss", "https://kiekko-espoo.fi/feed/"),
    ("KooKoo", "KooKoo", "rss", "https://www.kookoo.fi/feed/"),
    ("Lukko", "Lukko", "rss", "https://www.raumanlukko.fi/rss.xml"),
    ("Sport", "Sport", "rss", "https://vaasansport.fi/feed/"),
    ("Ässät", "Ässät", "rss", "https://assat.com/feed/"),
    ("Kärpät", "Kärpät", "html", "https://www.karpat.fi/uutiset/"),
    ("SaiPa", "SaiPa", "html", "https://saipa.fi/uutiset/"),
    ("Jukurit", "Jukurit", "html", "https://jukurit.fi/uutiset/"),
]

# Ylen kategoria "KooKoo (Jääkiekon Miesten Liiga)" -> KooKoo. Erottaa Liigan
# jalkapallon Ilveksestä, HIFK:sta ja TPS:stä.
LIIGA_TAG = re.compile(r"^(.+?) \(Jääkiekon Miesten Liiga\)$")
YLE_ALIASES = {"Kiekko-Espoo": "K-Espoo", "Vaasan Sport": "Sport", "Porin Ässät": "Ässät", "Rauman Lukko": "Lukko"}

# Liput otsikosta ja ingressistä (ingressiä ei tallenneta). Karkea tarkoituksella:
# vaihe 0 mittaa, montako osumaa tulee ja montako niistä on oikeasti olennaisia.
FLAGS = {
    "loukkaantuminen": r"loukkaant|sivussa|vamma|leikkau|kuntoutu|sairasluet",
    # Pelaajan paluu, ei kotiinpaluuta eikä "perhepeli tekee paluun" (27.10.).
    "paluu": r"palaa(?:vat)? (?:kokoonpano|kaukalo|peli|kentäl|harjoitu|riveihin)|paluu (?:kokoonpano|kaukalo|peli)"
             r"|tervehty|takaisin kokoonpano|palaa\b(?!.*(?:kotiin|kotikentälle))",
    # Siirrot ja hankinnat (käyttäjä 27.10.: tieto pelaajalisäyksiä varten); seurojen
    # tapa: "Hyökkääjä X Kouvolaan", "Y Stadiin!", "vahvistamaan", "kiinnitti".
    "siirto": r"(?<!ottelu)(?<!yhteistyö)sopimu|(?<!ottelu)siirty(?!y pelattavaksi)|liittyy|vahvistamaan|lainasopim"
              r"|hankki|kiinnit|jättää|lähtee|\b\w+(?:iin|aan|ään|een|uun|yyn|hin)!?$",
    "valmentaja": r"päävalmentaj|valmentaj|erotet|irtisano|potku",
    # "pelikiel": taivutukset pelikielto / pelikiellon / pelikieltoa (27.10.: "pelikielt"
    # ohitti Ylen otsikon "Lukas Wernblom sai pitkän pelikiellon").
    "pelikielto": r"pelikiel|kurinpito|jäähyttäj",
    "kokoonpano": r"kokoonpano|maalivahti|aloittaa maalilla",
}


def _get(url: str) -> bytes:
    r = requests.get(url, headers={"User-Agent": UA}, timeout=20)
    r.raise_for_status()
    return r.content


def _iso(text: str | None) -> str:
    if not text:
        return ""
    try:
        return parsedate_to_datetime(text).astimezone(dt.UTC).isoformat(timespec="seconds")
    except (TypeError, ValueError):
        return text.strip()


# Siirtolippu ei koske otteluohjelmaa eikä maajoukkueita ("kotiottelua siirtyy uuteen
# ajankohtaan", "Floris Slovakian U20-maajoukkueeseen").
NOT_TRANSFER = r"otteluohjelm|ajankoh|maajoukku|ottelusiir|pelattavaksi"
NOT_RETURN = r"kotiinpaluu|tekee paluun|perhepeli|paluutaan|vieraskiertuee"


def flags_of(text: str) -> str:
    low = text.lower()
    return ";".join(k for k, rx in FLAGS.items()
                    if re.search(rx, low) and not (k == "siirto" and re.search(NOT_TRANSFER, low))
                    and not (k == "paluu" and re.search(NOT_RETURN, low)))


def parse_rss(data: bytes) -> list[dict]:
    """RSS 2.0 ja Atom: otsikko, linkki, aika, ingressi ja kategoriat."""
    root = ET.fromstring(data)
    out = []
    for it in root.iter("item"):
        out.append({"title": (it.findtext("title") or "").strip(), "url": (it.findtext("link") or "").strip(),
                    "published": _iso(it.findtext("pubDate")), "text": it.findtext("description") or "",
                    "tags": [c.text or "" for c in it.findall("category")]})
    atom = "{http://www.w3.org/2005/Atom}"
    for e in root.iter(f"{atom}entry"):
        link = e.find(f"{atom}link")
        out.append({"title": (e.findtext(f"{atom}title") or "").strip(), "url": link.get("href", "") if link is not None else "",
                    "published": e.findtext(f"{atom}updated") or "", "text": e.findtext(f"{atom}summary") or "", "tags": []})
    return out


class _Links(HTMLParser):
    """Uutislistasivun artikkelilinkit: href, jonka polussa on uutiset/article
    ja pitkä tunniste, sekä linkin teksti otsikoksi."""

    ARTICLE = re.compile(r"/(uutiset|article)/[^?#]{8,}")

    def __init__(self, base: str):
        super().__init__()
        self.base, self.href, self.buf, self.links = base, None, [], {}

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href") or ""
            self.href = urljoin(self.base, href) if self.ARTICLE.search(href) else None
            self.buf = []

    def handle_data(self, data):
        if self.href:
            self.buf.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self.href:
            title = " ".join(" ".join(self.buf).split())
            if len(title) > len(self.links.get(self.href, "")):
                self.links[self.href] = title
            self.href = None


def parse_html(data: bytes, base: str) -> list[dict]:
    p = _Links(base)
    p.feed(data.decode("utf-8", errors="replace"))
    return [{"title": t, "url": u, "published": "", "text": "", "tags": []} for u, t in p.links.items() if len(t) >= 12]


def yle_teams(tags: list[str]) -> list[str]:
    teams = []
    for t in tags:
        m = LIIGA_TAG.match(t.strip())
        if m:
            teams.append(YLE_ALIASES.get(m.group(1), m.group(1)))
    return teams


def collect(seen: set[str], now: str, summaries: dict[str, str]) -> tuple[list[dict], dict[str, str]]:
    """Uudet jutut; `summaries` täyttyy kaikkien haettujen juttujen ingresseillä
    (myös jo nähtyjen, jotta vanhoille riveille saadaan ingressi jälkikäteen)."""
    rows, status = [], {}
    for source, team, kind, url in SOURCES:
        try:
            data = _get(url)
            items = parse_rss(data) if kind == "rss" else parse_html(data, url)
        except (requests.RequestException, ET.ParseError) as e:
            status[source] = f"virhe: {type(e).__name__}"
            continue
        new = 0
        for it in items:
            if it["url"] and it["text"]:
                summaries[it["url"]] = summary_of(it["text"])
            if not it["url"] or it["url"] in seen:
                continue
            if team is None:
                teams = yle_teams(it["tags"])
                if not teams and "SM-liiga" not in it["tags"]:
                    continue                      # ei Liigaa: jalkapallo, NHL, muut lajit
                row_team = ",".join(teams)
            else:
                row_team = team
            seen.add(it["url"])
            rows.append({"fetched_at": now, "published": it["published"], "source": source, "team": row_team,
                         "flags": flags_of(f"{it['title']} {it['text']}"), "title": it["title"], "url": it["url"],
                         "summary": summary_of(it["text"])})
            new += 1
        status[source] = f"{len(items)} juttua, {new} uutta"
    return rows, status


def main(out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "news_items.csv"
    old = list(csv.DictReader(path.open(encoding="utf-8"))) if path.exists() else []
    # Korjatut säännöt koskevat myös vanhoja rivejä: otsikosta lasketut liput
    # lisätään entisiin (ingressiä ei ole tallessa, joten sen liput säilyvät).
    for r in old:
        keep = set(filter(None, r["flags"].split(";"))) | set(filter(None, flags_of(r["title"]).split(";")))
        if re.search(NOT_TRANSFER, r["title"].lower()):
            keep.discard("siirto")
        if re.search(NOT_RETURN, r["title"].lower()) or "paluu" not in flags_of(f"{r['title']} {r.get('summary', '')}"):
            keep.discard("paluu")
        r["flags"] = ";".join(k for k in FLAGS if k in keep)
    now = dt.datetime.now(dt.UTC).isoformat(timespec="seconds")
    summaries: dict[str, str] = {}
    rows, status = collect({r["url"] for r in old}, now, summaries)
    for r in old:
        if not r.get("summary"):
            r["summary"] = summaries.get(r["url"], "")
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(old + rows)
    for source, s in status.items():
        print(f"{source:8} {s}")
    flagged = [r for r in rows if r["flags"]]
    print(f"uusia {len(rows)}, joista liputettuja {len(flagged)}; yhteensä {len(old) + len(rows)}")
    for r in flagged:
        print(f"  [{r['flags']}] {r['team']}: {r['title']}")
    # Kaatuu vain, jos mikään lähde ei vastannut: yksittäinen katkos ei pysäytä keräystä.
    return 1 if all(s.startswith("virhe") for s in status.values()) else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(Path(sys.argv[1])))
