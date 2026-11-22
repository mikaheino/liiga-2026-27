"""deploy-bundle.yml:n polkusuodatin kattaa jokaisen paketin datatiedoston (23.11.2026, katselmointi B1).
Muuten data/-tiedoston muutos (esim. rosteri-PR) ei käynnistäisi bundlen julkaisua eikä päätyisi Snowflakeen."""
from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "deploy"))


def _glob_re(pattern: str) -> re.Pattern:
    """GitHub Actionsin polkuglob: ** ylittää kansiorajat, * ei ylitä."""
    out = ""
    i = 0
    while i < len(pattern):
        if pattern.startswith("**", i):
            out, i = out + ".*", i + 2
        elif pattern[i] == "*":
            out, i = out + "[^/]*", i + 1
        else:
            out, i = out + re.escape(pattern[i]), i + 1
    return re.compile(out + "$")


def test_every_bundle_data_file_triggers_deploy():
    import deploy_bundle
    wf = yaml.safe_load((ROOT / ".github/workflows/deploy-bundle.yml").read_text(encoding="utf-8"))
    on = wf.get("on", wf.get(True))            # PyYAML lukee avaimen "on" totuusarvoksi
    paths = [_glob_re(p) for p in on["push"]["paths"]]
    missing = [f for f in deploy_bundle.DATA if not any(p.match(f"data/{f}") for p in paths)]
    assert not missing, f"deploy-bundle.yml paths ei kata: {missing}"
    assert not any(p.match("data/raw/game_2026_1.json") or p.match("data/liiga.duckdb") for p in paths)
