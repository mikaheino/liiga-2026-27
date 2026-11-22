"""scripts/local/open_roster_pr.py (23.11.2026): kiinteä haara roster/<päivä>, vain rosteritiedostot."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "local"))
import open_roster_pr as r  # noqa: E402


def test_branch_is_dated_and_unique():
    assert r.branch_name(set(), "2026-11-23") == "roster/2026-11-23"
    assert r.branch_name({"roster/2026-11-23", "roster/2026-11-23-2"}, "2026-11-23") == "roster/2026-11-23-3"


def test_only_roster_files_are_committed():
    ok, other = r.check_files(["data/transfers_2026_27.txt", ".github/workflows/ci.yml", "src/liiga/model.py"])
    assert ok == ["data/transfers_2026_27.txt"] and other == [".github/workflows/ci.yml", "src/liiga/model.py"]


def test_no_merge_or_free_refspec_in_source():
    src = Path(r.__file__).read_text(encoding="utf-8")
    assert "merge" not in src.replace("yhdistämistä", "") and '"push", "-q", "-u", "origin", f"refs/heads/{name}"' in src
