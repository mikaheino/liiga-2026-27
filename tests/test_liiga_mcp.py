"""Paikallisen agentin MCP-palvelin (scripts/local/liiga_mcp.py, 6.11.2026): samat
työkalut ja kuvaukset kuin Snowflaken agentilla, tiukka syötteen tarkistus."""
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("liiga_mcp", ROOT / "scripts/local/liiga_mcp.py")
mcp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mcp)


def test_tools_match_snowflake_agent_spec():
    import sys
    sys.path.insert(0, str(ROOT / "scripts/deploy"))
    import deploy_agent
    sf = {t["tool_spec"]["name"]: t["tool_spec"] for t in deploy_agent.spec(dev=True)["tools"]}
    for t in mcp.tools():
        assert t["description"] == sf[t["name"]]["description"]           # sama kuvaus = sama valinta
        if "input_schema" in sf[t["name"]]:
            assert t["inputSchema"]["properties"] == sf[t["name"]]["input_schema"]["properties"]
    assert [t["name"] for t in mcp.tools()] == ["liiga_skenaario", "liiga_kokoonpanot", "liiga_tieto"]


def test_protocol_and_bad_input():
    init = mcp.handle({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18"}})
    assert init["result"]["protocolVersion"] == "2025-06-18"
    assert mcp.handle({"jsonrpc": "2.0", "method": "notifications/initialized"}) is None
    for name, args in [("liiga_skenaario", {"scenario": "ei json"}), ("liiga_skenaario", {"scenario": "[]", "path": "/etc"}),
                       ("liiga_kokoonpanot", {"day": "../../etc/passwd"}), ("liiga_tieto", {"query": "x" * 600}),
                       ("Bash", {"command": "ls"})]:
        r = mcp.handle({"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": name, "arguments": args}})
        assert r["result"]["isError"], (name, args)
    assert "error" in mcp.handle({"jsonrpc": "2.0", "id": 3, "method": "resources/list"})


def test_knowledge_search_finds_section():
    hits = mcp.search("miten maalivahdit vaikuttavat ennusteeseen")
    assert hits and "aalivah" in hits[0]["SECTION"]
    out = mcp.call("liiga_tieto", {"query": "kotietu"})
    assert not out[1] and json.loads(out[0])["results"]
