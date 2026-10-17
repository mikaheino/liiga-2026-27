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

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "snowflake/LIIGA/CODE/application_services/LIIGA_ENNUSTE/public/mouho/pixfaces.js"
SIZES = {"world": (40, 50), "portrait": (80, 100)}   # world piirretään puoleen kokoon 2x-kankaalle


def flat(im: Image.Image) -> list[int]:
    return list(im.get_flattened_data() if hasattr(im, "get_flattened_data") else im.getdata())


def hexc(rgb: list[int]) -> str:
    return "#" + "".join(f"{c:02x}" for c in rgb)


def mask(im: Image.Image, chin: int, cx: float, half: float, poly: list[tuple[float, float]] | None, bg: str, tol: float) -> Image.Image:
    """Pään maski. Tausta = reunasta (tai monikulmion ulkopuolelta) alkava yhtenäinen alue
    taustan näköisiä pikseleitä: bg "grey" = vähäkylläinen harmaa, "sample" = lähellä reunan
    mediaaniväriä (tol). Monikulmio rajaa lisäksi pään ääriviivaan; leuan alta vain leuan kaari."""
    w, h = im.size
    px = im.load()
    inside = Image.new("L", (w, h), 255)
    if poly:
        inside = Image.new("L", (w, h), 0)
        ImageDraw.Draw(inside).polygon(poly, fill=255)
    ins = inside.load()
    edge = [px[x, y] for x in range(0, w, 3) for y in (0, h - 1)] + [px[x, y] for y in range(0, h, 3) for x in (0, w - 1)]
    ref = tuple(sorted(c[k] for c in edge)[len(edge) // 2] for k in range(3))

    def like(x: int, y: int) -> bool:
        r, g, b = px[x, y]
        if bg == "grey":
            return max(r, g, b) - min(r, g, b) < 40
        return (r - ref[0]) ** 2 + (g - ref[1]) ** 2 + (b - ref[2]) ** 2 < tol * tol
    out = [[not ins[x, y] for x in range(w)] for y in range(h)]
    q: deque[tuple[int, int]] = deque((x, y) for y in range(h) for x in range(w) if out[y][x] or x in (0, w - 1) or y in (0, h - 1))
    seen = [[False] * w for _ in range(h)]
    while q:
        x, y = q.popleft()
        if not (0 <= x < w and 0 <= y < h) or seen[y][x]:
            continue
        seen[y][x] = True
        if not (out[y][x] or like(x, y)):
            continue
        out[y][x] = True
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    m = Image.new("L", (w, h), 0)
    mp = m.load()
    for y in range(h):
        for x in range(w):
            k = (y - (chin - 90)) / 90
            if out[y][x] or y > chin or (k > 0 and abs(x - cx) > half * (1 - .62 * k * k)):
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
          eyes: list[tuple[int, int]], mouth: tuple[int, int, int], poly: list[tuple[float, float]] | None = None,
          bg: str = "grey", tol: float = 45, hair_fix: bool = False, bright: float = 1.0) -> dict:
    im = Image.open(src).convert("RGB").crop(box)
    loc = [(x - box[0], y - box[1]) for x, y in poly] if poly else None
    m = mask(im, chin - box[1], jaw[0] - box[0], jaw[1], loc, bg, tol)
    # taustan harmaa ohuiden hiusten läpi: yläosan harmaat maskin pikselit tukan väriksi
    hair = hair_color(im, m, (chin - box[1]) * .35)
    ip, mp = im.load(), m.load()
    for y in range(int((chin - box[1]) * .5) if hair_fix else 0):
        for x in range(im.width):
            r, g, b = ip[x, y]
            if mp[x, y] and max(r, g, b) - min(r, g, b) < 42:
                ip[x, y] = hair
    # pikselitaiteen kirkkaus: kylläisyys ja kontrasti ylös, terävöitys ennen pienennystä
    im = ImageEnhance.Brightness(im).enhance(bright)
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
    ap.add_argument("--poly", help="pään ääriviiva kuvan pikseleinä: 'x,y x,y ...'")
    ap.add_argument("--bg", choices=["grey", "sample"], default="grey", help="taustan tunnistus")
    ap.add_argument("--tol", type=float, default=45, help="sample: etäisyys reunan mediaanivärista")
    ap.add_argument("--hair-fix", action="store_true", help="värjää taustan harmaan ohuessa vaaleassa tukassa (vain vaalea tukka)")
    ap.add_argument("--iris", default="#4c84c8", help="iiriksen väri tai 'none'")
    ap.add_argument("--bright", type=float, default=1.0, help="kirkkauskerroin (tumma kuva)")
    a = ap.parse_args()
    data = {}
    if OUT.exists():
        txt = OUT.read_text(encoding="utf-8")
        data = json.loads(txt[txt.index("{"): txt.rindex("}") + 1])
    poly = [tuple(float(v) for v in p.split(",")) for p in a.poly.split()] if a.poly else None
    data[a.name] = build(a.src, tuple(a.box), a.chin, a.colors, tuple(a.jaw), [tuple(e) for e in a.eye], tuple(a.mouth),
                         poly, a.bg, a.tol, a.hair_fix, a.bright)
    for v in data[a.name].values():
        if a.iris == "none":
            v.pop("iris", None)
        else:
            v["irisC"] = a.iris
    OUT.write_text(
        "// Mouhon salaisuus -- valokuvista pikselöidyt päät (scripts/tools/pixel_face.py).\n"
        "// Generoitu tiedosto: älä muokkaa käsin. Valokuvia ei ole repossa.\n"
        f"const PIXFACES = {json.dumps(data, ensure_ascii=False, separators=(',', ':'))};\n", encoding="utf-8")
    sizes = ", ".join(f"{k} {v['w']}x{v['h']} {len(v['pal'])} väriä" for k, v in data[a.name].items())
    print(f"{a.name}: {sizes} -> {OUT.name}")


if __name__ == "__main__":
    main()
