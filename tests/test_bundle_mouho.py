"""Pelin jäädytys: kaikki skriptit upotetaan, eikä ulkoisia skriptitiedostoja jää."""
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("bundle_mouho", ROOT / "scripts/tools/bundle_mouho.py")
bundle_mouho = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bundle_mouho)


def test_bundle_inlines_every_script(tmp_path):
    out = bundle_mouho.bundle("testi", tmp_path)
    html = out.read_text(encoding="utf-8")
    assert '<script src="' not in html
    for name in ("engine/core.js", "mouho/art.js", "mouho/rooms/kisapuisto.js", "mouho/main.js"):   # moottori/sisältö-rakenne (24.10.)
        assert f"/* {name} */" in html
    assert "<title>Mouhon salaisuus testi</title>" in html
    assert "startEngine(" in html          # pelin käynnistys mukana
