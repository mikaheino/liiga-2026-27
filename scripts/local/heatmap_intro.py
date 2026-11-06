"""16-bittisen pelin kerronta heatmap-GIFiin (7.11.2026, käyttäjä: "liian kliininen, pohjusta
animaatiota kuten vanhat SNES-pelit").

Ei kopioi mitään peliä: oma teksti, omat värit (sama kulta kuin heatmapissa), vain tyylikeinot.
  intro()        tähtitaivas ja kirjoituskone ("SYKSY 2026. 17 JOUKKUETTA. ..."), välähdys,
                 nimiruutu ja vilkkuva START, joukkueiden esittely yksi kerrallaan,
                 kenttäkortti "KIERROS 1 / ESIKAUSI / VALMIINA?" ja iiris auki heatmapiin.
  month_card()   väliotsikko kuukauden vaihtuessa ("OSA 2 · LOKAKUU"), nauha keskellä.
  ending()       iiris kiinni, "JATKUU..." ja jäljellä olevat ottelut; tekstit häipyvät pelkäksi
                 taivaaksi, josta alku jatkuu saumattomasti (loputon silmukka).
Pikselikirjaimet: teksti piirretään pienenä ilman pehmennystä ja suurennetaan jyrkästi.
Jokainen funktio palauttaa listan (ruutu, kesto ms).
"""
from __future__ import annotations

import random

from PIL import Image, ImageDraw, ImageFont

AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
BLACK, INK, MUTED = (8, 7, 5), (246, 241, 230), (150, 140, 120)
GOLD, GOLD_HI, GOLD_DIM = (204, 167, 82), (235, 202, 104), (74, 58, 24)


def pixel_text(text: str, scale: int, color: tuple, size: int = 11) -> Image.Image:
    f = ImageFont.truetype(AVENIR, size, index=0)
    d = ImageDraw.Draw(Image.new("L", (1, 1)))
    d.fontmode = "1"
    b = d.textbbox((0, 0), text, font=f)
    im = Image.new("L", (b[2] - b[0] + 2, b[3] - b[1] + 2), 0)
    d = ImageDraw.Draw(im)
    d.fontmode = "1"
    d.text((1 - b[0], 1 - b[1]), text, font=f, fill=255)
    im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    out = Image.new("RGBA", im.size, color + (0,))
    out.putalpha(im)
    return out


def put(img: Image.Image, text: str, y: int, scale: int, color: tuple, shadow: tuple | None = None,
        x: int | None = None) -> int:
    """Pikseliteksti keskitettynä (tai x:stä); palauttaa alareunan y:n."""
    t = pixel_text(text, scale, color)
    px = (img.width - t.width) // 2 if x is None else x
    if shadow:
        s = pixel_text(text, scale, shadow)
        img.paste(s, (px + scale, y + scale), s)
    img.paste(t, (px, y), t)
    return y + t.height


class Stage:
    def __init__(self, w: int, h: int, logos: dict[str, Image.Image]):
        self.w, self.h, self.logos = w, h, logos
        rnd = random.Random(2026)
        self.stars = [(rnd.randrange(w), rnd.randrange(h), rnd.choice((1, 1, 2)), rnd.randrange(4)) for _ in range(140)]

    def sky(self, tick: int) -> Image.Image:
        """Tähtitaivas; neljäsosa tähdistä tuikkii vuorollaan (vain muutama pikseli muuttuu)."""
        img = Image.new("RGB", (self.w, self.h), BLACK)
        d = ImageDraw.Draw(img)
        for x, y, r, ph in self.stars:
            c = GOLD_HI if (tick + ph) % 4 == 0 else (90, 80, 62)
            d.rectangle((x, y, x + r, y + r), fill=c)
        return img

    def typewriter(self, lines: list[tuple[str, tuple]], y0: int, scale: int = 4) -> list[tuple]:
        out, tick = [], 0
        for n in range(len(lines)):
            text = lines[n][0]
            step = max(3, len(text) // 4)
            for k in list(range(step, len(text), step)) + [len(text)]:
                img = self.sky(tick)
                y = y0
                for t, col in lines[:n]:
                    y = put(img, t, y, scale, col) + 26
                put(img, text[:k], y, scale, lines[n][1], x=None)
                out.append((img, 70))
                tick += 1
            out[-1] = (out[-1][0], 900)
        return out

    def title(self) -> list[tuple]:
        flash = Image.new("RGB", (self.w, self.h), INK)
        base = self.sky(0)
        y = put(base, "LIIGA", 300, 22, GOLD_HI, shadow=GOLD_DIM)
        y = put(base, "2026-27", y + 30, 9, INK, shadow=GOLD_DIM)
        put(base, "MIHIN KUKIN PÄÄTYY?", y + 90, 5, GOLD)
        on = base.copy()
        sy = self.h - 300
        put(on, "PAINA START", sy, 5, INK)
        d = ImageDraw.Draw(on)
        tw = pixel_text("PAINA START", 5, INK).width
        tx = (self.w - tw) // 2 - 50
        d.polygon([(tx, sy + 8), (tx + 28, sy + 26), (tx, sy + 44)], fill=GOLD_HI)
        frames = [(flash, 80), (base, 700)]
        for _ in range(3):
            frames += [(on, 520), (base, 360)]
        return frames + [(on, 900)]

    def roster(self, teams: list[str]) -> list[tuple]:
        """Joukkueet esittäytyvät yksi kerrallaan 6 x 3 -ruudukossa."""
        frames = []
        img = self.sky(1)
        put(img, "17 JOUKKUETTA", 150, 6, INK)
        put(img, "YKSI RUNKOSARJA", 240, 4, GOLD)
        cols, cw, chh, y0 = 6, 160, 230, 360
        for i, t in enumerate(teams):
            in_row = min(cols, len(teams) - (i // cols) * cols)       # vajaa rivi keskelle
            cx = (self.w - in_row * cw) // 2 + (i % cols) * cw + cw // 2
            cy = y0 + (i // cols) * chh
            d = ImageDraw.Draw(img)
            d.rectangle((cx - 66, cy - 6, cx + 66, cy + 176), outline=GOLD_DIM, width=3)
            lg = self.logos.get(t)
            if lg:
                img.paste(lg, (cx - lg.width // 2, cy + 10), lg)
            name = pixel_text(t.upper(), 2, INK)
            img.paste(name, (cx - name.width // 2, cy + 130), name)
            frames.append((img.copy(), 130))
        frames[-1] = (frames[-1][0], 1600)
        return frames

    def stage_card(self, first: Image.Image) -> list[tuple]:
        base = self.sky(2)
        y = put(base, "KIERROS 1", 420, 4, GOLD)
        put(base, "ESIKAUSI", y + 30, 12, INK, shadow=GOLD_DIM)
        ready, go = base.copy(), base.copy()
        put(ready, "VALMIINA?", 820, 6, GOLD_HI)
        put(go, "ALKAA!", 800, 9, GOLD_HI, shadow=GOLD_DIM)
        frames = [(base, 1100), (ready, 1300), (go, 700)]
        # Iiris auki: heatmap paljastuu kasvavan ympyrän sisältä.
        for r in (120, 340, 620, 900):
            mask = Image.new("L", (self.w, self.h), 0)
            ImageDraw.Draw(mask).ellipse((self.w / 2 - r, self.h / 2 - r, self.w / 2 + r, self.h / 2 + r), fill=255)
            frames.append((Image.composite(first, Image.new("RGB", (self.w, self.h), BLACK), mask), 90))
        return frames

    def month_card(self, under: Image.Image, part: int, month: str) -> tuple:
        img = under.copy()
        d = ImageDraw.Draw(img)
        y0 = self.h // 2 - 120
        d.rectangle((0, y0, self.w, y0 + 240), fill=BLACK)
        d.rectangle((0, y0 + 10, self.w, y0 + 14), fill=GOLD)
        d.rectangle((0, y0 + 226, self.w, y0 + 230), fill=GOLD)
        y = put(img, f"OSA {part}", y0 + 40, 4, GOLD)
        put(img, month, y + 18, 9, INK, shadow=GOLD_DIM)
        return (img, 1900)

    def iris_close(self, still: Image.Image) -> list[tuple]:
        """Heatmap sulkeutuu ympyräksi tähtitaivaalle (alun iiriksen peilikuva)."""
        out = []
        for r in (620, 340, 120, 0):
            mask = Image.new("L", (self.w, self.h), 0)
            if r:
                ImageDraw.Draw(mask).ellipse((self.w / 2 - r, self.h / 2 - r, self.w / 2 + r, self.h / 2 + r), fill=255)
            out.append((Image.composite(still, self.sky(0), mask), 90))
        return out

    def ending(self, left: int, still: Image.Image) -> list[tuple]:
        """Iiris kiinni, JATKUU..., ja tekstit häipyvät käänteisessä järjestyksessä pelkäksi
        taivaaksi: GIFin alku (sama taivas) jatkuu siitä saumattomasti, kierros toisensa perään."""
        a = self.sky(0)
        put(a, "JATKUU...", 440, 11, INK, shadow=GOLD_DIM)
        b = a.copy()
        put(b, f"{left} OTTELUA JÄLJELLÄ", 700, 5, GOLD_HI)
        c = b.copy()
        put(c, "LIIGA ENNUSTE  ·  PÄIVITTYY JOKA AAMU", 820, 3, MUTED)
        return [*self.iris_close(still), (a, 1200), (b, 1400), (c, 3600), (b, 260), (a, 260), (self.sky(0), 900)]


def intro(stage: Stage, teams: list[str], first: Image.Image) -> list[tuple]:
    lines = [("SYKSY 2026.", INK), ("17 JOUKKUETTA.", INK), ("544 OTTELUA.", INK),
             ("JOKA AAMU", MUTED), ("10 000 SIMULOITUA KAUTTA.", GOLD_HI), ("YKSI KYSYMYS:", INK)]
    return [*stage.typewriter(lines, 330), *stage.title(), *stage.roster(teams), *stage.stage_card(first)]
