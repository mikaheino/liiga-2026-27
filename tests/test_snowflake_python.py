"""Snowflakessa ajettava Python ei saa käyttää Python 3.11+:n ominaisuuksia.

src/liiga ajetaan Snowflaken notebookissa (LIIGA_DAILY) ja proseduurit Snowflaken
Python-ajoympäristössä, joka on vanhempi kuin paikallinen 3.13. 17.10. aamuajo kaatui,
kun ruff oli korjannut datetime.timezone.utc -> datetime.UTC (3.11+).
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNOWFLAKE_RUN = [ROOT / "src", ROOT / "snowflake"]
PY311 = [
    (re.compile(r"\b(?:dt|datetime)\.UTC\b"), "datetime.UTC (3.11+): käytä datetime.timezone.utc"),
    (re.compile(r"from datetime import[^\n]*\bUTC\b"), "from datetime import UTC (3.11+)"),
    (re.compile(r"^\s*except\*", re.M), "except* (3.11+)"),
    (re.compile(r"\bimport tomllib\b"), "tomllib (3.11+)"),
]


def test_no_python311_only_features_in_snowflake_code():
    bad = []
    for base in SNOWFLAKE_RUN:
        for f in base.rglob("*.py"):
            text = f.read_text(encoding="utf-8")
            bad += [f"{f.relative_to(ROOT)}: {why}" for rx, why in PY311 if rx.search(text)]
    assert not bad, "\n".join(bad)
