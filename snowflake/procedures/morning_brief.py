"""Aamutiedote sähköpostiin: Snowflake ajaa agentin ja lähettää vastauksen (2026-10-16).

    CALL LIIGA.MODEL.SEND_MORNING_BRIEF_<sha>('PRODUCTION');   -- tai 'DEV', 'STAGING'

Agentti tekee itse kolme työkalukutsua (kierroksen esikatselu, miksi ennuste
muuttui, mitä jos illan tasaisimmassa ottelussa) -- ohje on deploy_agent.py:n
"Morning brief" -kohdassa. Tämä proseduuri vain kysyy "Tee aamutiedote.",
muuntaa vastauksen tekstin ja taulukot sähköpostin HTML:ksi ja lähettää sen
integraatiolla LIIGA_EMAIL (sallitut vastaanottajat on rajattu integraatiossa).

Versio nimetään aina: päätteetön kutsu menisi live-versioon, jos sellainen on
(mitattu 16.10., deploy_agent.py).
"""
from __future__ import annotations

import html
import json
import re

AGENT = "SNOWFLAKE_INTELLIGENCE.AGENTS.LIIGA_ENNUSTAJA"
TO = "mika.heino@recordlydata.com"
INTEGRATION = "LIIGA_EMAIL"
HEAD = {"team": "Joukkue", "rank_before": "Sija ennen", "rank_now": "Sija nyt",
        "points_change": "Muutos", "games_in_window": "Otteluita",
        "results_vs_expected": "Tulokset vs. odotus", "roster_changes": "Kokoonpanot",
        "model_revision": "Mallin uusi arvio", "points_before": "Pisteet ennen",
        "points_now": "Pisteet nyt"}
GOLD, INK, MUTED = "#CCA752", "#1A1A1A", "#6B6B6B"

# Tiedotteen ohje kulkee kysymyksessä eikä agentin yleisessä ohjeessa: sitä
# tarvitaan vain tässä, ja yleinen ohje maksetaan jokaisessa kutsussa (16.10.).
BRIEF = """Tee aamutiedote. Tämä pyyntö sallii kolme työkalukutsua tässä järjestyksessä:
1) liiga_ennuste: "Kierroksen esikatselu: tämän illan ottelut"
2) liiga_ennuste: miksi ennuste muuttui edellisestä ajosta (vertailu EDELLINEN)
3) liiga_skenaario: illan tasaisin ottelu, altavastaaja voittaa.
Muoto: otsikko "Liiga-aamu D.M.", sitten kolme lyhyttä osiota lihavoiduin otsikoin
"Illan ottelut" (yksi lause, sitten JOKAINEN ottelu omalla rivillään: aika, joukkueet, voitto-%),
"Mikä muuttui" (yksi lause kahdesta suurimmasta liikkeestä ja kummankin suurin osa numeroineen,
sitten taulukko) ja "Mitä jos" (enintään kolme riviä). Kaikki luvut työkaluista. Ei kaavioita."""


def _num(v):
    if re.fullmatch(r"-?\d+", str(v)):
        return str(v).replace("-", "−")
    try:
        return f"{float(v):.1f}".replace(".", ",").replace("-", "−")
    except (TypeError, ValueError):
        return html.escape(str(v))


def _inline(t: str) -> str:
    t = html.escape(t)
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)


def md_to_html(md: str) -> str:
    out = []
    for line in md.strip().splitlines():
        s = line.strip()
        if not s:
            continue
        if s.startswith("#"):
            out.append(f'<h1 style="font:700 22px Arial,sans-serif;margin:0 0 12px;color:{INK}">'
                       f'{_inline(s.lstrip("#").strip())}</h1>')
        elif re.fullmatch(r"\*\*[^*]+\*\*", s):
            out.append(f'<h2 style="font:700 15px Arial,sans-serif;margin:20px 0 6px;color:{INK};'
                       f'border-left:4px solid {GOLD};padding-left:8px">{html.escape(s.strip("*"))}</h2>')
        elif s.startswith(("- ", "* ")):
            out.append(f'<p style="margin:2px 0 2px 12px">• {_inline(s[2:])}</p>')
        else:
            out.append(f'<p style="margin:4px 0">{_inline(s)}</p>')
    return "\n".join(out)


def table_to_html(t: dict) -> str:
    rs = t.get("result_set", {})
    cols = [c["name"].lower() for c in rs.get("resultSetMetaData", {}).get("rowType", [])]
    rows = rs.get("data", [])
    if not cols or not rows:
        return ""
    th = "".join(f'<th style="text-align:{"left" if i == 0 else "right"};padding:4px 8px;'
                 f'border-bottom:2px solid {GOLD};font-weight:700">{HEAD.get(c, c)}</th>'
                 for i, c in enumerate(cols))
    body = "".join("<tr>" + "".join(
        f'<td style="text-align:{"left" if i == 0 else "right"};padding:3px 8px;'
        f'border-bottom:1px solid #EEE">{html.escape(str(v)) if i == 0 else _num(v)}</td>'
        for i, v in enumerate(r)) + "</tr>" for r in rows)
    return (f'<table style="border-collapse:collapse;font:13px Arial,sans-serif;'
            f'font-variant-numeric:tabular-nums;margin:6px 0 10px">'
            f"<tr>{th}</tr>{body}</table>")


def to_email(o: dict, version: str) -> tuple[str, str]:
    parts, tools = [], []
    content = o.get("content", [])
    # Vain viimeisen työkalukutsun jälkeinen osa on vastaus; sitä ennen agentti voi
    # kirjoittaa välivaiheita ("I'll gather the data..."), jotka eivät kuulu viestiin.
    last = max((i for i, c in enumerate(content) if c.get("type") in ("tool_use", "tool_result")), default=-1)
    tools = [c["tool_use"]["name"] for c in content if c.get("type") == "tool_use"]
    for c in content[last + 1:]:
        if c.get("type") == "text":
            parts.append(md_to_html(c["text"]))
        elif c.get("type") == "table":
            parts.append(table_to_html(c["table"]))
    text = "".join(c.get("text", "") for c in content[last + 1:] if c.get("type") == "text")
    m = re.search(r"Liiga-aamu\s+([\d.]+)", text)
    subject = f"Liiga-aamu {m.group(1)}" if m else "Liiga-aamu"
    used = ", ".join(sorted({t for t in tools if not t.startswith("system_")}))
    foot = (f'<p style="font:11px Arial,sans-serif;color:{MUTED};margin-top:24px;'
            f'border-top:1px solid #EEE;padding-top:8px">Tämän tiedotteen kirjoitti Snowflake '
            f'Cortex -agentti LIIGA_ENNUSTAJA (alias {html.escape(version)}), ja '
            f'Snowflake lähetti sen. Työkalut: {html.escape(used)}. Luvut tulevat mallin taulukoista; '
            f'agentti ei arvioi niitä itse.</p>')
    body = (f'<div style="max-width:640px;font:14px/1.45 Arial,sans-serif;color:{INK}">'
            f'<div style="background:#000;color:{GOLD};font:700 12px Arial,sans-serif;'
            f'letter-spacing:2px;padding:8px 12px;margin-bottom:16px">LIIGA ENNUSTAJA</div>'
            + "\n".join(parts) + foot + "</div>")
    return subject, body


def run(session, version: str) -> str:
    v = (version or "PRODUCTION").upper()
    req = json.dumps({"messages": [{"role": "user", "content": [
        {"type": "text", "text": BRIEF}]}], "stream": False}, ensure_ascii=False)
    raw = session.sql("SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(?, ?)",
                      params=[f"{AGENT}!{v}", req]).collect()[0][0]
    o = json.loads(raw)
    if "code" in o:
        return f"AGENTTI EPÄONNISTUI: {o.get('message')}"
    subject, body = to_email(o, v)
    session.sql("CALL SYSTEM$SEND_EMAIL(?, ?, ?, ?, 'text/html')",
                params=[INTEGRATION, TO, subject, body]).collect()
    return f"lähetetty {TO}: {subject} ({len(body)} merkkiä)"
