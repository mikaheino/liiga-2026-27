"""Kierroksen esikatselu HTML-sivuksi. Ajetaan agentin koodinsuoritushiekkalaatikossa.

Malli EI kirjoita HTML:ää: se antaa tälle vain ROUND_PREVIEW-rivit JSONina,
ja sivu tulee tästä pohjasta. Se on tokenien kannalta halvin tapa (malli
tuottaa ~1 000 tokenia dataa eikä ~8 000 tokenia HTML:ää) ja pitää ulkoasun
samana joka kerta.

    from render import render
    path = render(rows, title="Kierroksen esikatselu 10.10.2026")

rows: lista sanakirjoja, avaimet kuten ROUND_PREVIEW-kyselyssä (kirjainkoko
vapaa): ottelu, ennuste, tilanne, maalivahdit, keskinaiset, suosikki.
"""
from __future__ import annotations

import html
import os
from datetime import date

CSS = """
:root{--bg:#120D06;--card:#1C150B;--line:#36270D;--fg:#F2EBDD;--muted:#A89880;--gold:#EBCA68;--even:#7FA7C9}
@media (prefers-color-scheme:light){:root{--bg:#F6F4EF;--card:#FFFFFF;--line:#E2DCCD;--fg:#1E1A12;--muted:#6B6252;--gold:#8A6A1F;--even:#2F5D85}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 "Hanken Grotesk","Helvetica Neue",Arial,sans-serif}
main{max-width:860px;margin:0 auto;padding:32px 16px 48px;display:grid;gap:18px}
.kicker{font:600 12px/1 ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}
h1{margin:6px 0 0;font-size:clamp(26px,5vw,38px);font-weight:800;letter-spacing:-.02em}
.lead{color:var(--muted);margin:0}
.game{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--gold);border-radius:6px;padding:16px 18px;display:grid;gap:6px}
.game.even{border-left-color:var(--even)}
.game h2{margin:0;font-size:20px;font-weight:800}
.tag{font:600 11px/1 ui-monospace,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;padding:4px 7px;border-radius:3px;border:1px solid currentColor;color:var(--gold);justify-self:start}
.game.even .tag{color:var(--even)}
.row{margin:0;font-variant-numeric:tabular-nums}
.row.muted{color:var(--muted);font-size:14px}
footer{color:var(--muted);font-size:13px}
"""


def _g(r: dict, k: str):
    return r.get(k) if k in r else r.get(k.upper())


def render(rows: list[dict], title: str | None = None, out_dir: str | None = None) -> str:
    title = title or f"Kierroksen esikatselu {date.today():%-d.%-m.%Y}"
    e = html.escape
    cards = []
    for r in rows:
        fav = _g(r, "suosikki") or ""
        even = fav == "tasainen"
        h2h = _g(r, "keskinaiset")
        cards.append(
            f'<section class="game{" even" if even else ""}">'
            f'<h2>{e(_g(r, "ottelu") or "")}</h2>'
            f'<span class="tag">{"Tasainen" if even else "Suosikki: " + e(fav)}</span>'
            f'<p class="row">{e(_g(r, "ennuste") or "")}</p>'
            f'<p class="row">{e(_g(r, "tilanne") or "")}</p>'
            f'<p class="row muted">{e(_g(r, "maalivahdit") or "")}</p>'
            + (f'<p class="row muted">{e(h2h)}</p>' if h2h else "")
            + "</section>")
    n = len(rows)
    page = (f'<!doctype html><html lang="fi"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f"<title>{e(title)}</title><style>{CSS}</style></head><body><main>"
            f'<div><div class="kicker">Liiga 2026–27 · Liiga Ennustaja</div>'
            f"<h1>{e(title)}</h1></div>"
            f'<p class="lead">{n} ottelu{"a" if n != 1 else ""}. Voitto sisältää jatkoajan ja '
            f"voittolaukaukset. Vire = pisteet viidestä viime ottelusta (enintään 15).</p>"
            + "".join(cards)
            + "<footer>Todennäköinen maalivahti = aloitti joukkueen edellisen ottelun. "
              "Luku maalivahdin perässä: maaleja vähemmän (+) tai enemmän (−) kuin "
              "keskivertomaalivahti olisi päästänyt samoista paikoista.</footer>"
              "</main></body></html>")
    # /workspace on hiekkalaatikon pysyvä hakemisto, josta present_file antaa
    # tiedoston käyttäjälle. Paikallisesti testatessa sitä ei ole.
    out_dir = out_dir or ("/workspace" if os.path.isdir("/workspace") else os.getcwd())
    path = os.path.join(out_dir, f"kierros_{date.today():%Y%m%d}.html")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(page)
    return path
