"""Claude Code -hook (PostToolUse, Edit/Write): ruff juuri muokatulle Python-tiedostolle.

Palaute tulee heti muokkauksen jälkeen eikä vasta pushissa tai CI:ssä. Hook saa
työkalukutsun JSONina stdinistä; löydökset menevät stderriin ja exit 2 näyttää ne
Claudelle, joka korjaa ne samalla kierroksella. Muut tiedostot ohitetaan.
Asetus: .claude/settings.json.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
try:
    data = json.load(sys.stdin)
except ValueError:
    sys.exit(0)
path = (data.get("tool_input") or {}).get("file_path", "")
if not path.endswith(".py") or not Path(path).exists():
    sys.exit(0)
ruff = ROOT / ".venv" / "bin" / "ruff"
r = subprocess.run([str(ruff) if ruff.exists() else "ruff", "check", "--output-format", "concise", path],
                   capture_output=True, text=True, cwd=ROOT)
if r.returncode:
    print("ruff löysi ongelmia muokatusta tiedostosta (sama tarkistus kuin CI:ssä):\n" + r.stdout.strip(),
          file=sys.stderr)
    sys.exit(2)
