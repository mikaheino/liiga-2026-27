"""Paikallisen agentin työkalut MCP:nä (6.11.2026, docs/claude/skenaario.md J1/V3).

Paikallinen "Kysy" (lib/localClaude.ts, `claude -p`) saa samat työkalut samoilla
nimillä ja kuvauksilla kuin Snowflaken Cortex-agentti LIIGA_ENNUSTAJA
(scripts/deploy/deploy_agent.spec()) ja samat vastaukset, koska toteutus on sama:

    liiga_skenaario    scripts/tools/skenaario.py   = SIMULATE_SCENARIO-proseduuri (tekstitila)
    liiga_kokoonpanot  scripts/tools/kokoonpanot.py = LINEUP_FORECAST-proseduuri
    liiga_tieto        deploy_knowledge.chunks()     = Cortex Search LIIGA_TIETO (samat osiot)

Semanttiset työkalut (liiga_ennuste, liiga_kausi) tulevat vaiheessa B (VQR); siihen
asti paikallinen vastaa niistä tilannekuvasta.

Turvallisuus: Claude ajetaan `--tools "" --allowedTools mcp__liiga__*`, joten muita
työkaluja ei ole (todennettu 6.11.). Syöte validoidaan skeemaa tiukemmin: ei polkuja,
ei SQL:ää, pituusrajat. Palvelin ei avaa uutiskantaa eikä lue tiedostoja syötteen
perusteella.

Protokolla: MCP stdio (JSON-RPC rivi kerrallaan), ilman ulkoisia riippuvuuksia.

    .venv/bin/python scripts/local/liiga_mcp.py          # localClaude.ts käynnistää
"""
from __future__ import annotations

import contextlib
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "deploy"))
sys.path.insert(0, str(ROOT / "scripts" / "tools"))

LOCAL = ("liiga_skenaario", "liiga_kokoonpanot", "liiga_tieto")
DAY = re.compile(r"^(TODAY|TOMORROW|\d{4}-\d{2}-\d{2})$")
MAX_SCENARIO = 4000
MAX_QUERY = 500


def tools() -> list[dict]:
    """Snowflaken agentin työkalumääritys: sama nimi, kuvaus ja syöteskeema."""
    import deploy_agent
    out = []
    for t in deploy_agent.spec(dev=True)["tools"]:
        s = t["tool_spec"]
        if s["name"] not in LOCAL:
            continue
        schema = s.get("input_schema") or {
            "type": "object", "required": ["query"],
            "properties": {"query": {"type": "string", "description": "Hakulause suomeksi."}}}
        out.append({"name": s["name"], "description": s["description"],
                    "inputSchema": {**schema, "additionalProperties": False}})
    return out


class BadInput(ValueError):
    pass


def _text(args: dict, key: str, limit: int) -> str:
    v = args.get(key)
    if not isinstance(v, str) or not v.strip() or len(v) > limit:
        raise BadInput(f"'{key}' puuttuu tai on liian pitkä (enintään {limit} merkkiä)")
    if set(args) - {key}:
        raise BadInput(f"tuntemattomia kenttiä: {', '.join(sorted(set(args) - {key}))}")
    return v


def _scenario(args: dict) -> str:
    s = _text(args, "scenario", MAX_SCENARIO)
    try:
        json.loads(s)
    except ValueError as exc:
        raise BadInput(f"scenario ei ole JSONia: {exc}") from exc
    import skenaario
    return skenaario.run(s)


def _lineups(args: dict) -> str:
    day = _text(args, "day", 20).strip().upper()
    if not DAY.match(day):
        raise BadInput("day: TODAY, TOMORROW tai YYYY-MM-DD")
    import datetime as dt
    from zoneinfo import ZoneInfo
    today = dt.datetime.now(ZoneInfo("Europe/Helsinki")).date()
    d = {"TODAY": today, "TOMORROW": today + dt.timedelta(days=1)}.get(day)
    import kokoonpanot
    return kokoonpanot.run(d.isoformat() if d else day)


_CHUNKS: list[dict] = []


def _words(s: str) -> set[str]:
    # Suomen taivutus: verrataan sanojen alkuja (6 merkkiä), ei koko sanoja.
    return {w[:6] for w in re.findall(r"[a-zåäö0-9]+", s.lower()) if len(w) > 3}


def search(query: str, k: int = 6) -> list[dict]:
    """Tietopankki: samat osiot kuin Cortex Searchissa, järjestys sanojen osumista."""
    if not _CHUNKS:
        import deploy_knowledge
        _CHUNKS.extend(deploy_knowledge.chunks())
    q = _words(query)
    scored = []
    for c in _CHUNKS:
        title, body = _words(c["section"]), _words(c["text"])
        score = 3 * len(q & title) + len(q & body)
        if score:
            scored.append((score, c))
    scored.sort(key=lambda x: -x[0])
    return [{"ID": c["id"], "DOC": c["doc"], "SECTION": c["section"], "TEXT": c["text"]} for _, c in scored[:k]]


def _knowledge(args: dict) -> str:
    hits = search(_text(args, "query", MAX_QUERY))
    return json.dumps({"results": hits}, ensure_ascii=False) if hits else "Tietopankista ei löytynyt osumia."


HANDLERS = {"liiga_skenaario": _scenario, "liiga_kokoonpanot": _lineups, "liiga_tieto": _knowledge}


def call(name: str, args: dict) -> tuple[str, bool]:
    if name not in HANDLERS:
        return f"tuntematon työkalu {name!r}", True
    if not isinstance(args, dict):
        return "syötteen pitää olla olio", True
    try:
        with contextlib.redirect_stdout(io.StringIO()):     # stdout on protokollan kanava
            return HANDLERS[name](args), False
    except BadInput as exc:
        return f"VIRHEELLINEN SYÖTE: {exc}", True
    except Exception as exc:                                 # noqa: BLE001 -- kerrotaan agentille
        return f"TYÖKALU EPÄONNISTUI: {type(exc).__name__}: {exc}", True


def handle(msg: dict) -> dict | None:
    i, method = msg.get("id"), msg.get("method")
    if i is None:
        return None                                          # ilmoitus, ei vastausta
    if method == "initialize":
        ver = (msg.get("params") or {}).get("protocolVersion", "2024-11-05")
        result = {"protocolVersion": ver, "capabilities": {"tools": {}},
                  "serverInfo": {"name": "liiga", "version": "1"}}
    elif method == "tools/list":
        result = {"tools": tools()}
    elif method == "tools/call":
        p = msg.get("params") or {}
        text, err = call(str(p.get("name")), p.get("arguments") or {})
        result = {"content": [{"type": "text", "text": text}], "isError": err}
    elif method == "ping":
        result = {}
    else:
        return {"jsonrpc": "2.0", "id": i, "error": {"code": -32601, "message": f"tuntematon metodi {method}"}}
    return {"jsonrpc": "2.0", "id": i, "result": result}


def main() -> None:
    out = sys.stdout
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            msg = json.loads(line)
        except ValueError:
            continue
        reply = handle(msg)
        if reply is not None:
            out.write(json.dumps(reply, ensure_ascii=False) + "\n")
            out.flush()


if __name__ == "__main__":
    main()
