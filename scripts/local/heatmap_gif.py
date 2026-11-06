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
import datetime as dt
from pathlib import Path

import duckdb
import heatmap_intro as hi
import heatmap_people as hp
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
TWEEN, TWEEN_MS, HOLD_MS = 3, 150, 800  # siirtymäruudut, niiden kesto ja päivän pysähdys (hidas)
FIRST_MS, LAST_MS = 2000, 7000
# Tapahtuma hitaasti (käyttäjä 7.11.: "hidasta kun näytetään ihmisiä"): rivi esiin, lähtijä yksin,
# sitten nuoli ja tulija; yhden henkilön paneeli kerralla.
FOCUS_MS, OUT_MS, EVENT_MS, SINGLE_MS = 1500, 3000, 7000, 8000
SIGN_MS = 5000
# Kauden tapahtumat animaatioon (7.11.2026, käyttäjä: "nosta Jori Lehterä, valmentajavaihdot").
# Valmentajavaihdot mallin taulusta coaching_changes (tarkistettu: fi.wikipedia, kausi 2026–27);
# Lehterä: HIFK ilmoitti 19.9.2026, että hänen uransa HIFK:ssa päättyy ja hän pitää tauon (Yle).
# Kaikki tapahtumat samalla tyylillä. Henkilökuvat: scripts/local/heatmap_people.py (Commons).
PLAYER_EVENTS = [("2026-09-19", "HIFK", "Jori Lehterä", "jää tauolle urastaan")]
# Hankinnat 1.9. jälkeen (käyttäjä 7.11.): Liiga-joukkueeseen tulleet, huhuareena.com/siirrot
# (haettu 7.11.2026). Ei roster_changes.csv:tä: suurin osa sen lisäyksistä on täsmäytystä
# (pelaaja oli joukkueessa alusta asti), ei hankintoja. (päivä, pelaaja, joukkue, mistä, laina)
SIGNINGS = [
    ("2026-09-14", "Petteri Lindbohm", "TPS", "HIFK", False),
    ("2026-09-15", "David Nemecek", "HIFK", "HC Sparta Praha", False),
    ("2026-09-18", "Tomi Karhunen", "Jokerit", "SaiPa", False),
    ("2026-09-25", "Brett Harrison", "Sport", "Lehigh Valley Phantoms", False),
    ("2026-09-28", "Oula Palve", "Sport", "Djurgårdens IF", False),
    ("2026-09-29", "Olli Palola", "HPK", "Ilves", True),
    ("2026-09-29", "Benjamin Rautiainen", "Tappara", "Tampa Bay Lightning", True),
    ("2026-10-01", "Pekka Jormakka", "Jukurit", "HKM Zvolen", False),
    ("2026-10-01", "Samuli Piipponen", "HPK", "Sport", False),
    ("2026-10-11", "Atte Ohtamaa", "JYP", "Kärpät", False),
    ("2026-10-12", "Christoffer Sedoff", "Jukurit", "Milwaukee Admirals", False),
    ("2026-10-13", "Ethan Prow", "Ässät", "Grizzlys Wolfsburg", False),
    ("2026-10-13", "Sampo Ranta", "HIFK", "Örebro HK", False),
    ("2026-10-13", "Olof Glifford", "HIFK", "HV71", True),
    ("2026-10-18", "Jonne Tammela", "KalPa", "Tappara", False),
    ("2026-10-21", "Kyle Crnkovic", "KalPa", "Wichita Thunder", False),
    ("2026-10-22", "Antti Tyrväinen", "Pelicans", "", False),
    ("2026-10-24", "Mattias Tedenby", "HPK", "HV71", False),
    ("2026-10-27", "Alexander Ruuttu", "KooKoo", "Jukurit", False),
    ("2026-10-29", "Tommi Kivistö", "Tappara", "Mountfield HK", False),
    ("2026-10-29", "Devante Stephens", "KooKoo", "EC Salzburg", False),
    ("2026-11-02", "Andrew Lucas", "Jokerit", "HC Banská Bystrica", False),
    ("2026-11-06", "Henri Kiviaho", "Tappara", "Graz 99ers", False),
]
COLORS = 100

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
    return _merge_small(pre[-1:] + [s for s in out if s["played"] > 0])


MIN_MOVE = 0.05                        # päivä, jona mikään solu ei liiku 5 %-yks., yhdistetään seuraavaan


def _merge_small(snaps: list[dict]) -> list[dict]:
    """GIFin koko (LinkedIn 5 Mt): pienen liikkeen päivä ei tuo kerrontaan mitään, mutta vie välikuvia.
    siirtymäruutua. Viimeinen tilannekuva säilyy aina."""
    out = [snaps[0]]
    for i, s in enumerate(snaps[1:], start=1):
        move = max(abs(x - y) for t in s["p"] for x, y in zip(out[-1]["p"][t], s["p"][t]))
        if move >= MIN_MOVE or i == len(snaps) - 1:
            out.append(s)
    return out


def events() -> list[dict]:
    con = duckdb.connect(str(ROOT / "data/liiga.duckdb"), read_only=True)
    rows = con.execute("SELECT change_date, team, coach_out, coach_in FROM coaching_changes "
                       "WHERE season = 2027 ORDER BY change_date").fetchall()
    con.close()
    ev = [{"date": d, "team": t, "kind": "VALMENTAJAVAIHDOS", "people": [(o, "lähti"), (i, "tilalle")]}
          for d, t, o, i in rows]
    ev += [{"date": d, "team": t, "kind": "PELAAJA", "people": [(n, x)]} for d, t, n, x in PLAYER_EVENTS]
    return sorted(ev + signing_weeks(), key=lambda e: e["date"])


def signing_weeks() -> list[dict]:
    """Hankinnat viikoittain yhdeksi kortiksi (ma–su); kortti näytetään viikon viimeisen hankinnan
    jälkeisessä tilannekuvassa."""
    weeks: dict[str, list[tuple]] = {}
    for sg in SIGNINGS:
        day = dt.date.fromisoformat(sg[0])
        weeks.setdefault((day - dt.timedelta(days=day.weekday())).isoformat(), []).append(sg)
    out = []
    for mon, rows in sorted(weeks.items()):
        sun = (dt.date.fromisoformat(mon) + dt.timedelta(days=6)).isoformat()
        out.append({"date": max(r[0] for r in rows), "kind": "HANKINNAT", "from": mon, "until": sun,
                    "team": rows[0][2], "teams": sorted({r[2] for r in rows}), "signings": rows})
    return out


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
        self.big = logos(teams, 46)
        self.marked: set[str] = set()     # joukkueet, joilla tapahtuma on jo ollut (pieni merkki)
        self.signed: dict[str, int] = {}  # hankintojen määrä tähän mennessä ("+N" nimen perään)
        self.f_sign = font(16, "Bold")
        self.small = logos(teams, 30)
        self.f_ev_k, self.f_ev_t, self.f_ev_n = font(20, "Demi"), font(40, "Bold"), font(27, "Demi")
        self.f_ev_r, self.f_ev_c, self.f_init = font(20, "Medium"), font(14, "Medium"), font(64, "Bold")
        self.huge = logos(teams, 64)
        self.faces: dict[str, Image.Image] = {}
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
            cx, cy = self.x0 + 44 + d.textlength(t, font=self.f_team) + 11, y + self.rh / 2
            if t in self.marked:              # tapahtuma ollut: pieni kultainen vinoneliö nimen perään
                d.polygon([(cx, cy - 5), (cx + 5, cy), (cx, cy + 5), (cx - 5, cy)], fill=GOLD)
                cx += 13
            if self.signed.get(t):            # hankinnat tähän mennessä
                d.text((cx - 4, cy), f"+{self.signed[t]}", font=self.f_sign, fill=GOLD_HI, anchor="lm")
            self._cells(d, y, ps[t], texts[t])
            if pts.get(t) is not None:
                d.text((W - self.x0, y + self.rh / 2), str(round(pts[t])), font=self.f_pts, fill=GOLD_HI, anchor="rm")

    def face(self, name: str, size: int) -> Image.Image:
        if name not in self.faces:
            self.faces[name] = hp.portrait(name, size, GOLD_HI, (26, 21, 13), self.f_init)
        return self.faces[name]

    def focus(self, img: Image.Image, rows: list[float], dim: bool = True) -> Image.Image:
        """Muu taulukko himmenee, joukkueiden rivit jäävät kirkkaiksi ja saavat kehyksen.
        Hankinnoissa ilman himmennystä: kehys riittää, ja tiedosto pysyy pienenä."""
        boxes = [(self.x0 - 10, int(self.top + r * self.rh) - 2, W - self.x0 + 10, int(self.top + r * self.rh) + self.rh + 2)
                 for r in rows]
        keep = [img.crop(b) for b in boxes]
        if dim:   # vain taulukkoalue: otsikko ja päivä pysyvät kirkkaina (ja tiedosto pienenä)
            area = (0, self.top - 90, W, self.top + N * self.rh + 4)
            part = img.crop(area)
            img.paste(Image.blend(part, Image.new("RGB", part.size, BG), 0.66), area[:2])
        d = ImageDraw.Draw(img)
        for b, k in zip(boxes, keep):
            img.paste(k, b[:2])
            d.rounded_rectangle(b, radius=10, outline=GOLD_HI, width=3)
        return img

    def signings(self, img: Image.Image, ev: dict, rows: list[float]) -> None:
        """Viikon hankinnat: kortti sille puoliskolle, jolla on vähemmän korostettuja rivejä."""
        lines = ev["signings"]
        ph = 112 + 54 * len(lines)
        low = sum(r > 8 for r in rows) > len(rows) / 2
        y0 = self.top - 6 if low else self.top + N * self.rh - ph + 6
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((self.x0 - 10, y0, W - self.x0 + 10, y0 + ph), radius=18, fill=(22, 18, 11),
                            outline=GOLD, width=2)
        a, b = dt.date.fromisoformat(ev["from"]), dt.date.fromisoformat(ev["until"])
        d.text((self.x0 + 16, y0 + 24), f"HANKINNAT  ·  {a.day}.{a.month}.–{b.day}.{b.month}.{b.year}",
               font=self.f_ev_k, fill=GOLD)
        d.text((self.x0 + 16, y0 + 50), f"{len(lines)} {'uusi pelaaja' if len(lines) == 1 else 'uutta pelaajaa'}",
               font=self.f_ev_n, fill=INK)
        for i, (day, name, team, src, loan) in enumerate(lines):
            y = y0 + 100 + i * 54
            if team in self.small:
                lg = self.small[team]
                img.paste(lg, (self.x0 + 16, y), lg)
            d.text((self.x0 + 60, y + 15), name, font=self.f_ev_n, fill=INK, anchor="lm")
            x = self.x0 + 60 + d.textlength(name, font=self.f_ev_n) + 14
            tail = f"{team}" + (f"  ·  {src}" if src else "") + ("  ·  laina" if loan else "")
            d.text((x, y + 17), tail, font=self.f_ev_r, fill=GOLD, anchor="lm")
            dd = dt.date.fromisoformat(day)
            d.text((W - self.x0 - 4, y + 17), f"{dd.day}.{dd.month}.", font=self.f_ev_r, fill=MUTED, anchor="rm")

    def panel(self, img: Image.Image, ev: dict, row: float, stage: int = 2) -> None:
        """Iso tapahtumapaneeli taulukon toiselle puoliskolle kuin joukkueen rivi."""
        ph = 450
        y0 = self.top - 6 if row > 8 else self.top + N * self.rh - ph + 6
        d = ImageDraw.Draw(img)
        d.rounded_rectangle((self.x0 - 10, y0, W - self.x0 + 10, y0 + ph), radius=18, fill=(22, 18, 11),
                            outline=GOLD, width=2)
        x = self.x0 + 16
        if ev["team"] in self.huge:
            lg = self.huge[ev["team"]]
            img.paste(lg, (x, y0 + 22), lg)
        d.text((x + 82, y0 + 26), f"{ev['kind']}  ·  {fi_date(ev['date'])}", font=self.f_ev_k, fill=GOLD)
        d.text((x + 82, y0 + 50), ev["team"], font=self.f_ev_t, fill=INK)
        people, size = ev["people"], 230
        if len(people) == 2:
            xs = [W / 2 - size - 70, W / 2 + 70]
            ay = y0 + 120 + size / 2
            if stage == 2:                      # nuoli vasta tulijan kanssa
                d.line((W / 2 - 40, ay, W / 2 + 26, ay), fill=GOLD_HI, width=5)
                d.polygon([(W / 2 + 22, ay - 14), (W / 2 + 44, ay), (W / 2 + 22, ay + 14)], fill=GOLD_HI)
        else:
            xs = [W / 2 - size / 2]
        for (name, role), px in list(zip(people, xs))[:1 if stage == 1 else None]:
            face = self.face(name, size)
            img.paste(face, (int(px), y0 + 118), face)
            cx = px + size / 2
            d.text((cx, y0 + 370), name, font=self.f_ev_n, fill=INK, anchor="ma")
            d.text((cx, y0 + 404), role, font=self.f_ev_r, fill=GOLD, anchor="ma")
            cr = hp.credit(name)
            if cr:
                d.text((cx, y0 + 430), cr, font=self.f_ev_c, fill=FAINT, anchor="ma")

    def frame(self, a: dict, b: dict, t: float, ev: dict | None = None, stage: int = 0) -> Image.Image:
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
        if ev:
            rows = [ys[t] for t in ev.get("teams", [ev["team"]])]
            img = self.focus(img, rows, dim=ev["kind"] != "HANKINNAT")
            if stage and ev["kind"] == "HANKINNAT":
                self.signings(img, ev, rows)
            elif stage:
                self.panel(img, ev, ys[ev["team"]], stage)
        return img


def palette(frames: list[Image.Image]) -> Image.Image:
    """Kiinteä paletti: käyttöliittymän värit ja kulta-asteikko varataan (mediaanileikkaus
    hävittää pienen alan värit, kuten punaisen vyöhykkeen), loput tekstin reunoille ja logoille."""
    fixed = [BG, EMPTY, INK, BODY, MUTED, FAINT, GOLD, GOLD_HI, SILVER, RED, (30, 25, 17), (24, 18, 8)]
    fixed += [ramp(i / 47) for i in range(48)]
    rest = COLORS - len(fixed)
    picks = frames[:: max(1, len(frames) // 6)][:6]
    sample = Image.new("RGB", (W, H * len(picks)))
    for i, f in enumerate(picks):
        sample.paste(f, (0, H * i))
    extra = sample.quantize(colors=rest, method=Image.Quantize.MEDIANCUT).getpalette()[:rest * 3]
    flat = [c for rgb in fixed for c in rgb] + extra
    pal = Image.new("P", (1, 1))
    pal.putpalette(flat + [0] * (768 - len(flat)))
    return pal


TRANSPARENT = 255                     # paletin vapaa indeksi (COLORS < 255)


def _delta(q: list[Image.Image]) -> list[Image.Image]:
    """Muuttumattomat pikselit läpinäkyviksi niissä ruuduissa, joissa muuttuu alle puolet
    (tapahtumat): GIF piirtää ruudun edellisen päälle (disposal 1), ja läpinäkyvät jonot
    pakkautuvat lähes ilmaiseksi. Siirtymissä muuttuu lähes kaikki, joten ne pysyvät ennallaan."""
    import numpy as np
    out, prev = [q[0]], np.array(q[0])
    for im in q[1:]:
        cur = np.array(im)
        same = cur == prev
        if same.mean() > 0.5:
            diff = cur.copy()
            diff[same] = TRANSPARENT
            frame = Image.fromarray(diff, "P")
            frame.putpalette(im.getpalette())
            out.append(frame)
        else:
            out.append(im)
        prev = cur
    return out


MONTHS = {9: "SYYSKUU", 10: "LOKAKUU", 11: "MARRASKUU", 12: "JOULUKUU", 1: "TAMMIKUU", 2: "HELMIKUU",
          3: "MAALISKUU"}


def _event_frames(painter: Painter, b: dict, ev: dict) -> list[tuple]:
    """Tapahtuma, joka osui välille: hankinnat kortilla, henkilöt hitaasti paneelissa."""
    if ev["kind"] == "HANKINNAT":
        seq = [(painter.frame(b, b, 1.0, ev, stage=2), SIGN_MS)]   # kortti ja rivit kerralla (koko)
        for sg in ev["signings"]:
            painter.signed[sg[2]] = painter.signed.get(sg[2], 0) + 1
        return seq
    seq = [(painter.frame(b, b, 1.0, ev), FOCUS_MS)]
    if len(ev["people"]) == 2:
        seq += [(painter.frame(b, b, 1.0, ev, stage=1), OUT_MS), (painter.frame(b, b, 1.0, ev, stage=2), EVENT_MS)]
    else:
        seq.append((painter.frame(b, b, 1.0, ev, stage=2), SINGLE_MS))
    painter.marked.add(ev["team"])
    return seq


def _season(painter: Painter, stage: hi.Stage, snaps: list[dict], evs: list[dict]) -> list[tuple]:
    seq, part = [], 1
    for a, b in zip(snaps, snaps[1:]):
        # Kolme välikuvaa, kun rivit vaihtavat paikkaa vähintään kaksi sijaa; muuten kaksi (koko).
        jump = max(abs(a["rank"][t] - b["rank"][t]) for t in b["rank"])
        k = TWEEN if jump >= 2 else 2
        seq += [(painter.frame(a, b, i / k), TWEEN_MS * TWEEN // k) for i in range(1, k + 1)]
        seq[-1] = (seq[-1][0], HOLD_MS)
        if b["date"][5:7] != a["date"][5:7]:            # väliotsikko kuukauden vaihtuessa
            part += 1
            seq.append(stage.month_card(seq[-1][0], part, MONTHS[int(b["date"][5:7])]))
            seq.append((seq[-2][0], 300))
        for ev in (e for e in evs if a["date"] < e["date"] <= b["date"]):
            seq += _event_frames(painter, b, ev)
    return seq


def build(out: Path) -> None:
    snaps, evs = load(), events()
    teams = sorted(snaps[-1]["p"])
    painter = Painter(teams)
    stage = hi.Stage(W, H, logos(teams, 96))
    first = painter.frame(snaps[0], snaps[0], 0.0)
    seq = [*hi.intro(stage, teams, first), (first, FIRST_MS), *_season(painter, stage, snaps, evs)]
    still = painter.frame(snaps[-1], snaps[-1], 1.0)    # loppu ilman tapahtumakorttia
    seq.append((still, LAST_MS))
    seq += stage.ending(TOTAL_GAMES - snaps[-1]["played"])
    frames, durations = [f for f, _ in seq], [ms for _, ms in seq]
    pal = palette(frames)
    q = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
    out.parent.mkdir(parents=True, exist_ok=True)
    q = _delta(q)
    q[0].save(out, save_all=True, append_images=q[1:], duration=durations, loop=0, optimize=False,
              disposal=1, transparency=TRANSPARENT)
    still.save(out.with_suffix(".png"))
    print(f"{out}: {len(snaps)} tilannekuvaa, {len(frames)} ruutua, {sum(durations) / 1000:.0f} s, "
          f"{out.stat().st_size / 1e6:.1f} Mt")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=Path.home() / "Downloads" / "liiga-heatmap.gif")
    build(ap.parse_args().out.expanduser())
