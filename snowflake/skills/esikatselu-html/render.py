"""Johtoryhmävisualisointi: kierroksen esikatselu raporttina. Ajetaan agentin
koodinsuoritushiekkalaatikossa.

Malli EI kirjoita HTML:ää eikä laske mitään: se antaa tälle ROUND_PREVIEW-rivit
sellaisinaan (valmiit suomenkieliset tekstirivit), ja tämä skripti lukee luvut
niistä ja rakentaa raportin. Tokenien kannalta halvin tapa -- agentin syöte on
sama kuin chat-vastauksessa -- ja ulkoasu pysyy samana joka kerta.

    from render import render
    path = render(rows, title="Kierroksen esikatselu 10.10.2026")

rows: lista sanakirjoja, avaimet kuten ROUND_PREVIEW-kyselyssä (kirjainkoko
vapaa): ottelu, ennuste, tilanne, maalivahdit, keskinaiset, suosikki.
Jos jokin rivi ei jäsenny, se näytetään tekstinä eikä raportti kaadu.

Raportti on itsenäinen tiedosto: ei ulkoisia fontteja, kuvia eikä skriptejä,
koska se avataan CoWorkissa, selaimessa tai liitteenä ilman verkkoa.
"""
from __future__ import annotations

import html
import os
import re
from datetime import date

NUM = r"[+−-]?\d+(?:,\d+)?"
RE_ENN = re.compile(rf"Ennuste: (.+?) ({NUM}) % · (.+?) ({NUM}) % \(jatkoaika ({NUM}) %\)")
RE_TIL = re.compile(r"Tilanne: (.+?) (\d+)\. \((\d+) p, vire (\d+)/15\) · (.+?) (\d+)\. "
                    r"\((\d+) p, vire (\d+)/15\)")
RE_MV = re.compile(rf"Todennäköiset maalivahdit: (.+?)(?: \(({NUM})\))? – (.+?)(?: \(({NUM})\))?$")
RE_H2H = re.compile(r"Keskinäiset tällä kaudella: (.+?) (\d+)–(\d+) (.+)$")
RE_OTT = re.compile(r"^(\d{1,2}:\d{2}) (.+?) – (.+)$")


def _f(s: str | None) -> float | None:
    if s is None:
        return None
    return float(s.replace("−", "-").replace(",", "."))


def _fi(x: float, d: int = 1, sign: bool = False) -> str:
    s = f"{x:+.{d}f}" if sign else f"{x:.{d}f}"
    return s.replace("-", "−").replace(".", ",")


def _g(r: dict, k: str):
    return r.get(k) if k in r else r.get(k.upper())


def _parse(r: dict) -> dict:
    """Yksi ottelu lukuina. Puuttuva tai jäsentymätön kenttä = None."""
    g = {"raw": r, "suosikki": _g(r, "suosikki") or ""}
    m = RE_OTT.match(_g(r, "ottelu") or "")
    g.update(time=m[1], home=m[2], away=m[3]) if m else g.update(
        time="", home=_g(r, "ottelu") or "", away="")
    m = RE_ENN.match(_g(r, "ennuste") or "")
    g.update(ph=_f(m[2]), pa=_f(m[4]), pot=_f(m[5])) if m else g.update(ph=None, pa=None, pot=None)
    m = RE_TIL.match(_g(r, "tilanne") or "")
    if m:
        g.update(hr=int(m[2]), hp=int(m[3]), hf=int(m[4]), ar=int(m[6]), ap=int(m[7]), af=int(m[8]))
    m = RE_MV.match(_g(r, "maalivahdit") or "")
    if m:
        g.update(hg=m[1], hgs=_f(m[2]), ag=m[3], ags=_f(m[4]))
    m = RE_H2H.match(_g(r, "keskinaiset") or "")
    if m:
        g.update(h2h=(int(m[2]), int(m[3])))
    g["even"] = g["suosikki"] == "tasainen"
    return g


def _upset(games: list[dict]) -> tuple[dict, str] | None:
    """Altavastaaja, jolla on parempi vire tai parempi maalivahti. Suurin ero voittaa."""
    best, why, score = None, "", 0.0
    for g in games:
        # Tasaisessa ottelussa ei ole altavastaajaa, joten ei yllätystäkään.
        if g.get("ph") is None or "hf" not in g or g["even"]:
            continue
        home_dog = g["ph"] < g["pa"]
        dog = "home" if home_dog else "away"
        f_d, f_f = (g["hf"], g["af"]) if home_dog else (g["af"], g["hf"])
        s_d = g.get("hgs" if home_dog else "ags")
        s_f = g.get("ags" if home_dog else "hgs")
        cand = []
        if f_d > f_f:
            cand.append((f_d - f_f, f"parempi vire ({f_d}/15 vs. {f_f}/15)"))
        if s_d is not None and s_f is not None and s_d - s_f > 3:
            cand.append(((s_d - s_f) / 2, f"parempi maalivahti ({_fi(s_d, sign=True)} vs. "
                                          f"{_fi(s_f, sign=True)})"))
        for sc, w in cand:
            if sc > score:
                best, why, score = dict(g, dog=dog), w, sc
    return (best, why) if best else None


CSS = """
:root{--ink:#17140E;--ink2:#4A4336;--muted:#7A7161;--line:#E4DED1;--soft:#F6F3EC;
--paper:#FFFFFF;--gold:#B08A2E;--gold-soft:#F3EAD2;--navy:#1F2A3A;--home:#1F2A3A;--away:#B08A2E;
--good:#2F6B3A;--bad:#A8432F;
--sans:"Segoe UI",-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;
--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}
*{box-sizing:border-box}
html{background:var(--soft)}
body{margin:0;color:var(--ink);font:15px/1.5 var(--sans);font-variant-numeric:tabular-nums}
.page{max-width:1000px;margin:0 auto;background:var(--paper);min-height:100vh;
  box-shadow:0 0 0 1px var(--line)}
header{background:var(--navy);color:#fff;padding:28px 40px 24px;display:grid;gap:6px}
.eyebrow{font:600 11px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:#D9C38A}
h1{margin:0;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-.01em}
.sub{color:#C9CED6;font-size:14px}
main{padding:28px 40px 36px;display:grid;grid-template-columns:minmax(0,1fr);gap:28px}
main>section{min-width:0}
.wrap{overflow-x:auto}
h2{margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink2)}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.kpi{border:1px solid var(--line);border-top:3px solid var(--navy);padding:12px 14px;display:grid;gap:4px;min-width:0}
.kpi.gold{border-top-color:var(--gold)}
.kpi .l{font:600 10.5px/1.2 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.kpi .v{font-size:22px;font-weight:700;line-height:1.15}
.kpi .s{font-size:12.5px;color:var(--ink2)}
.summary{width:100%;border-collapse:collapse}
.summary th{font:600 10.5px/1.2 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);
  text-align:left;padding:0 10px 8px;border-bottom:2px solid var(--ink)}
.summary td{padding:11px 10px;border-bottom:1px solid var(--line);vertical-align:middle}
.summary td.t{font:600 13px/1 var(--mono);color:var(--ink2);white-space:nowrap}
.summary td.m{font-weight:600;white-space:nowrap}
.summary td.r{text-align:right;white-space:nowrap}
.bar{display:flex;height:22px;border-radius:2px;overflow:hidden;min-width:180px;font:600 11.5px/22px var(--mono);color:#fff}
.bar span{display:block;padding:0 7px;white-space:nowrap;overflow:hidden}
.bar .h{background:var(--home)}.bar .a{background:var(--away);text-align:right}
.pill{display:inline-block;font:600 10.5px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  padding:4px 7px;border-radius:2px;border:1px solid var(--line);color:var(--ink2);background:var(--soft)}
.pill.fav{border-color:var(--gold);color:#7A5E17;background:var(--gold-soft)}
.games{display:grid;gap:14px}
.game{border:1px solid var(--line);display:grid;grid-template-columns:1fr auto 1fr;gap:0;break-inside:avoid}
.game .hd{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;gap:10px;
  padding:10px 16px;background:var(--soft);border-bottom:1px solid var(--line);flex-wrap:wrap}
.game .hd b{font-size:16px}
.game .hd .t{font:600 12px/1 var(--mono);color:var(--muted);margin-right:8px}
.side{padding:14px 16px;display:grid;gap:8px;min-width:0}
.side.away{text-align:right}
.side .team{font-size:17px;font-weight:700}
.side .pct{font-size:26px;font-weight:700;line-height:1}
.side.home .pct{color:var(--home)} .side.away .pct{color:var(--away)}
.mid{padding:14px 10px;display:grid;align-content:center;justify-items:center;gap:4px;border-left:1px solid var(--line);
  border-right:1px solid var(--line);min-width:118px;color:var(--muted);font-size:12px;text-align:center}
.mid .ot{font:600 18px/1 var(--mono);color:var(--ink2)}
dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:13px}
.side.away dl{grid-template-columns:auto auto;justify-content:end;text-align:left}
dt{color:var(--muted)} dd{margin:0;font-weight:600}
.form{display:inline-flex;gap:2px;vertical-align:middle}
.form i{width:9px;height:9px;border-radius:1px;background:var(--line)}
.form i.on{background:var(--ink2)}
.sv.pos{color:var(--good)} .sv.neg{color:var(--bad)}
.note{grid-column:1/-1;padding:9px 16px;border-top:1px dashed var(--line);font-size:12.5px;color:var(--ink2)}
.callout{border-left:4px solid var(--gold);background:var(--gold-soft);padding:12px 16px;font-size:14px}
.callout b{display:block;font:600 10.5px/1.4 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:#7A5E17}
footer{padding:16px 40px 28px;color:var(--muted);font-size:12px;border-top:1px solid var(--line);display:grid;gap:4px}
@media (max-width:720px){
  header,main,footer{padding-left:16px;padding-right:16px}
  .kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  h1{font-size:23px}
  .game{grid-template-columns:minmax(0,1fr)}
  .side.away{text-align:left;border-top:1px solid var(--line)}
  .side.away dl{justify-content:start}
  .bar{min-width:120px}
  .summary td.m{white-space:normal}
  .summary th:last-child,.summary td.r{display:none}
  .mid{border:0;border-top:1px solid var(--line);grid-auto-flow:column;gap:10px;justify-content:start;padding:10px 16px}
}
@media print{html{background:#fff}.page{box-shadow:none}header{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .bar,.kpi,.pill,.callout{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
"""


def _form(n: int) -> str:
    """Vire 0-15 viitenä ruutuna (3 pistettä = yksi ruutu)."""
    on = round(n / 3)
    return ('<span class="form" aria-hidden="true">'
            + "".join(f'<i class="{"on" if i < on else ""}"></i>' for i in range(5))
            + "</span>")


def _sv(x: float | None) -> str:
    if x is None:
        return ""
    cls = "pos" if x > 0 else ("neg" if x < 0 else "")
    return f' <span class="sv {cls}">({_fi(x, sign=True)})</span>'


def _side(g: dict, side: str) -> str:
    e = html.escape
    h = side == "home"
    team = g["home"] if h else g["away"]
    pct = g.get("ph" if h else "pa")
    rows = []
    if "hr" in g:
        r, p, f = (g["hr"], g["hp"], g["hf"]) if h else (g["ar"], g["ap"], g["af"])
        rows += [("Sija nyt", f"{r}."), ("Pisteet", f"{p}"),
                 ("Vire (5 ott.)", f"{_form(f)} {f}/15")]
    if "hg" in g:
        name, sv = (g["hg"], g.get("hgs")) if h else (g["ag"], g.get("ags"))
        rows.append(("Maalivahti*", f"{e(name)}{_sv(sv)}"))
    dl = "".join(f"<dt>{k}</dt><dd>{v}</dd>" for k, v in rows)
    pct_s = f"{_fi(pct)} %" if pct is not None else ""
    return (f'<div class="side {side}"><div class="team">{e(team)}</div>'
            f'<div class="pct">{pct_s}</div><dl>{dl}</dl></div>')


def render(rows: list[dict], title: str | None = None, out_dir: str | None = None) -> str:
    e = html.escape
    title = title or f"Kierroksen esikatselu {date.today():%-d.%-m.%Y}"
    games = [_parse(r) for r in rows]
    n = len(games)
    clear = [g for g in games if g.get("ph") is not None]
    top = max(clear, key=lambda g: max(g["ph"], g["pa"]), default=None)
    n_even = sum(1 for g in games if g["even"])
    upset = _upset(games)

    # KPI-rivi
    kpis = [("Otteluita", str(n), "tänään")]
    if top:
        fav = top["home"] if top["ph"] >= top["pa"] else top["away"]
        kpis.append(("Selkein suosikki", e(fav),
                     f"{_fi(max(top['ph'], top['pa']))} % · {e(top['home'])} – {e(top['away'])}"))
    kpis.append(("Tasaisia otteluita", f"{n_even} / {n}", "suosikki alle 55 %"))
    if upset:
        ug, why = upset
        kpis.append(("Yllätysehdokas", e(ug["home"] if ug["dog"] == "home" else ug["away"]), e(why)))
    else:
        form = [(g["hf"], g["home"]) for g in games if "hf" in g] + \
               [(g["af"], g["away"]) for g in games if "af" in g]
        if form:
            f, t = max(form)
            kpis.append(("Kovin vire", e(t), f"{f}/15 pistettä viidestä viime ottelusta"))
    kpi_html = "".join(
        f'<div class="kpi{" gold" if i == 1 else ""}"><div class="l">{l}</div>'
        f'<div class="v">{v}</div><div class="s">{s}</div></div>'
        for i, (l, v, s) in enumerate(kpis))

    # Yhteenvetotaulukko
    trs = []
    for g in games:
        if g.get("ph") is not None:
            bar = (f'<div class="bar" role="img" aria-label="{e(g["home"])} {_fi(g["ph"])} %, '
                   f'{e(g["away"])} {_fi(g["pa"])} %">'
                   f'<span class="h" style="width:{g["ph"]:.1f}%">{_fi(g["ph"])} %</span>'
                   f'<span class="a" style="width:{g["pa"]:.1f}%">{_fi(g["pa"])} %</span></div>')
        else:
            bar = e(_g(g["raw"], "ennuste") or "")
        pill = ('<span class="pill">Tasainen</span>' if g["even"] else
                f'<span class="pill fav">{e(g["suosikki"])}</span>')
        trs.append(f'<tr><td class="t">{e(g["time"])}</td><td class="m">{e(g["home"])} – '
                   f'{e(g["away"])}</td><td>{bar}</td><td class="r">{pill}</td></tr>')
    summary = ('<div class="wrap"><table class="summary"><thead><tr><th>Klo</th><th>Ottelu</th>'
               '<th>Voittotodennäköisyys (koti | vieras)</th><th class="r">Arvio</th></tr></thead>'
               f'<tbody>{"".join(trs)}</tbody></table></div>')

    # Ottelukortit
    cards = []
    for g in games:
        pill = ('<span class="pill">Tasainen</span>' if g["even"] else
                f'<span class="pill fav">Suosikki: {e(g["suosikki"])}</span>')
        mid = (f'<div class="mid"><div>jatkoaika</div><div class="ot">'
               f'{_fi(g["pot"]) + " %" if g.get("pot") is not None else "–"}</div></div>')
        note = ""
        if g.get("h2h"):
            a, b = g["h2h"]
            note = (f'<div class="note">Keskinäiset tällä kaudella: {e(g["home"])} {a}–{b} '
                    f'{e(g["away"])}</div>')
        if "hr" not in g and "hg" not in g:     # ei jäsentynyt: näytä teksti
            txt = " · ".join(e(_g(g["raw"], k) or "") for k in ("ennuste", "tilanne", "maalivahdit"))
            note += f'<div class="note">{txt}</div>'
        cards.append(f'<section class="game"><div class="hd"><div><span class="t">{e(g["time"])}</span>'
                     f'<b>{e(g["home"])} – {e(g["away"])}</b></div>{pill}</div>'
                     f'{_side(g, "home")}{mid}{_side(g, "away")}{note}</section>')

    callout = ""
    if upset:
        ug, why = upset
        dog = ug["home"] if ug["dog"] == "home" else ug["away"]
        fav = ug["away"] if ug["dog"] == "home" else ug["home"]
        # Ei taivutettuja joukkueiden nimiä: ne taipuvat epäsäännöllisesti.
        callout = (f'<div class="callout"><b>Yllätysehdokas</b>Ottelussa {e(ug["home"])} – '
                   f'{e(ug["away"])} ennusteen suosikki on {e(fav)}, mutta altavastaaja '
                   f'{e(dog)}: {e(why)}.</div>')

    page = (f'<!doctype html><html lang="fi"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f"<title>{e(title)}</title><style>{CSS}</style></head><body><div class=\"page\">"
            f'<header><div class="eyebrow">Liiga 2026–27 · Johtoryhmävisualisointi</div>'
            f"<h1>{e(title)}</h1>"
            f'<div class="sub">Liiga Ennustaja · 10 000 simulaatiota per ottelu · '
            f"päivitetty {date.today():%-d.%-m.%Y}</div></header><main>"
            f'<section><h2>Yhteenveto</h2><div class="kpis">{kpi_html}</div></section>'
            + (f"<section>{callout}</section>" if callout else "")
            + f"<section><h2>Illan ottelut</h2>{summary}</section>"
            f'<section><h2>Ottelukohtaisesti</h2><div class="games">{"".join(cards)}</div></section>'
            "</main><footer>"
            "<div>Voittotodennäköisyys sisältää jatkoajan ja voittolaukaukset. Tasainen = suosikin "
            "todennäköisyys alle 55 %. Vire = pisteet viidestä viime ottelusta, enintään 15 "
            "(ruutu = 3 pistettä).</div>"
            "<div>* Todennäköinen maalivahti = aloitti joukkueen edellisen ottelun. Luku: maaleja "
            "vähemmän (+) tai enemmän (−) kuin keskivertomaalivahti olisi päästänyt samoista "
            "maalipaikoista tällä kaudella.</div>"
            "</footer></div></body></html>")
    out_dir = out_dir or ("/workspace" if os.path.isdir("/workspace") else os.getcwd())
    path = os.path.join(out_dir, f"kierros_{date.today():%Y%m%d}.html")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(page)
    return path
