"""Valokuvasta pikselipää Mouho-peliin (17.10.: Jussi "lähes 1:1" keltapaitakuvasta).

Rajaa pään, poistaa taustan (harmaa, reunoihin yhteydessä) ja pelipaidan, pienentää
pelin kokoihin, kvantisoi pieneen palettiin ja kirjoittaa tuloksen JS-datana
public/mouho/pixfaces.js:ään. Valokuvaa itseään ei kopioida repoon.

    python scripts/tools/pixel_face.py jussi <kuva> --box 33 0 407 468 --chin 425 --jaw 220 150 \\
        --eye 170 203 --eye 281 203 --mouth 220 318 105
"""
from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "snowflake/LIIGA/CODE/application_services/LIIGA_ENNUSTE/public/mouho/pixfaces.js"
SIZES = {"world": (20, 25), "portrait": (60, 75)}


def flat(im: Image.Image) -> list[int]:
    return list(im.get_flattened_data() if hasattr(im, "get_flattened_data") else im.getdata())


def hexc(rgb: list[int]) -> str:
    return "#" + "".join(f"{c:02x}" for c in rgb)


def mask(im: Image.Image, chin: int, cx: float, half: float) -> Image.Image:
    """Tausta = vähäkylläinen harmaa, joka on yhteydessä kuvan reunaan; paita = leuan alla."""
    w, h = im.size
    px = im.load()

    def grey(x: int, y: int) -> bool:
        r, g, b = px[x, y]
        return max(r, g, b) - min(r, g, b) < 40
    bg = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque((x, 0) for x in range(w))
    for y in range(h):
        q.extend([(0, y), (w - 1, y)])
    while q:
        x, y = q.popleft()
        if not (0 <= x < w and 0 <= y < h) or bg[y][x] or not grey(x, y):
            continue
        bg[y][x] = True
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    m = Image.new("L", (w, h), 0)
    mp = m.load()
    for y in range(h):
        for x in range(w):
            # leuan kaari: leuan alla vain leuan levyinen alue (pelipaita ja kaulus pois)
            k = (y - (chin - 90)) / 90
            if bg[y][x] or y > chin or (k > 0 and abs(x - cx) > half * (1 - .62 * k * k)):
                continue
            mp[x, y] = 255
    return m


def hair_color(im: Image.Image, m: Image.Image, top: float) -> tuple[int, int, int]:
    """Tukan mediaaniväri: kylläiset pikselit pään yläosasta."""
    ip, mp = im.load(), m.load()
    px = [ip[x, y] for y in range(int(top)) for x in range(im.width) if mp[x, y] and max(ip[x, y]) - min(ip[x, y]) >= 42]
    if not px:
        return (200, 170, 100)
    return tuple(sorted(c[k] for c in px)[len(px) // 2] for k in range(3))


def build(src: Path, box: tuple[int, int, int, int], chin: int, colors: int, jaw: tuple[float, float],
          eyes: list[tuple[int, int]], mouth: tuple[int, int, int]) -> dict:
    im = Image.open(src).convert("RGB").crop(box)
    m = mask(im, chin - box[1], jaw[0] - box[0], jaw[1])
    # taustan harmaa ohuiden hiusten läpi: yläosan harmaat maskin pikselit tukan väriksi
    hair = hair_color(im, m, (chin - box[1]) * .35)
    ip, mp = im.load(), m.load()
    for y in range(int((chin - box[1]) * .5)):
        for x in range(im.width):
            r, g, b = ip[x, y]
            if mp[x, y] and max(r, g, b) - min(r, g, b) < 42:
                ip[x, y] = hair
    # pikselitaiteen kirkkaus: kylläisyys ja kontrasti ylös, terävöitys ennen pienennystä
    im = ImageEnhance.Color(im).enhance(1.12)
    im = ImageEnhance.Contrast(im).enhance(1.1)
    im = im.filter(ImageFilter.UnsharpMask(radius=3, percent=120, threshold=2))
    out = {}
    for size, (w, h) in SIZES.items():
        small = im.resize((w, h), Image.Resampling.BOX)
        ms = m.resize((w, h), Image.Resampling.BOX)
        # reunan harmaat (tausta sekoittunut hiuksiin) pois
        sp, mp = small.load(), ms.load()
        for y in range(h):
            for x in range(w):
                r, g, b = sp[x, y]
                if mp[x, y] < 200 and max(r, g, b) - min(r, g, b) < 40:
                    mp[x, y] = 0
        q = small.quantize(colors=colors if size == "portrait" else max(10, colors - 6), method=Image.Quantize.MEDIANCUT)
        pal = q.getpalette()[: 3 * 256]
        idx = flat(q)
        alpha = flat(ms)
        used = sorted({i for i, a in zip(idx, alpha, strict=True) if a >= 128})
        remap = {i: k for k, i in enumerate(used)}
        keys = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
        rows = []
        for y in range(h):
            rows.append("".join(keys[remap[idx[y * w + x]]] if alpha[y * w + x] >= 128 else "." for x in range(w)))
        fx, fy = w / (box[2] - box[0]), h / (box[3] - box[1])
        at = lambda X, Y, fx=fx, fy=fy: (round((X - box[0]) * fx), round((Y - box[1]) * fy))  # noqa: E731
        eye_w = max(2, round(12 * 3.6 * fx))
        out[size] = {"w": w, "h": h, "pal": [hexc(pal[3 * i: 3 * i + 3]) for i in used], "rows": rows,
                     "eyes": [[at(X, Y)[0] - eye_w // 2, at(X, Y)[1], eye_w] for X, Y in eyes],
                     "iris": [list(at(X, Y)) for X, Y in eyes],
                     "mouth": [at(mouth[0] - mouth[2] / 2, mouth[1])[0], at(mouth[0], mouth[1])[1], max(3, round(mouth[2] * fx))]}
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("src", type=Path)
    ap.add_argument("--box", type=int, nargs=4, required=True, help="rajaus kuvan pikseleinä: x0 y0 x1 y1 (kuvasuhde 4:5)")
    ap.add_argument("--chin", type=int, required=True, help="leuan alareuna kuvan pikseleinä; sen alta pois")
    ap.add_argument("--colors", type=int, default=24)
    ap.add_argument("--jaw", type=float, nargs=2, required=True, help="leuan keskikohta x ja puolileveys kuvan pikseleinä")
    ap.add_argument("--eye", type=int, nargs=2, action="append", required=True, help="silmän (iiriksen) keskikohta, kahdesti")
    ap.add_argument("--mouth", type=int, nargs=3, required=True, help="suun keskikohta x y ja leveys")
    a = ap.parse_args()
    data = {}
    if OUT.exists():
        txt = OUT.read_text(encoding="utf-8")
        data = json.loads(txt[txt.index("{"): txt.rindex("}") + 1])
    data[a.name] = build(a.src, tuple(a.box), a.chin, a.colors, tuple(a.jaw), [tuple(e) for e in a.eye], tuple(a.mouth))
    OUT.write_text(
        "// Mouhon salaisuus -- valokuvista pikselöidyt päät (scripts/tools/pixel_face.py).\n"
        "// Generoitu tiedosto: älä muokkaa käsin. Valokuvia ei ole repossa.\n"
        f"const PIXFACES = {json.dumps(data, ensure_ascii=False, separators=(',', ':'))};\n", encoding="utf-8")
    sizes = ", ".join(f"{k} {v['w']}x{v['h']} {len(v['pal'])} väriä" for k, v in data[a.name].items())
    print(f"{a.name}: {sizes} -> {OUT.name}")


if __name__ == "__main__":
    main()
