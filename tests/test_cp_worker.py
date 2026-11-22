"""scripts/ci/cp_worker.py (23.11.2026): Cortex Coden komento politiikasta ja tuloksen jäsennys."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "ci"))
import cp_worker  # noqa: E402

JOB = {"id": 7, "event": {"type": "fix_pr", "task": "LIIGA.CODE.LIIGA_DAILY_RUN", "error": "KeyError: 'x'"},
       "wf": {"name": "liiga-korjaus-pr", "skill_text": "OHJE", "max_turns": 25,
              "tools": ["Read", "Bash(python scripts/dev/quality.py:*)"], "disallowed_tools": ["Bash(git push:*)"]}}


def test_command_carries_skill_event_and_tool_policy():
    cmd = cp_worker.agent_command(JOB)
    prompt = cmd[cmd.index("-p") + 1]
    assert prompt.startswith("OHJE") and '"task":"LIIGA.CODE.LIIGA_DAILY_RUN"' in prompt
    assert "Bash(python scripts/dev/quality.py *)" in cmd             # Claude Coden muoto -> Cortex Coden muoto
    assert cmd[cmd.index("--disallowed-tools") + 1] == "Bash(git push *)"
    assert "--sql-read-only" in cmd and cmd[cmd.index("--max-turns") + 1] == "25"


def test_result_parsing():
    out = "\n".join(json.dumps(d) for d in [
        {"type": "assistant", "message": {"content": [{"type": "text", "text": "Syy: X. Muutos: Y."}]}},
        {"type": "result", "subtype": "success", "usage": {"input_tokens": 10, "output_tokens": 5}}])
    assert cp_worker.agent_result(out) == (True, 15, "Syy: X. Muutos: Y.")
    ok, _, text = cp_worker.agent_result('{"type": "result", "subtype": "error_max_turns", "is_error": true}')
    assert not ok and text == "error_max_turns"
