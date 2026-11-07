"""Yksinkertainen sijaintijakauma-GIF LinkedIn-karusellin ilmeellä.

    python scripts/local/heatmap_simple.py --out ~/Downloads/liiga-heatmap-simple.gif

Ilme on sama kuin build_instagram.py:n dioissa: seepiahalli-tausta, kultainen
kursiivi Arial Black -otsikko, ohut kultaviiva ja kermanvalkoinen laatikko
numerolle. Kerrontaa ei ole: kausi etenee tilannekuva kerrallaan, ja kultaviiva täyttyy pelattujen otteluiden
mukaan. Rivit (logo + nimi) liukuvat ennustetun sijan mukaan läpinäkymättöminä
kortteina, ja ohittaja piirretään päälle. Ei nuolia eikä kehyksiä (käyttäjä 7.11.).
Data ja tilannekuvien valinta tulevat heatmap_gif.load():sta.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import heatmap_gif as g
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
W, H, N = 1080, 1350, 17

# build_instagram.py:n paletti (GOLD, GOLD_HI, GOLD_LO, CREAM, INK, MUTED)
GOLD, GOLD_HI, GOLD_LO = (217, 182, 84), (247, 231, 173), (169, 130, 44)
CREAM, INK, MUTED = (242, 236, 224), (21, 15, 9), (168, 152, 128)
RED = (214, 92, 76)
EMPTY = (38, 28, 18)
# Laatan väri: seepiasta kultaan ja kermaan, sama suunta kuin dioissa.
RAMP = [EMPTY, (74, 54, 26), (128, 96, 42), (182, 142, 60), (226, 190, 98), (247, 231, 173)]

BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
BODY = str(ROOT / "site/assets/fonts/hanken-grotesk-400-latin.woff2")
SHEAR = 0.2                                 # kursiivi: Arial Blackissa ei ole kursiivileikkausta

TWEEN, TWEEN_MS, HOLD_MS = 4, 80, 1800
FIRST_MS, LAST_MS = 2600, 5000

# Asettelu
X0, CELL, GAP = 300, 42, 8                  # ruudukon vasen reuna, solun leveys, vyöhykeväli
TOP, ROW = 330, 52                          # ensimmäisen rivin yläreuna, rivikorkeus
GAP_AFTER = {6, 10, 14}


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def col_x(i: int) -> int:
    """Sarakkeen i (0-16) vasen reuna; vyöhykkeiden väliin rako."""
    return X0 + i * CELL + GAP * sum(1 for k in GAP_AFTER if i >= k)


def ramp(p: float) -> tuple[int, int, int]:
    x = g.level(p) * (len(RAMP) - 1)
    i = min(int(x), len(RAMP) - 2)
    f = x - i
    return tuple(round(RAMP[i][k] + (RAMP[i + 1][k] - RAMP[i][k]) * f) for k in range(3))


def background() -> Image.Image:
    """Dian 1 radial-gradient (120% 85% at 78% 8%) numpylla."""
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((x - 0.78 * W) / (1.2 * W)) ** 2 + ((y - 0.08 * H) / (0.85 * H)) ** 2)
    stops = [(0, (90, 64, 40)), (0.32, (58, 40, 24)), (0.58, (36, 26, 16)), (1.0, INK)]
    out = np.zeros((H, W, 3), np.float32)
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        m = (d >= a) & (d < b)
        t = ((d - a) / (b - a))[..., None]
        out[m] = (np.array(ca) * (1 - t) + np.array(cb) * t)[m]
    out[d >= 1.0] = INK
    return Image.fromarray(out.round().astype(np.uint8))


def italic(img: Image.Image, xy: tuple[int, int], text: str, f: ImageFont.FreeTypeFont,
           fill=CREAM, gradient: tuple | None = None, spacing: int = 0, anchor: str = "l") -> int:
    """Piirtää vinon tekstin; palauttaa leveyden. anchor l/r = vasen/oikea reuna."""
    chars = list(text) if spacing else [text]
    widths = [f.getlength(c) + spacing for c in chars]
    w = int(sum(widths)) + 4
    asc, desc = f.getmetrics()
    h = asc + desc
    pad = int(h * SHEAR) + 4
    mask = Image.new("L", (w + pad, h), 0)
    d = ImageDraw.Draw(mask)
    x = pad
    for c, cw in zip(chars, widths):
        d.text((x, 0), c, font=f, fill=255)
        x += cw
    mask = mask.transform(mask.size, Image.AFFINE, (1, SHEAR, -SHEAR * h, 0, 1, 0), Image.BICUBIC)
    if gradient:
        col = np.linspace(0, 1, h)[:, None, None]
        top, bot = np.array(gradient[0]), np.array(gradient[1])
        layer = Image.fromarray((top * (1 - col) + bot * col).repeat(w + pad, 1).astype(np.uint8))
    else:
        layer = Image.new("RGB", mask.size, fill)
    x0 = xy[0] - pad if anchor == "l" else xy[0] - w - pad
    img.paste(layer, (x0, xy[1]), mask)
    return w


def fi(iso: str) -> str:
    return f"{int(iso[8:10])}.{int(iso[5:7])}."


def static_layer(bg: Image.Image) -> Image.Image:
    img = bg.copy()
    d = ImageDraw.Draw(img)
    italic(img, (64, 60), "LIIGA 2026–27 · KAUSIENNUSTE", font(BLACK, 20), fill=CREAM, spacing=5)
    shadow = Image.new("RGB", (W, H), INK)
    sm = Image.new("L", (W, H), 0)
    italic(sm, (68, 96), "MIHIN KUKIN", font(BLACK, 66), fill=150)
    italic(sm, (68, 172), "PÄÄTYY?", font(BLACK, 66), fill=150)
    img.paste(shadow, (0, 0), sm.filter(ImageFilter.GaussianBlur(4)))
    grad = (GOLD_HI, GOLD_LO)
    italic(img, (64, 92), "MIHIN KUKIN", font(BLACK, 66), gradient=grad)
    italic(img, (64, 168), "PÄÄTYY?", font(BLACK, 66), gradient=grad)
    # Sarakeotsikot ja vyöhykkeet
    small = font(BODY, 18)
    zones = [(0, 5, "suoraan puolivälieriin", GOLD), (6, 9, "säälipudotus", MUTED), (14, 16, "putoaa", RED)]
    for a, b, label, c in zones:
        xa, xb = col_x(a), col_x(b) + CELL - 4
        d.line((xa, TOP - 44, xb, TOP - 44), fill=c, width=2)
        d.text(((xa + xb) / 2, TOP - 52), label, font=small, fill=c, anchor="ms")
    for i in range(N):
        d.text((col_x(i) + (CELL - 4) / 2, TOP - 14), str(i + 1), font=font(BLACK, 17),
               fill=MUTED, anchor="md")
    foot = font(BODY, 21)
    d.text((64, H - 66), "Solu = todennäköisyys päätyä sijalle (%), 10 000 simuloitua kautta.",
           font=foot, fill=MUTED)
    d.text((64, H - 38), "Rivit ennustetun sijan mukaan · data liiga.fi", font=foot, fill=MUTED)
    return img


def frame(base: Image.Image, logo: dict, s: dict, ys: dict, moves: dict,
          played: int, date: str) -> Image.Image:
    """ys = rivin paikka (liukuluku), moves = sijamuutos edelliseen (+ = nousi; piirtojärjestys)."""
    img = base.copy()
    d = ImageDraw.Draw(img)
    # Päivämäärä kermalaatikossa (kuten dian sijanumero) ja otteluita pelattu.
    bx0, by0, bx1, by1 = 760, 96, 1016, 172
    d.polygon([(bx0 + 10, by0), (bx1 + 4, by0), (bx1 - 6, by1), (bx0, by1)], fill=CREAM)
    italic(img, ((bx0 + bx1) // 2 + 2 - int(font(BLACK, 46).getlength(date)) // 2, by0 + 6), date,
           font(BLACK, 46), fill=INK)
    d.text((bx1, by1 + 14), f"{played}/{g.TOTAL_GAMES} ottelua pelattu", font=font(BODY, 22),
           fill=GOLD, anchor="ra")
    # Kultaviiva päivämäärän alla = kauden eteneminen.
    ly, lx0, lx1 = by1 + 52, bx0, bx1
    d.line((lx0, ly, lx1, ly), fill=(70, 54, 30), width=4)
    d.line((lx0, ly, lx0 + (lx1 - lx0) * played / g.TOTAL_GAMES, ly), fill=GOLD, width=4)

    name_f, num_f = font(BLACK, 23), font(BLACK, 16)
    # Rivi on läpinäkymätön kortti, ja pisimmän matkan liikkuja piirretään päällimmäiseksi: se
    # ohittaa ±1-liikkujat, jotka jäävät hetkeksi osittain sen alle (nousijat piirtäen jälkimmäisinä
    # peittäisivät kolme sijaa putoavan kokonaan, 7.11. kokeiltu).
    for t in sorted(ys, key=lambda t: (abs(moves[t]), moves[t] > 0)):
        y = round(TOP + ys[t] * ROW)
        box = (56, y - 3, W - 40, y + ROW - 3)
        img.paste(base.crop(box), box[:2])  # näkymätön kortti: taustaa, mutta peittää alle jäävän
        if t in logo:
            lg = logo[t]
            img.paste(lg, (64 + (40 - lg.width) // 2, y + (ROW - 6 - lg.height) // 2), lg)
        italic(img, (118, y + 9), t.upper(), name_f, fill=CREAM)
        for i, p in enumerate(s["p"][t]):
            x = col_x(i)
            c = ramp(p)
            d.rectangle((x, y, x + CELL - 4, y + ROW - 6), fill=c)
            pct = round(p * 100)
            if pct >= 5:
                ink = INK if g.level(p) > 0.55 else CREAM
                d.text((x + (CELL - 4) / 2, y + (ROW - 6) / 2), str(pct), font=num_f, fill=ink,
                       anchor="mm")
    return img


def mix(a: dict, b: dict, f: float) -> dict:
    return {"p": {t: [x + (y - x) * f for x, y in zip(a["p"][t], b["p"][t])] for t in a["p"]}}


TRANSPARENT = 255                           # paletin vapaa indeksi (käytössä 0-254)


def delta(q: list[Image.Image]) -> list[Image.Image]:
    """Muuttumattomat pikselit läpinäkyviksi: otsikko, tausta ja paikallaan pysyvät rivit
    pakkautuvat lähes ilmaiseksi (GIF piirtää ruudun edellisen päälle, disposal 1)."""
    out, prev = [q[0]], np.array(q[0])
    for im in q[1:]:
        cur = np.array(im)
        diff = cur.copy()
        diff[cur == prev] = TRANSPARENT
        f = Image.fromarray(diff, "P")
        f.putpalette(im.getpalette())
        out.append(f)
        prev = cur
    return out


def weekly(snaps: list[dict]) -> list[dict]:
    """Lähtötila ja kunkin viikon viimeinen tilannekuva: liikkuvat rivit vaihtavat koko ruudukon
    joka ruudussa, joten päivittäin GIF kasvaisi yli 5 Mt:n, ja viikon liike on helpompi seurata."""
    from datetime import date
    out: dict = {}
    for s in snaps[1:]:
        out[date.fromisoformat(s["date"]).isocalendar()[:2]] = s
    return snaps[:1] + list(out.values())


def build(out: Path) -> None:
    snaps = weekly(g.load())
    teams = list(snaps[-1]["p"])
    logo = g.logos(teams, 38)
    base = static_layer(background())
    frames, durs = [], []

    def add(s, ra, rb, f, played, date, ms):
        e = f * f * (3 - 2 * f)                       # pehmeä kiihdytys ja jarrutus
        ys = {t: ra[t] + (rb[t] - ra[t]) * e for t in teams}
        moves = {t: ra[t] - rb[t] for t in teams}
        frames.append(frame(base, logo, s, ys, moves, played, date))
        durs.append(ms)

    for k, s in enumerate(snaps):
        date = fi(s["date"])
        if k:
            prev = snaps[k - 1]
            for j in range(1, TWEEN + 1):
                f = j / (TWEEN + 1)
                played = round(prev["played"] + (s["played"] - prev["played"]) * f)
                add(mix(prev, s, f), prev["rank"], s["rank"], f, played, date, TWEEN_MS)
        ms = FIRST_MS if k == 0 else LAST_MS if k == len(snaps) - 1 else HOLD_MS
        ra = snaps[k - 1]["rank"] if k else s["rank"]
        add(s, ra, s["rank"], 1.0, s["played"], date, ms)

    pal = Image.new("P", (1, 1))
    fixed = [EMPTY, CREAM, INK, MUTED, GOLD, GOLD_HI, GOLD_LO, RED, (70, 54, 30)]
    fixed += [ramp(min(1.0, 0.4 * (i / 63) ** (1 / 0.55))) for i in range(64)]
    # Taustan liukuväri omilla askelillaan, ettei mediaanileikkaus porrasta sitä.
    fixed += [tuple(round(a + (b - a) * i / 47) for a, b in zip(INK, (90, 64, 40))) for i in range(48)]
    rest = 255 - len(fixed)
    sample = Image.new("RGB", (W, H * 3))
    for i, f in enumerate(frames[:: max(1, len(frames) // 3)][:3]):
        sample.paste(f, (0, H * i))
    extra = sample.quantize(colors=rest, method=Image.Quantize.MEDIANCUT).getpalette()[:rest * 3]
    flat = [c for rgb in fixed for c in rgb] + extra
    pal.putpalette(flat + [0] * (768 - len(flat)))
    # Staattinen pohja rasteroidaan kerran (ei porrastusta liukuväriin); ruuduista kvantisoidaan
    # vain se, mikä eroaa pohjasta, jotta rasterointi ei vaihtele ruudusta toiseen.
    qbase = np.array(base.quantize(palette=pal, dither=Image.Dither.FLOYDSTEINBERG))
    rgb_base = np.array(base)
    q = []
    for f in frames:
        qf = np.array(f.quantize(palette=pal, dither=Image.Dither.NONE))
        changed = (np.array(f) != rgb_base).any(axis=2)
        im = Image.fromarray(np.where(changed, qf, qbase).astype(np.uint8), "P")
        im.putpalette(pal.getpalette())
        q.append(im)
    q = delta(q)
    q[0].save(out, save_all=True, append_images=q[1:], duration=durs, loop=0, optimize=False,
              transparency=TRANSPARENT, disposal=1)
    mb = out.stat().st_size / 1e6
    print(f"{out}: {len(q)} ruutua, {sum(durs) / 1000:.1f} s, {mb:.2f} Mt")
    assert len(q) <= 250 and mb <= 5.0, "LinkedIn-rajat ylittyvät"


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=Path.home() / "Downloads/liiga-heatmap-simple.gif")
    build(ap.parse_args().out)
