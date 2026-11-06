"""Henkilökuvat heatmap-GIFin tapahtumapaneeleihin (7.11.2026, scripts/local/heatmap_gif.py).

Vain Wikimedia Commonsin vapaasti lisensoidut kuvat (CC BY / CC BY-SA), tekijä ja lisenssi
näkyvät kuvan alla. Kuvat haetaan Commonsin API:sta välimuistiin (~/.cache/liiga-ennuste/people),
eikä niitä tallenneta repoon. Kuva rasteroidaan kultaisiksi rasteripisteiksi (sama kieli kuin
heatmapin laatat); muokkaus mainitaan tekijätiedossa ("rasteroitu").

Jos vapaata kuvaa ei ole tai henkilöä ei voi varmasti tunnistaa kuvasta (Jouko Myrrän
Commons-kuvassa on useita ihmisiä), käytetään nimikirjaimia samalla rasterityylillä.
"""
from __future__ import annotations

import json
import math
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

CACHE = Path.home() / ".cache" / "liiga-ennuste" / "people"
UA = {"User-Agent": "liiga-ennuste/1.0 (personal hockey forecast; github.com/mikaheino/liiga-2026-27)"}
# Rajaus (x0, y0, x1, y1) osuutena kuvasta: kasvot käsin tarkistettu 7.11.2026.
PEOPLE = {
    "Jori Lehterä": ("Jori_Lehtera_2016.jpg", (.30, .14, .82, .56), "Don Bigileone, CC BY 2.0"),
    "Tomek Valtonen": ("Tomek_Valtonen.JPG", (.52, .07, .65, .20), "Henkkapet, CC BY-SA 4.0"),
    "Kai Suikkanen": ("2023-01-13_Eisbären_Berlin_gegen_Augsburger_Panther_(Deutsche_Eishockey-Liga_2022-23)"
                      "_by_Sandro_Halank–118.jpg", (.10, .02, .95, .58), "Sandro Halank, CC BY-SA 4.0"),
    "Kari Jalonen": ("2025-04-21_Eisbären_Berlin_gegen_Kölner_Haie_(Deutsche_Eishockey-Liga_2024-25)"
                     "_by_Sandro_Halank–124.jpg", (.10, .02, .85, .55), "Sandro Halank, CC BY-SA 4.0"),
    "Fredrik Norrena": ("2025-10-16_Dresdner_Eislöwen_gegen_Kölner_Haie_(Deutsche_Eishockey-Liga_2025-26)"
                        "_by_Sandro_Halank–053.jpg", (.20, .02, .95, .66), "Sandro Halank, CC BY-SA 4.0"),
    "Olli Jokinen": ("Olli_Jokinen_-_Winnipeg_Jets.jpg", (.45, .0, .75, .27), "Lisa Gansky, CC BY-SA 2.0"),
}


def _fetch(file: str) -> Path:
    path = CACHE / (file.replace("/", "_") + ".thumb.jpg")
    if path.exists():
        return path
    q = urllib.parse.urlencode({"action": "query", "format": "json", "prop": "imageinfo",
                                "iiprop": "url", "iiurlwidth": "600", "titles": f"File:{file}"})
    req = urllib.request.Request(f"https://commons.wikimedia.org/w/api.php?{q}", headers=UA)
    page = next(iter(json.load(urllib.request.urlopen(req, timeout=30))["query"]["pages"].values()))
    url = page["imageinfo"][0]["thumburl"]
    if not url.startswith(("https://upload.wikimedia.org/", "https://thumb.wikimedia.org/")):
        raise ValueError(f"odottamaton kuvaosoite: {url}")
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_bytes(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read())
    return path


def _photo(name: str) -> Image.Image | None:
    if name not in PEOPLE:
        return None
    file, (x0, y0, x1, y1), _ = PEOPLE[name]
    try:
        im = Image.open(_fetch(file)).convert("RGB")
    except Exception as exc:                                # noqa: BLE001 - verkko: nimikirjaimet
        print(f"kuva {name}: {exc}")
        return None
    w, h = im.size
    return im.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)))


def credit(name: str) -> str | None:
    return f"Kuva: {PEOPLE[name][2]}, rasteroitu" if name in PEOPLE else None


def _disc(size: int, bg: tuple) -> tuple[Image.Image, Image.Image]:
    img = Image.new("RGB", (size, size), bg)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    return img, mask


def halftone(photo: Image.Image, size: int, fg: tuple, bg: tuple, cells: int = 64) -> Image.Image:
    """Rasteripisteet: harmaasävy ruudukoksi, pisteen ala valoisuuden mukaan (kulta tummalla).
    Vinjetti tummentaa reunat, jotta kirkas tausta ei kilpaile kasvojen kanssa (testattu 7.11.:
    64 pistettä, gamma 1,4, säde 0,58 ja paikallinen kontrasti erottivat kasvot parhaiten)."""
    g = ImageOps.autocontrast(ImageOps.grayscale(ImageOps.fit(photo, (size, size))), cutoff=2)
    # Paikallinen kontrasti: tasaisesti valaistut kasvot muuten yhtä pistemassaa (testattu 7.11.).
    g = g.filter(ImageFilter.UnsharpMask(radius=18, percent=200, threshold=0))
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).ellipse((size * .08, size * .02, size * .92, size * 1.0), fill=255)
    g = Image.composite(g, Image.new("L", (size, size), 20), m.filter(ImageFilter.GaussianBlur(size * .10)))
    g = g.resize((cells, cells), Image.LANCZOS)
    img, mask = _disc(size, bg)
    d = ImageDraw.Draw(img)
    c = size / cells
    for j in range(cells):
        for i in range(cells):
            r = 0.58 * c * (g.getpixel((i, j)) / 255) ** 1.4
            if r > 0.45:
                cx, cy = (i + .5) * c, (j + .5) * c
                d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fg)
    out = Image.new("RGBA", (size, size))
    out.paste(img, (0, 0), mask)
    return out


def initials(name: str, size: int, fg: tuple, bg: tuple, font: ImageFont.FreeTypeFont) -> Image.Image:
    """Ei vapaata kuvaa: nimikirjaimet rasterikehän sisällä."""
    img, mask = _disc(size, bg)
    d = ImageDraw.Draw(img)
    for k in range(48):                                 # pisteistä tehty kehä
        a = 2 * math.pi * k / 48
        cx, cy = size / 2 + (size / 2 - 9) * math.cos(a), size / 2 + (size / 2 - 9) * math.sin(a)
        d.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), fill=fg)
    d.text((size / 2, size / 2), "".join(p[0] for p in name.split()[:2]), font=font, fill=fg, anchor="mm")
    out = Image.new("RGBA", (size, size))
    out.paste(img, (0, 0), mask)
    return out


def portrait(name: str, size: int, fg: tuple, bg: tuple, font: ImageFont.FreeTypeFont) -> Image.Image:
    ph = _photo(name)
    return halftone(ph, size, fg, bg) if ph is not None else initials(name, size, fg, bg, font)
