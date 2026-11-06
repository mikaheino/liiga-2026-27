"""Sijaintijakauman heatmap hitaasti etenevänä GIFinä LinkedIniin (6.11.2026).

Sama data kuin sovelluksen etusivun heatmapissa (components/Heatmap.tsx), mutta julkaisuun
rauhoitettuna: pyöristetyt laatat kultaisella asteikolla, luku vain kun todennäköisyys on
vähintään 3 %, vyöhykkeet (1.–6., 7.–10., 15.–17., lib/table.ts) sarakeväleinä ja otsikkoina,
rivin perässä ennustetut pisteet. Ruudut tulevat position_distribution_historysta (yksi per
päivä, jolloin jakauma muuttui); välissä värit liukuvat ja rivit vaihtavat paikkaa. Mitään
joukkuetta ei korosteta.

    python scripts/local/heatmap_gif.py [--out ~/Downloads/liiga-heatmap.gif]
"""
from __future__ import annotations

import argparse
from pathlib import Path

import duckdb
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
LOGOS = ROOT / "snowflake/LIIGA/CODE/application_services/LIIGA_ENNUSTE/public/logos"
W, H = 1080, 1350                       # 4:5, LinkedInin mobiilisyötteen suurin
BG, EMPTY = (8, 7, 5), (20, 17, 12)
INK, BODY, MUTED, FAINT = (246, 241, 230), (214, 205, 187), (150, 140, 120), (78, 70, 56)
GOLD, GOLD_HI, SILVER, RED = (204, 167, 82), (235, 202, 104), (190, 195, 202), (214, 92, 76)
# Kultainen asteikko tummasta kirkkaaseen (laatan väri todennäköisyyden mukaan).
RAMP = [(28, 23, 15), (66, 51, 24), (120, 92, 40), (178, 138, 60), (226, 186, 96), (250, 228, 160)]
N, TOTAL_GAMES = 17, 544
ZONES = [(1, 6, "suoraan puolivälieriin", GOLD), (7, 10, "säälipudotuspelit", SILVER),
         (11, 14, "", FAINT), (15, 17, "putoamisuhka", RED)]
GAP_AFTER = {6, 10, 14}
TWEEN, TWEEN_MS, HOLD_MS = 3, 140, 560  # siirtymäruudut, niiden kesto ja päivän pysähdys
FIRST_MS, LAST_MS = 2600, 7000
COLORS = 112

AVENIR = "/System/Library/Fonts/Avenir Next.ttc"
MONO = "/System/Library/Fonts/SFNSMono.ttf"


def font(size: int, weight: str = "Medium") -> ImageFont.FreeTypeFont:
    idx = {"Bold": 0, "Demi": 2, "Medium": 5, "Regular": 7}[weight]
    return ImageFont.truetype(AVENIR, size, index=idx)


def mono(size: int, weight: str = "Semibold") -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(MONO, size)
    f.set_variation_by_name(weight)
    return f


def _snap(snaps: dict, r: tuple) -> None:
    s = snaps.setdefault(r[0], {"date": r[0], "played": r[1], "p": {}, "order": {}, "pts": {}})
    s["p"][r[2]] = list(r[3:3 + N])
    s["order"][r[2]] = (r[3 + N] or 99, -(r[4 + N] or 0))
    s["pts"][r[2]] = r[4 + N]


def load() -> list[dict]:
    con = duckdb.connect(str(ROOT / "data/liiga.duckdb"), read_only=True)
    rows = con.execute(f"""
        SELECT h.snapshot_date, h.games_played, h.team, {", ".join(f"h.rank_{i}" for i in range(1, N + 1))},
               p.proj_rank, p.mean_points
        FROM position_distribution_history h
        LEFT JOIN prediction_history p ON p.snapshot_date = h.snapshot_date AND p.team = h.team
        ORDER BY h.snapshot_date, h.team""").fetchall()
    con.close()
    snaps: dict[str, dict] = {}
    for r in rows:
        _snap(snaps, r)
    out, prev = [], None
    for s in snaps.values():
        teams = sorted(s["p"], key=lambda t: (s["order"][t], sum((i + 1) * x for i, x in enumerate(s["p"][t]))))
        s["rank"] = {t: i for i, t in enumerate(teams)}
        key = tuple(round(x, 3) for t in teams for x in s["p"][t])
        if key != prev:                 # vain päivät, joina jakauma muuttui (samoista viimeisin)
            out.append(s)
        else:
            out[-1] = s
        prev = key
    # Esikaudesta vain viimeinen tilannekuva ennen ensimmäistä ottelua.
    pre = [s for s in out if s["played"] == 0]
    return pre[-1:] + [s for s in out if s["played"] > 0]


def logos(teams: list[str], size: int) -> dict[str, Image.Image]:
    out = {}
    for t in teams:
        f = LOGOS / f"{t.lower().replace('ä', 'a').replace('ö', 'o')}.png"
        if f.exists():
            im = Image.open(f).convert("RGBA")
            im.thumbnail((size, size), Image.LANCZOS)
            out[t] = im
    return out


def ramp(x: float) -> tuple[int, int, int]:
    x = max(0.0, min(1.0, x)) * (len(RAMP) - 1)
    i = min(int(x), len(RAMP) - 2)
    f = x - i
    return tuple(round(RAMP[i][k] + (RAMP[i + 1][k] - RAMP[i][k]) * f) for k in range(3))


def level(p: float) -> float:
    """Todennäköisyys asteikolle: potenssiramppi, 40 % ja yli = kirkkain."""
    return min(1.0, (p / 0.40) ** 0.55)


def fi_date(iso: str) -> str:
    return f"{int(iso[8:10])}.{int(iso[5:7])}.{iso[:4]}"


def background() -> Image.Image:
    """Tumma pohja ja pehmeä kultainen hehku vasemmassa yläkulmassa (staattinen: ei kasvata GIFiä)."""
    img = Image.new("RGB", (W, H), BG)
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse((-380, -420, 620, 420), fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    img.paste(Image.new("RGB", (W, H), (60, 46, 20)), (0, 0), glow)
    return img


class Painter:
    def __init__(self, teams: list[str]):
        self.f_kicker, self.f_title, self.f_sub = font(23, "Demi"), font(58, "Bold"), font(25, "Medium")
        self.f_date, self.f_meta = font(40, "Bold"), font(24, "Medium")
        self.f_team, self.f_zone, self.f_head = font(23, "Demi"), font(17, "Demi"), mono(16, "Medium")
        self.f_cell, self.f_cell_b, self.f_pts = mono(16, "Semibold"), mono(16, "Heavy"), mono(19, "Semibold")
        self.f_foot = font(20, "Medium")
        self.x0, self.name_w, self.pts_w, self.top, self.rh = 52, 190, 64, 410, 47
        gaps = 10 * len(GAP_AFTER)
        self.cw = (W - 2 * self.x0 - self.name_w - self.pts_w - gaps) / N
        self.xs = []
        x = self.x0 + self.name_w
        for k in range(1, N + 1):
            self.xs.append(x)
            x += self.cw + (10 if k in GAP_AFTER else 0)
        self.logos = logos(teams, 32)
        self.bg = background()
        d = ImageDraw.Draw(self.bg)
        self._static(d)

    def _static(self, d: ImageDraw.ImageDraw) -> None:
        d.text((self.x0, 56), "LIIGA 2026–27  ·  KAUDEN ENNUSTE", font=self.f_kicker, fill=GOLD)
        d.text((self.x0, 88), "Mihin kukin joukkue päätyy?", font=self.f_title, fill=INK)
        d.text((self.x0, 162), "Todennäköisyys jokaiselle sijalle, 10 000 simuloitua kautta",
               font=self.f_sub, fill=MUTED)
        for a, b, name, col in ZONES:
            x0, x1 = self.xs[a - 1], self.xs[b - 1] + self.cw
            y = self.top - 70
            if name:
                d.text(((x0 + x1) / 2, y), name, font=self.f_zone, fill=col, anchor="ms")
            d.rounded_rectangle((x0 + 2, y + 8, x1 - 2, y + 11), radius=2, fill=col)
            for k in range(a, b + 1):
                d.text((self.xs[k - 1] + self.cw / 2, self.top - 22), str(k), font=self.f_head, fill=MUTED, anchor="ms")
        d.text((W - self.x0, self.top - 22), "pisteet", font=self.f_zone, fill=MUTED, anchor="rs")
        self._legend(d, self.top + N * self.rh + 34)
        d.text((self.x0, H - 58), "Liiga Ennuste  ·  päivittyy joka aamu  ·  data liiga.fi",
               font=self.f_foot, fill=FAINT)

    def _legend(self, d: ImageDraw.ImageDraw, y: int) -> None:
        """Väriasteikon selite yhdellä rivillä: 0 % [asteikko] 40 %+."""
        d.text((self.x0, y + 10), "todennäköisyys", font=self.f_foot, fill=MUTED, anchor="lm")
        x0 = self.x0 + 168
        d.text((x0, y + 10), "0 %", font=self.f_foot, fill=MUTED, anchor="lm")
        x, w = x0 + 46, 240
        for i in range(w):
            d.line((x + i, y + 3, x + i, y + 17), fill=ramp(i / (w - 1)))
        d.text((x + w + 10, y + 10), "40 % tai yli", font=self.f_foot, fill=MUTED, anchor="lm")

    def header(self, d: ImageDraw.ImageDraw, date: str, played: float) -> None:
        when = "Esikausi" if played < 0.5 else fi_date(date)
        d.text((self.x0, 222), when, font=self.f_date, fill=INK)
        txt = "ennen ensimmäistä ottelua" if played < 0.5 else f"{round(played)} / {TOTAL_GAMES} ottelua pelattu"
        d.text((W - self.x0, 240), txt, font=self.f_meta, fill=BODY, anchor="ra")
        y, x1 = 284, W - self.x0
        d.rounded_rectangle((self.x0, y, x1, y + 8), radius=4, fill=(30, 25, 17))
        frac = min(1.0, played / TOTAL_GAMES)
        if frac > 0.01:
            d.rounded_rectangle((self.x0, y, self.x0 + (x1 - self.x0) * frac, y + 8), radius=4, fill=GOLD_HI)

    def _cells(self, d: ImageDraw.ImageDraw, y: float, ps: list[float], texts: list[float]) -> None:
        for k, (p, pt) in enumerate(zip(ps, texts)):
            x = self.xs[k]
            box = (x + 2, y + 3, x + self.cw - 2, y + self.rh - 3)
            if p < 0.004:
                d.rounded_rectangle(box, radius=7, fill=EMPTY)
                continue
            lv = level(p)
            d.rounded_rectangle(box, radius=7, fill=ramp(lv))
            if pt >= 0.03:
                fg = (24, 18, 8) if level(pt) > 0.62 else INK if pt >= 0.10 else BODY
                d.text((x + self.cw / 2, y + self.rh / 2), str(round(pt * 100)),
                       font=self.f_cell_b if pt >= 0.25 else self.f_cell, fill=fg, anchor="mm")

    def rows(self, img: Image.Image, d: ImageDraw.ImageDraw, ys: dict[str, float], ps: dict[str, list[float]],
             texts: dict[str, list[float]], pts: dict[str, float | None]) -> None:
        for t in sorted(ys, key=ys.get):
            y = self.top + ys[t] * self.rh
            if t in self.logos:
                lg = self.logos[t]
                img.paste(lg, (self.x0 + int((32 - lg.width) / 2), int(y + (self.rh - lg.height) / 2)), lg)
            d.text((self.x0 + 44, y + self.rh / 2), t, font=self.f_team, fill=INK, anchor="lm")
            self._cells(d, y, ps[t], texts[t])
            if pts.get(t) is not None:
                d.text((W - self.x0, y + self.rh / 2), str(round(pts[t])), font=self.f_pts, fill=GOLD_HI, anchor="rm")

    def frame(self, a: dict, b: dict, t: float) -> Image.Image:
        e = t * t * (3 - 2 * t)          # pehmeä alku ja loppu
        img = self.bg.copy()
        d = ImageDraw.Draw(img)
        played = a["played"] + (b["played"] - a["played"]) * e
        near = b if t >= 0.5 else a      # luvut vaihtuvat puolivälissä, värit ja rivit liukuvat
        self.header(d, near["date"], played)
        # Rivit aina kokonaisilla paikoilla: järjestys liukuvan sijan mukaan, joten joukkueet
        # vaihtavat paikkaa vähitellen siirtymän aikana eivätkä koskaan peitä toisiaan.
        key = {tm: (a["rank"][tm] + (b["rank"][tm] - a["rank"][tm]) * e, b["rank"][tm]) for tm in b["rank"]}
        ys = {tm: float(i) for i, tm in enumerate(sorted(key, key=key.get))}
        ps = {tm: [x + (y - x) * e for x, y in zip(a["p"][tm], b["p"][tm])] for tm in b["p"]}
        self.rows(img, d, ys, ps, near["p"], near["pts"])
        return img


def palette(frames: list[Image.Image]) -> Image.Image:
    """Kiinteä paletti: käyttöliittymän värit ja kulta-asteikko varataan (mediaanileikkaus
    hävittää pienen alan värit, kuten punaisen vyöhykkeen), loput tekstin reunoille ja logoille."""
    fixed = [BG, EMPTY, INK, BODY, MUTED, FAINT, GOLD, GOLD_HI, SILVER, RED, (30, 25, 17), (24, 18, 8)]
    fixed += [ramp(i / 47) for i in range(48)]
    rest = COLORS - len(fixed)
    sample = Image.new("RGB", (W, H * 2))
    sample.paste(frames[0], (0, 0))
    sample.paste(frames[-1], (0, H))
    extra = sample.quantize(colors=rest, method=Image.Quantize.MEDIANCUT).getpalette()[:rest * 3]
    flat = [c for rgb in fixed for c in rgb] + extra
    pal = Image.new("P", (1, 1))
    pal.putpalette(flat + [0] * (768 - len(flat)))
    return pal


def build(out: Path) -> None:
    snaps = load()
    painter = Painter(sorted(snaps[-1]["p"]))
    frames, durations = [painter.frame(snaps[0], snaps[0], 0.0)], [FIRST_MS]
    for a, b in zip(snaps, snaps[1:]):
        for i in range(1, TWEEN + 1):
            frames.append(painter.frame(a, b, i / TWEEN))
            durations.append(TWEEN_MS)
        durations[-1] = HOLD_MS
    durations[-1] = LAST_MS
    pal = palette(frames)
    q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
    out.parent.mkdir(parents=True, exist_ok=True)
    q[0].save(out, save_all=True, append_images=q[1:], duration=durations, loop=0, optimize=True, disposal=1)
    frames[-1].save(out.with_suffix(".png"))
    print(f"{out}: {len(snaps)} tilannekuvaa, {len(frames)} ruutua, {sum(durations) / 1000:.0f} s, "
          f"{out.stat().st_size / 1e6:.1f} Mt")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=Path.home() / "Downloads" / "liiga-heatmap.gif")
    build(ap.parse_args().out.expanduser())
