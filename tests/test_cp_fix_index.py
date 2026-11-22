"""cp-fix-pr pr-työn indeksitarkistus (katselmointi M1): oikeat git-repot ja käsin tehdyt patchit."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "ci"))
import cp_worker  # noqa: E402

G = ["/usr/bin/git", "-c", "user.name=t", "-c", "user.email=t@t"]


def _repo(tmp_path: Path) -> Path:
    r = tmp_path / "r"
    (r / "src").mkdir(parents=True)
    (r / "src" / "a.py").write_text("x = 1\n")
    subprocess.run([*G, "init", "-q", str(r)], check=True)
    subprocess.run([*G, "-C", str(r), "add", "-A"], check=True)
    subprocess.run([*G, "-C", str(r), "commit", "-qm", "init"], check=True)
    return r


def _make_patch(r: Path, change) -> Path:
    change(r)
    subprocess.run([*G, "-C", str(r), "add", "-A"], check=True)
    patch = r.parent / "fix.patch"
    patch.write_text(subprocess.run([*G, "-C", str(r), "diff", "--cached", "--binary", "--no-renames"],
                                    check=True, capture_output=True, text=True).stdout)
    subprocess.run([*G, "-C", str(r), "reset", "-q", "--hard"], check=True)
    subprocess.run([*G, "-C", str(r), "clean", "-qfd"], check=True)
    subprocess.run(["/usr/bin/git", "-C", str(r), "apply", "--index", str(patch)], check=True)
    return patch


def test_regular_change_in_src_passes(tmp_path):
    r = _repo(tmp_path)
    p = _make_patch(r, lambda r: (r / "src" / "a.py").write_text("x = 2\n"))
    assert cp_worker.index_problems(str(p), cwd=str(r)) == []


@pytest.mark.parametrize("make,needle", [
    (lambda r: (r / "src" / "link").symlink_to("../../etc/passwd"), "ei tavallinen tiedosto"),
    (lambda r: (r / ".github").mkdir() or (r / ".github" / "w.yml").write_text("on: push\n"), "kielletty polku"),
    (lambda r: (r / "src" / "a.py").rename(r / "scripts.py"), "kielletty polku"),
])
def test_crafted_patches_rejected(tmp_path, make, needle):
    r = _repo(tmp_path)
    p = _make_patch(r, make)
    assert any(needle in x for x in cp_worker.index_problems(str(p), cwd=str(r)))


def test_header_must_list_every_numstat_path(tmp_path):
    r = _repo(tmp_path)
    p = _make_patch(r, lambda r: (r / "src" / "a.py").write_text("x = 2\n"))
    # Väärennetty otsikko: diff --git -rivi sanoo src/a.py, mutta ---/+++ osoittavat muualle.
    p.write_text(p.read_text().replace("+++ b/src/a.py", "+++ b/tests/conftest.py").replace("--- a/src/a.py", "--- a/tests/conftest.py"))
    subprocess.run(["/usr/bin/git", "-C", str(r), "reset", "-q", "--hard"], check=True)
    bad = cp_worker.index_problems(str(p), cwd=str(r))
    assert bad, bad
