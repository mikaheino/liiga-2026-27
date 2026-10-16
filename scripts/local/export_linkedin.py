"""Render every LinkedIn asset into one folder, for the app's download section.

    python scripts/local/export_linkedin.py --out /tmp/liiga-linkedin

Writes <out>/<stamp>/ with one PDF per asset, a small preview PNG per slide
and manifest.json describing them. <stamp> is the forecast's own
prediction_meta.updated_at, so a folder is valid for exactly one forecast and
the app knows when to render again.

Uses the same builders as the Streamlit section (build_instagram.py), so the
slides cannot drift from what has been published. It never calls build() and
never touches site_instagram/ -- that folder holds the published carousel.

The folder is written under a temporary name and renamed at the end: the app
may poll while this runs, and must never see half a manifest.
"""
from __future__ import annotations

import argparse
import io
import json
import shutil
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_instagram as b  # noqa: E402

# key, title, file stem, description -- the description is written for the
# person choosing what to post, not for the reader of the post.
ASSETS = [
    ("tilanne", "Sarjataulukko nyt", "ennuste",
     "Viisi diaa: ennuste kolmessa osassa (1.–6., 7.–12., 13.–17.) sekä "
     "palkintovalinnat ja tulokkaiden kuusikko toteumineen. Nuoli ja alkup. "
     "vertaavat esikauden julkaistuun ennusteeseen.", "live_slides"),
    ("combo", "Ennuste ja yllättäjät", "ennuste-ja-yllattajat",
     "Neljä diaa: ennuste nyt vs. esikausi, yllättäjät kentällä, "
     "varjosarjataulukko ja yllättäjäjoukkueet. Osumaprosentti kuuluu "
     "postauksen tekstiin.", "scorecard_surprise_post"),
    ("score", "Välitilinpäätös", "valitilinpaatos",
     "Miten malli on osunut verrattuna siihen, että kotijoukkue voittaa aina, "
     "ja ennuste nyt rinnakkain esikauden ja sarjasijan kanssa.", "scorecard_post"),
    ("surprise", "Alkukauden yllättäjät", "yllattajat",
     "Pisteet vs. esikauden odotus juuri pelatuista otteluista, ja oman "
     "ennusteensa ylittäneiden kokoonpano kentän muodossa.", "surprise_post"),
    ("xg", "Varjosarjataulukko", "varjosarjataulukko",
     "Sarjataulukko maalipaikkojen (xG) mukaan, ja kumpaan taulukkoon viisi "
     "edellistä kautta sanovat kannattavan uskoa.", "xg_post"),
    ("mv", "Maalivahdit", "maalivahdit",
     "Torjunnat keskivertomaalivahtiin verrattuna samoista paikoista: "
     "kovimmat torjujat ja vaikein alku.", "goalie_post"),
    ("forty", "Peli ratkeaa 40 minuutissa", "40-minuuttia",
     "Kuinka usein kahden erän jälkeen johtava voittaa: tämä kausi viittä "
     "edellistä vasten, ja joukkueittain.", "forty_post"),
]

PREVIEW_W = 432                                      # 1080 / 2.5, riittää ruudukkoon


def updated_at() -> str:
    con = b.get_connection()
    try:
        meta = b.query_df(con, "SELECT updated_at FROM prediction_meta")
    finally:
        con.close()
    return "" if meta.empty else str(meta.iloc[0]["updated_at"])


def stamp_dir(stamp: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in stamp)


def preview(png: bytes) -> bytes:
    img = Image.open(io.BytesIO(png)).convert("RGB")
    img = img.resize((PREVIEW_W, round(img.height * PREVIEW_W / img.width)), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def export(out: Path, only: set[str] | None = None) -> Path:
    stamp = updated_at()
    final = out / stamp_dir(stamp)
    tmp = out / f".{stamp_dir(stamp)}.partial"
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)

    entries = []
    for key, title, stem, desc, fn in ASSETS:
        if only and key not in only:
            continue
        try:
            slides = getattr(b, fn)()
            error = "" if slides else "ei dataa"
        except Exception as exc:                          # noqa: BLE001 -- kerro syy, älä katoa
            slides, error = [], str(exc).strip().splitlines()[0][:300]
        pages = []
        for i, (_name, png) in enumerate(slides, 1):
            (tmp / f"{key}_{i}.png").write_bytes(preview(png))
            pages.append(f"{key}_{i}.png")
        if slides:
            (tmp / f"{key}.pdf").write_bytes(b.slides_to_pdf(slides))
        entries.append({"key": key, "title": title, "file": f"liiga-{stem}-{stamp[:10]}.pdf",
                        "description": desc, "pages": pages,
                        "pdf": f"{key}.pdf" if slides else None, "error": error})
        print(f"  {key:9s} {len(slides)} diaa {error}", flush=True)

    (tmp / "manifest.json").write_text(
        json.dumps({"updated_at": stamp, "assets": entries}, ensure_ascii=False, indent=1),
        encoding="utf-8")
    shutil.rmtree(final, ignore_errors=True)
    tmp.rename(final)
    return final


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--stamp", action="store_true", help="tulosta vain ennusteen aikaleima")
    ap.add_argument("--only", help="pilkuin erotetut avaimet, oletus kaikki")
    args = ap.parse_args()
    if args.stamp:
        print(updated_at())
        return
    print(export(args.out, set(args.only.split(",")) if args.only else None))


if __name__ == "__main__":
    main()
