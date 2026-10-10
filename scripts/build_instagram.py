"""Build an Instagram/LinkedIn carousel of the 2026-27 Liiga prediction.

SEPARATE from the main infographic. Reads the same DuckDB tables as
scripts/build_site.py but writes to site_instagram/ and never touches site/.

Nine 1080x1350 (4:5) PNGs, all black-dominant with a yellow bloom in the
top-right corner that varies slide to slide.

    slide_1  places 1-6       slide_6  top five forwards
    slide_2  places 7-12      slide_7  top five defencemen
    slide_3  places 13-17     slide_8  top five goalies
    slide_4  method           slide_9  all-newcomer starting six
    slide_5  award predictions

Audience is data practitioners, so the method slide and caption are written
with concrete parameters rather than analogies.

Also bundles the slides into two self-contained PDFs, each ending with the
method slide:

    liiga-2026-27-standings.pdf   places 1-6, 7-12, 13-17, how it is built
    liiga-2026-27-players.pdf     award picks, top fives, newcomers, how it is built

    python scripts/refresh_standings.py     # make sure standings are current
    python scripts/build_instagram.py
"""
from __future__ import annotations

import base64
import io
import math
import re
import subprocess
import sys
import tempfile
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from PIL import Image                                    # noqa: E402
import numpy as np                                       # noqa: E402

from liiga.config import load_config                     # noqa: E402
from liiga.db import get_connection, query_df           # noqa: E402

OUT = ROOT / "site_instagram"
LOGOS = ROOT / "site" / "assets" / "logos"
W, H = 1080, 1350                                        # Instagram 4:5 portrait
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# model facts — keep in sync with scripts/build_site.py / AGENTS.md §10
POISSON_PCT, ELO_PCT, CROWD_PCT = 40, 60, 20
BACKTEST_MAE = 12.65
MAE_FI = "12,65"        # suomalainen desimaalipilkku dioihin
N_SIMS = "10 000"

# --- Liiga-tyylinen paletti -------------------------------------------------
# Mallina Liigan oma Instagram-ilme: tumma ruskea/seepia halli taustana,
# kultainen liukuväri otsikoissa, kermanvalkoiset laatikot numeroille ja
# vinot, leveät versaaliotsikot.
GOLD      = "#d9b654"
GOLD_HI   = "#f7e7ad"
GOLD_LO   = "#a9822c"
CREAM     = "#f2ece0"
INK       = "#150f09"      # tumma ruskea, ei musta
MUTED     = "#a89880"

# Taustat: lämmin halli-vignette, jonka valokeila siirtyy dialta toiselle niin
# että karusellissa on liikettä ilman että ilme vaihtuu.
def _bg(x: int, y: int) -> str:
    return (f"radial-gradient(120% 85% at {x}% {y}%, #5a4028 0%, #3a2818 32%, "
            f"#241a10 58%, #150f09 100%)")


GRADIENTS = [_bg(x, y) for x, y in
             [(78, 8), (22, 12), (85, 30), (15, 25), (60, 5),
              (35, 35), (90, 15), (10, 8), (70, 40)]]

# Otsikot, sijanumerot, joukkueiden nimet ja pistemäärät pysyvät Arial
# Blackina: dian ilme on sen massassa, eikä julkaistun karusellin ulkoasu saa
# muuttua tunnistettavasti. Leipäteksti on Hanken Grotesk, sama kuin
# Streamlit-sovelluksessa.
HEAD_F = '"Arial Black","Helvetica Neue",Arial,sans-serif'
BODY_F = "'Hanken Grotesk','Helvetica Neue',Arial,Helvetica,sans-serif"

FONTS = ROOT / "site" / "assets" / "fonts"


@lru_cache(maxsize=1)
def body_font_face() -> str:
    """Hanken Grotesk as a data URI, or nothing if the file is missing.

    Vendored rather than pulled from Google Fonts at build time: Chrome
    renders these offline, and a font fetched over the network would fail
    silently into Helvetica on a bad connection -- producing slides that
    differ from the ones before them for no visible reason.

    Only regular 400 is here because the slide CSS sets no font-weight on
    anything using BODY_F; every bold element switches to HEAD_F. Adding the
    unused cuts would triple the size of every slide for nothing.
    """
    f = FONTS / "hanken-grotesk-400-latin.woff2"
    if not f.exists():
        print(f"  ! {f.name} puuttuu -- leipäteksti jää Helvetica Neueen")
        return ""
    b64 = base64.b64encode(f.read_bytes()).decode()
    return ("@font-face{font-family:'Hanken Grotesk';font-style:normal;"
            "font-weight:400;font-display:block;"
            f"src:url(data:font/woff2;base64,{b64}) format('woff2');}}\n")


def _norm(s: str) -> str:
    import unicodedata
    s = unicodedata.normalize("NFKD", str(s))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", re.sub(r"[^a-z ]", " ", s.lower())).strip()


# Players whose Liiga career predates the database window (2022-2026), so
# player_season_scoring shows nothing and rate_source reads 'external'.
# Verified individually against EliteProspects; extend when a new signing has
# an older Liiga spell.
PRE_WINDOW_LIIGA = {
    "matt caito",          # 59 GP for KooKoo in 2019-20, 8+35=43 pts
}


def _nhl_bound() -> set:
    """Names the transfers article marks '(NHL)' in a club's contract list.

    They hold a Liiga contract on paper but are playing in North America, so
    they must not appear in any leaderboard -- Kim Saarinen otherwise ranks
    5th among goalies on save%.
    """
    txt = (ROOT / "data/transfers_2026_27.txt").read_text(encoding="utf-8")
    return {_norm(m) for m in re.findall(r"([A-ZÄÖÅ][\w\-\u00c0-\u017f]+(?:\s+[A-ZÄÖÅ][\w\-\u00c0-\u017f]+)+)\s*\(NHL\)", txt)}


def _ordinal(n: int) -> str:
    """Suomessa järjestysluku on pelkkä numero + piste."""
    return f"{n}."


def _slug(team: str) -> str:
    return (team.lower().replace("ä", "a").replace("ö", "o").replace("å", "a")
            .replace(" ", "-"))


def logo_uri(team: str) -> str:
    """Club crest in its ORIGINAL colours, upscaled for sharpness.

    Cached source art is 96px but is drawn at 156px, so it is resampled 3x
    with LANCZOS rather than left to the browser's scaler.
    """
    p = LOGOS / f"{_slug(team)}.png"
    if not p.exists():
        return ""
    im = Image.open(p).convert("RGBA")
    im = im.resize((im.width * 3, im.height * 3), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


PHOTOS = ROOT / "site" / "assets" / "players"


def photo_uri(name: str) -> str:
    """Square-cropped headshot as a data URI, or "" if we have no photo.

    Photos are mined from cached liiga.fi game files by scripts/build_site.py,
    so only players with Liiga appearances have one -- every newcomer falls
    back to the club crest by definition.
    """
    import unicodedata as _u
    s = _u.normalize("NFKD", name)
    s = "".join(c for c in s if not _u.combining(c))
    f = PHOTOS / (re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") + ".jpg")
    if not f.exists():
        return ""
    im = Image.open(f).convert("RGB")
    # Source art is a square 600x600 torso shot, so min(size) crops nothing --
    # it has to be zoomed onto the head. 46% of the width starting 2% down
    # frames the full head plus a little shoulder without clipping hair.
    side = int(im.width * 0.46)
    left = (im.width - side) // 2
    top = min(int(im.height * 0.02), max(0, im.height - side))
    im = im.crop((left, top, left + side, top + side)).resize((320, 320), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=88)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def face_or_crest(name: str, team: str) -> str:
    """Circular avatar: player photo where we have one, else the club crest."""
    ph = photo_uri(name)
    if ph:
        return f'<div class="ava"><img class="face" src="{ph}" alt=""></div>'
    return f'<div class="ava"><img class="crest" src="{logo_uri(team)}" alt=""></div>'


def theme(gradient: str) -> dict:
    """Yksi lämmin light-on-dark paletti kaikille dioille."""
    return {"grad": gradient, "fg": "#FFFFFF", "accent": GOLD, "muted": MUTED,
            "rule": GOLD, "panel": "rgba(255,255,255,0.06)", "bar": GOLD}


def css(t: dict) -> str:
    return body_font_face() + f"""
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ width:{W}px; height:{H}px; overflow:hidden; background:{INK};
         font-family:{BODY_F}; color:{t['fg']}; -webkit-font-smoothing:antialiased; }}
  .slide {{ width:{W}px; height:{H}px; display:flex; flex-direction:column;
           background:{INK}; background-image:{t['grad']}; }}
  .head {{ padding:60px 64px 28px; }}
  .kicker {{ font-family:{HEAD_F}; font-size:19px; letter-spacing:5px;
            text-transform:uppercase; color:{CREAM}; opacity:0.75;
            margin-bottom:16px; font-style:italic; }}
  /* Liiga-ilme: vino leveä versaali + kultainen liukuväri tekstin sisällä */
  .title {{ font-family:{HEAD_F}; font-size:76px; line-height:0.94;
           text-transform:uppercase; letter-spacing:-1.5px; font-style:italic;
           transform:skewX(-6deg); transform-origin:left bottom;
           background:linear-gradient(180deg,{GOLD_HI} 0%,{GOLD} 52%,{GOLD_LO} 100%);
           -webkit-background-clip:text; background-clip:text; color:transparent;
           filter:drop-shadow(0 3px 0 rgba(0,0,0,0.35)); }}
  .rule {{ height:4px; margin:26px 64px 0;
          background:linear-gradient(90deg,{GOLD} 0%,{GOLD_LO} 70%,transparent 100%); }}
  .body {{ flex:1; padding:26px 64px 0; display:flex; flex-direction:column; }}
  /* method slide only: pin the two callouts to the bottom of the body */
  .boxes {{ margin-top:auto; padding-bottom:10px; }}
  .foot {{ padding:20px 64px 42px; font-size:19px; color:{t['muted']}; }}

  /* ---- standings ---- */
  .body.standings {{ display:flex; flex-direction:column; padding-bottom:8px; }}
  .body.standings .row {{ flex:1; padding:0; }}
  .row {{ display:flex; align-items:center; gap:26px;
         border-bottom:1px solid {t['panel']}; }}
  .row:last-child {{ border-bottom:none; }}
  .rank {{ width:104px; font-family:{HEAD_F}; font-size:52px; line-height:1;
          font-style:italic; color:{INK}; background:{CREAM};
          padding:14px 0; text-align:center; transform:skewX(-6deg);
          box-shadow:4px 4px 0 rgba(0,0,0,0.35); }}
  /* Crest treatment: oversized, desaturated, and clipped down the vertical
     centre so only the left half shows. brightness() is needed because several
     crests are dark-inked and grayscale alone leaves them invisible on black. */
  .chip {{ width:78px; height:156px; overflow:hidden; flex-shrink:0;
          display:flex; align-items:center; }}
  /* Crests are drawn as flat silhouettes in the SAME white as the team name:
     the PNG's alpha channel is used as a mask and filled with one colour, so
     every club renders at identical tone regardless of its original artwork.
     A luminance filter can never do this -- each crest has different base
     brightness, so some always came out lighter than others. */
  .chip img {{ width:156px; height:156px; max-width:none; object-fit:contain; }}
  .name {{ flex:1; font-family:{HEAD_F}; font-size:42px; text-transform:uppercase;
          letter-spacing:-0.5px; font-style:italic; }}
  /* Liike edelliseen ennusteeseen: iso nuoli ja sen alla edellinen sija.
     Nuoli itse kantaa suunnan, joten väri saa olla pelkkä korostus -- kukaan
     ei jää ilman tietoa jos se ei erotu. */
  .move {{ width:96px; flex-shrink:0; text-align:center; }}
  .mv-a {{ font-size:34px; line-height:1; }}
  .mv-r {{ display:block; font-size:18px; color:{t['muted']}; margin-top:6px;
          font-variant-numeric:tabular-nums; }}
  .pts {{ text-align:right; }}
  .ptsn {{ font-family:{HEAD_F}; font-size:54px; line-height:1; font-style:italic;
          font-variant-numeric:tabular-nums; color:{CREAM}; }}
  .ptsl {{ font-size:19px; color:{t['muted']}; margin-top:8px; }}
  .ptsr {{ font-size:21px; color:{t['accent']}; margin-top:5px; opacity:0.85; }}

  /* ---- technical slides ---- */
  .step {{ display:flex; gap:20px; margin-bottom:15px; align-items:flex-start; }}
  .num {{ min-width:47px; height:47px; background:{CREAM}; color:{INK};
         font-family:{HEAD_F}; font-size:23px; display:flex;
         align-items:center; justify-content:center; }}
  /* DIRECT child only -- inline <b> inside the description must stay inline,
     otherwise every highlighted parameter becomes its own block heading */
  .txt > b {{ font-family:{HEAD_F}; font-size:26px; display:block; color:{t['fg']};
             margin-bottom:6px; text-transform:uppercase; letter-spacing:-0.3px; }}
  .txt span {{ font-size:20px; line-height:1.38; color:{t['fg']}; opacity:0.88; }}
  .txt span b, .callout span b {{ color:{t['accent']}; opacity:1; }}
  .callout {{ background:{t['panel']}; border-left:8px solid {t['bar']};
             padding:16px 26px; margin-top:2px; }}
  .callout > b {{ font-family:{HEAD_F}; font-size:25px; display:block;
                 margin-bottom:10px; color:{t['accent']}; text-transform:uppercase; }}
  .callout span {{ font-size:20px; line-height:1.38; color:{t['fg']}; opacity:0.9; }}
  /* Circular avatar used on the player slides: a headshot fills it, a crest
     is letterboxed inside it. Faces are NOT half-clipped like the standings
     crests -- half a face reads as a mistake. */
  .ava {{ width:112px; height:112px; border-radius:50%; overflow:hidden;
         flex-shrink:0; background:rgba(255,255,255,0.06);
         display:flex; align-items:center; justify-content:center; }}
  .ava .face {{ width:112px; height:112px; object-fit:cover; }}
  .ava .crest {{ width:78px; height:78px; object-fit:contain; }}

  /* ---- newcomers slide ---- */
  .body.newcomers {{ display:flex; flex-direction:column; padding-bottom:8px; }}
  .body.newcomers .row {{ flex:1; padding:0; }}
  .pos {{ width:46px; height:46px; background:{CREAM}; color:{INK};
         font-family:{HEAD_F}; font-size:22px; display:flex; align-items:center;
         justify-content:center; flex-shrink:0; }}
  .nc-txt {{ flex:1; }}
  .nc-name {{ font-family:{HEAD_F}; font-size:42px; text-transform:uppercase;
             letter-spacing:-0.5px; line-height:1; font-style:italic; }}
  .nc-from {{ font-size:21px; color:{t['muted']}; margin-top:10px; }}
  .nc-num {{ font-family:{HEAD_F}; font-size:42px; color:{t['accent']};
            text-align:right; line-height:1; }}
  .nc-unit {{ font-size:17px; color:{t['muted']}; text-align:right; margin-top:7px; }}

  /* ---- award slide ---- */
  .award {{ display:flex; flex-direction:column; justify-content:space-evenly;
           height:100%; padding-bottom:8px; }}
  .aw {{ display:flex; align-items:center; gap:26px; }}
  .aw .ava {{ width:132px; height:132px; }}
  .aw .ava .face {{ width:132px; height:132px; }}
  .aw .ava .crest {{ width:92px; height:92px; }}
  .aw-txt {{ flex:1; }}
  .aw-cat {{ font-family:{HEAD_F}; font-size:20px; letter-spacing:3px;
            text-transform:uppercase; color:{t['accent']}; margin-bottom:9px; }}
  .aw-name {{ font-family:{HEAD_F}; font-size:45px; text-transform:uppercase;
             letter-spacing:-1px; line-height:1; font-style:italic; }}
  .aw-sub {{ font-size:22px; color:{t['muted']}; margin-top:11px; }}
  .aw-num {{ font-family:{HEAD_F}; font-size:52px; color:{t['accent']};
            text-align:right; line-height:1; }}
  .aw-unit {{ font-size:19px; color:{t['muted']}; text-align:right;
             margin-top:9px; }}
  .big {{ font-size:29px; line-height:1.4; color:{t['fg']}; }}
  .next {{ font-size:18px; line-height:1.38; margin-top:12px; color:{t['fg']};
          opacity:0.8; }}
  .next b {{ color:{t['accent']}; opacity:1; }}

  /* ---- 17 joukkuetta yhdellä dialla: varjosarjataulukko ja 40 min ---- */
  .title.long {{ font-size:62px; }}
  .body.tbl17 {{ display:flex; flex-direction:column; padding-bottom:6px; }}
  .g17 {{ display:grid; align-items:center; column-gap:14px; }}
  .g17.xg {{ grid-template-columns:58px 40px minmax(0,1fr) 40px 104px 96px 96px 108px; }}
  .g17.ft {{ grid-template-columns:40px minmax(0,1fr) 178px 196px 70px; }}
  .g17.sp {{ grid-template-columns:40px minmax(0,1fr) 40px 112px 112px 112px; }}
  .g17.hd {{ font-family:{HEAD_F}; font-size:14px; letter-spacing:2px;
            text-transform:uppercase; color:{t['muted']}; padding-bottom:9px;
            border-bottom:2px solid {GOLD_LO}; }}
  .g17.hd > div {{ text-align:right; }}
  .g17.hd > div.l {{ text-align:left; }}
  .g17.r {{ flex:1; border-bottom:1px solid {t['panel']}; }}
  .g17.r:last-child {{ border-bottom:none; }}
  .r17 {{ font-family:{HEAD_F}; font-size:25px; font-style:italic; color:{INK};
         background:{CREAM}; text-align:center; padding:3px 0;
         transform:skewX(-6deg); }}
  .c17 {{ width:40px; height:50px; overflow:hidden; display:flex;
         align-items:center; }}
  .c17 img {{ width:80px; height:80px; max-width:none; object-fit:contain; }}
  .n17 {{ font-family:{HEAD_F}; font-size:26px; text-transform:uppercase;
         font-style:italic; letter-spacing:-0.5px; white-space:nowrap;
         overflow:hidden; text-overflow:ellipsis; }}
  .m17 {{ font-size:22px; color:{t['muted']}; text-align:right;
         font-variant-numeric:tabular-nums; }}
  .b17 {{ font-family:{HEAD_F}; font-size:29px; font-style:italic; color:{CREAM};
         text-align:right; font-variant-numeric:tabular-nums; }}
  .d17 {{ font-family:{HEAD_F}; font-size:24px; text-align:right;
         font-variant-numeric:tabular-nums; }}

  /* ---- kuusi pelaajaa yhdellä dialla (maalivahdit) ---- */
  .award.six .aw .ava {{ width:104px; height:104px; }}
  .lineup {{ display:flex; flex-direction:column; justify-content:space-evenly;
            height:100%; gap:14px; }}
  .ln-row {{ display:flex; justify-content:center; gap:22px; }}
  .ln {{ width:300px; background:{t['panel']}; border-top:6px solid {t['bar']};
        padding:12px 14px 12px; display:flex; flex-direction:column;
        align-items:center; text-align:center; }}
  .ln .ava {{ width:72px; height:72px; }}
  .ln .ava .face {{ width:72px; height:72px; }}
  .ln .ava .crest {{ width:50px; height:50px; }}
  .ln .aw-cat {{ font-size:14px; margin:8px 0 3px; }}
  .ln-name {{ font-family:{HEAD_F}; font-size:30px; text-transform:uppercase;
             letter-spacing:-1px; line-height:1.05; font-style:italic;
             white-space:nowrap; }}
  .ln-sub {{ font-size:17px; color:{t['muted']}; margin-top:4px; line-height:1.25; }}
  .ln-num {{ font-family:{HEAD_F}; font-size:34px; margin-top:6px; line-height:1; }}
  .ln-unit {{ font-size:16px; color:{t['muted']}; }}
  .award.six .aw .ava .face {{ width:104px; height:104px; }}
  .award.six .aw .ava .crest {{ width:72px; height:72px; }}
  .award.six .aw-name {{ font-size:40px; }}
  .award.six .aw-sub {{ font-size:20px; margin-top:8px; }}
  .award.six .aw-num {{ font-size:48px; }}

  /* ---- yksi iso luku ---- */
  .hero {{ display:flex; flex-direction:column; justify-content:center; flex:1;
          gap:30px; padding-bottom:10px; }}
  .hero-n {{ font-family:{HEAD_F}; font-size:230px; line-height:0.9;
            font-style:italic; letter-spacing:-6px; transform:skewX(-6deg);
            transform-origin:left bottom;
            background:linear-gradient(180deg,{GOLD_HI} 0%,{GOLD} 52%,{GOLD_LO} 100%);
            -webkit-background-clip:text; background-clip:text; color:transparent;
            filter:drop-shadow(0 4px 0 rgba(0,0,0,0.35));
            margin-bottom:34px; }}
  .hero-t {{ font-size:34px; line-height:1.3; color:{t['fg']}; max-width:900px; }}
  .hero-s {{ font-size:24px; color:{t['muted']}; margin-top:8px; }}
  .versus {{ display:flex; gap:22px; }}
  .versus .callout {{ flex:1; }}
  .vnum {{ font-family:{HEAD_F}; font-size:56px; font-style:italic; color:{CREAM};
          line-height:1; margin:2px 0 10px; }}

  /* ---- yli / ali varojen ---- */
  .duo {{ display:flex; flex-direction:column; gap:30px; flex:1;
         justify-content:center; padding-bottom:8px; }}
  .duo-h {{ font-family:{HEAD_F}; font-size:21px; letter-spacing:3px;
           text-transform:uppercase; color:{t['accent']}; margin-bottom:8px; }}
  .duo-r {{ display:flex; align-items:center; gap:20px; padding:8px 0;
           border-bottom:1px solid {t['panel']}; }}
  .duo-r:last-child {{ border-bottom:none; }}
  .duo-r .c17 {{ width:52px; height:66px; }}
  .duo-r .c17 img {{ width:104px; height:104px; }}
  .duo-t {{ flex:1; }}
  .duo-nm {{ font-family:{HEAD_F}; font-size:38px; text-transform:uppercase;
            font-style:italic; letter-spacing:-0.5px; line-height:1; }}
  .duo-sub {{ font-size:20px; color:{t['muted']}; margin-top:8px; }}
  .duo-n {{ font-family:{HEAD_F}; font-size:44px; font-style:italic;
           text-align:right; font-variant-numeric:tabular-nums; }}
"""


def page(t: dict, inner: str) -> str:
    return (f"<!doctype html><html><head><meta charset='utf-8'>"
            f"<style>{css(t)}</style></head><body>{inner}</body></html>")


def standings_slide(rows, lo: int, hi: int, t: dict, bands: dict,
                    ctx: dict | None = None) -> str:
    """One band of the table, with where each team came from.

    Two ranks on the row: the big box is now, `alkup.` under the arrow is the
    pre-season prediction, and the arrow is the difference between them. The
    foot names both and dates the comparison.
    """
    ctx = ctx or {}
    FIRST_DATE = ctx.get("__first_date__", "kesäkuu 2026")
    body = "".join(f"""
      <div class="row">
        <div class="rank">{int(r.proj_rank)}</div>
        <div class="chip"><img src="{logo_uri(r.team)}" alt=""></div>
        <div class="name">{r.team}</div>
        <div class="move">
          <span class="mv-a" style="color:{ctx.get(r.team, _NO_CTX)[1]}"
            >{ctx.get(r.team, _NO_CTX)[0]}</span>
          <span class="mv-r">{ctx.get(r.team, _NO_CTX)[2]}</span>
        </div>
        <div class="pts">
          <div class="ptsn">{r.mean_points:.0f}</div>
          <div class="ptsl">{int(r.p05_points)}–{int(r.p95_points)} p</div>
          <div class="ptsr">todennäk. {bands[r.team]}</div>
        </div>
      </div>""" for r in rows)
    return page(t, f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · Kausiennuste</div>
      <div class="title">Sijat {lo}–{hi}</div>
    </div>
    <div class="rule"></div>
    <div class="body standings">{body}</div>
    <div class="foot">{N_SIMS} simuloitua kautta · ”todennäk.” = keskimmäiset 50 %
      lopputuloksista · nuoli ja ”alkup.” = sija ennusteessa ennen kauden
      alkua ({FIRST_DATE})</div>
  </div>""")


def how_slide(t: dict) -> str:
    steps = [
        ("Kaikki lähtee pelaajista, ei viime kauden taulukosta",
         "Jokaisesta pelaajasta on kerätty viiden kauden datasetti — vain "
         "sellaisia tilastoja, jotka löytyvät EliteProspectsista."),
        ("Myös ne, jotka eivät pelanneet viime kautta Liigassa",
         "Turunen ja Bryggman tulevat SHL:stä, Tim Juel on kokonaan uusi "
         "mies. Jokaisen tulokkaan tilastot on etsitty erikseen — muuten "
         "heidät laskettaisiin nolliksi."),
        ("Maali SHL:ssä on kovempi kuin maali Liigassa",
         "Siksi jokaisella sarjalla on oma painonsa: <b>SHL 1,20, AHL 1,15, "
         "Allsvenskan 0,75, Mestis 0,35</b>. Kertoimet on laskettu "
         "pelaajista, jotka oikeasti tekivät sen siirron."),
        ("Ikä painaa pelaajan arvoa alas",
         "Jos ikä alkaa painaa, se painaa. Tuotto putoaa <b>0,67</b>:ään "
         "35–37-vuotiaana ja <b>0,40</b>:een 38+."),
        ("Joukkueen maalipotentiaali on se mittari",
         "SaiPa menetti suoralta kädeltä yli <b>90 maalia</b> — Fortier, "
         "Nikkanen, Kalapudas, Kivenmäki, Kuusla — eikä se voi olla "
         "näkymättä. Maalivahdin torjunta-% muuttuu samalla logiikalla "
         "päästettyjen maalien kertoimeksi."),
        ("Poisson ja Elo, sitten 10 000 kautta",
         "Pelaajista saatu maalilukema (Poisson) ja viiden vuoden tuloksista "
         "koottu Elo blendataan <b>40/60</b> per joukkue. Sitten koko "
         "sarjaohjelma simuloidaan <b>10 000</b> kertaa."),
    ]
    items = "".join(
        f'<div class="step"><div class="num">{i}</div>'
        f'<div class="txt"><b>{a}</b><span>{b}</span></div></div>'
        for i, (a, b) in enumerate(steps, 1))
    return page(t, f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · Menetelmä</div>
      <div class="title">Näin se on tehty</div>
    </div>
    <div class="rule"></div>
    <div class="body">
      {items}
      <div class="boxes">
        <div class="callout">
        <b>Ottelumalli</b>
        <span>Maalit arvotaan <b>Poisson</b>-mallista, λ = sarjan ka. ×
        hyökkäys × vastustajan puolustus × kotietu. <b>Dixon-Coles</b>-korjaus
        nostaa vähämaalisia tasatuloksia niin että jatkoajat osuvat Liigan
        oikeaan <b>23 %</b>:iin. Elo huomioi maalieron (k=16).</span>
      </div>
      <div class="callout" style="margin-top:14px">
        <b>Toimiiko se?</b>
        <span>Testattu kausilla 2023–26 niin, että jokainen kausi
        ennustettiin vain sitä edeltävällä datalla: pistevirhe keskimäärin
        <b>{MAE_FI}</b>, ottelutason log-loss <b>0,672</b> vs. <b>0,686</b>
        pelkällä arvauksella, taulukon <b>Spearman ρ 0,48</b>.</span>
        </div>
      </div>
    </div>
    <div class="foot">Poisson · Dixon-Coles · MOV-Elo · Monte Carlo · Snowflake ML</div>
  </div>""")


GAMES_PER_TEAM = 64          # overwritten from the schedule in build()


def award_slide(t: dict, picks: list) -> str:
    """Three individual-award shouts, taken from the same projections that
    drive the table -- not from reputation."""
    rows = "".join(f"""
      <div class="aw">
        {face_or_crest(full, team)}
        <div class="aw-txt">
          <div class="aw-cat">{cat}</div>
          <div class="aw-name">{name}</div>
          <div class="aw-sub">{team}</div>
        </div>
        <div>
          <div class="aw-num">{num}</div>
          <div class="aw-unit">{unit}</div>
        </div>
      </div>""" for cat, full, name, team, num, unit in picks)
    return page(t, f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · Ennusteet</div>
      <div class="title">Kuka voittaa<br>mitäkin</div>
    </div>
    <div class="rule"></div>
    <div class="body">
      <div class="award">{rows}</div>
    </div>
    <div class="foot">Ennuste koko {GAMES_PER_TEAM} ottelun kaudelle · sama malli kuin taulukossa</div>
  </div>""")


CAPTION = """Rakensin mallin, joka ennustaa koko Liigan kauden 2026–27. Pyyhkäise sijat 1–17 ja menetelmä. 🏒

Malli ei katso viime kauden taulukkoa lainkaan. Se lähtee pelaajista: viiden kauden maalitahti jokaiselta pelaajalta jokaisessa rosterissa, tuorein kausi painottuen eniten, kutistettuna kohti pelipaikan keskiarvoa 20 ottelun priorilla. Ulkomailta tulevien tuotto muunnetaan Liiga-tasolle NHLe-pohjaisilla kertoimilla (SHL 1,20, AHL 1,15, Allsvenskan 0,75, Mestis 0,35), jotka on laskettu pelaajista jotka oikeasti tekivät sen siirron.

Ikäkäyrä on kaksiosainen: 1,5 %/v huipusta 26 alkaen ja lisäksi 4 %/v 33 ikävuoden jälkeen. Tuo jyrkänne mitattiin omista tiedoista pelaajien vuosimuutoksista (0,67 ikävuosina 35–37, 0,40 38+), ei oletettu.

Maalivahti tulee mukaan puolustuskertoimena (1−torj%)/(1−sarjan torj%), regressoituna 25 ottelun verran kohti priorii. Ottelut ovat Poisson-malli Dixon-Coles-korjauksella, joka kalibroitiin Liigan todelliseen 23 %:n jatkoaikaosuuteen, yhdistettynä 40/60 maalieron huomioivaan Eloon (k=16). Lopuksi koko kausi simuloidaan 10 000 kertaa.

Vuotamaton testi kausilla 2023–26: pistevirhe keskimäärin 12,65, ottelutason log-loss 0,672 vs. 0,686 arvauksella.

Seuraavaksi putki siirtyy ajastetuiksi Snowflake ML -ajoiksi, jotka päivittävät Elon oikeilla tuloksilla joka yö ja simuloivat uudelleen vain pelaamattomat ottelut. Julkaisen myös sen, missä malli meni pieleen.

#jääkiekko #liiga #datascience #koneoppiminen #snowflake #analytiikka #montecarlo"""


def _award_picks() -> list:
    """Individual projections: the model's own per-game rate over the real
    schedule length.

    Deliberately does NOT apply team_strength's normalisation factor. That
    factor (~1.31) exists to make TEAM offence ratings land on the league
    average while summing only the top 18 skaters -- it silently attributes a
    whole roster's output to 18 players. Applied to an individual it inflates
    them past their own career year, which is not a projection.

    So these numbers sit below last season's actual leaders, on purpose: each
    rate is recency-weighted across five seasons and shrunk toward the
    positional mean, which is what an expectation should do. The player who
    actually leads the league is the one who outperforms his expectation.
    """
    global GAMES_PER_TEAM
    con = get_connection()
    try:
        gp = query_df(con, """SELECT COUNT(*) n FROM (
                                SELECT home_team t FROM stg_games WHERE season=2027
                                UNION ALL
                                SELECT away_team FROM stg_games WHERE season=2027)
                              GROUP BY t LIMIT 1""")
        pr = query_df(con, """SELECT name, team,
                                     projected_goals_per_game g,
                                     projected_points_per_game p
                              FROM player_rates
                              WHERE position_group IN ('F','D')""")
        gteams = query_df(con, """SELECT first_name||' '||last_name nm, team
                                  FROM roster_2026_27 WHERE position_group='G'""")
    finally:
        con.close()
    GAMES_PER_TEAM = int(gp["n"].iloc[0]) if not gp.empty else 64

    pr["P"] = pr["p"] * GAMES_PER_TEAM
    pr["G"] = pr["g"] * GAMES_PER_TEAM
    pts = pr.nlargest(1, "P").iloc[0]
    # the points leader also tops goals; take the goals runner-up so three
    # different players get named
    goals = pr[pr["name"] != pts["name"]].nlargest(1, "G").iloc[0]

    # Save% needs a goalie who will actually qualify. Require real Liiga
    # workload -- the raw rate leader (Tim Juel) has never played a Liiga game
    # and shares a three-goalie depth chart.
    from liiga.goalies import compute_goalie_ratings, parse_goalie_seasons
    liiga_gp = (parse_goalie_seasons().query("league == 'Liiga'")
                .groupby("name")["games"].sum())
    g = compute_goalie_ratings()
    g["liiga_gp"] = g["name"].map(liiga_gp).fillna(0)
    g = g[g["liiga_gp"] >= 60].nlargest(1, "proj_save_pct").iloc[0]
    tm = gteams.loc[gteams["nm"] == g["name"], "team"]

    return [
        ("Eniten pisteitä", pts["name"], pts["name"].split()[-1], pts["team"],
         f"{pts['P']:.0f}", "ennustettua pistettä"),
        ("Eniten maaleja", goals["name"], goals["name"].split()[-1], goals["team"],
         f"{goals['G']:.0f}", "ennustettua maalia"),
        ("Paras torjunta-%", g["name"], g["name"].split()[-1],
         tm.iloc[0] if not tm.empty else "", f"{g['proj_save_pct']*100:.1f}".replace('.', ','),
         "ennustettu torjunta-%"),
    ]


def top5_slide(t: dict, title: str, rows_in: list, foot: str) -> str:
    """Ranked five-player leaderboard: rank, crest, name, club, projected stat."""
    rows = "".join(f"""
      <div class="row">
        <div class="rank">{i}</div>
        {face_or_crest(full, team)}
        <div class="nc-txt">
          <div class="nc-name">{name}</div>
          <div class="nc-from">{team}</div>
        </div>
      </div>""" for i, (full, name, team, _num, _unit) in enumerate(rows_in, 1))
    return page(t, f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · Ennusteet</div>
      <div class="title">{title}</div>
    </div>
    <div class="rule"></div>
    <div class="body newcomers">{rows}</div>
    <div class="foot">{foot}</div>
  </div>""")


def _top5_lists() -> tuple:
    """Top five forwards, defencemen and goalies by projection.

    Drops anyone the transfers article marks '(NHL)' -- they hold a Liiga
    contract but are playing in North America. Kim Saarinen otherwise ranks
    fifth among goalies on save% despite not being in the league.
    """
    nhl = _nhl_bound()
    con = get_connection()
    try:
        pr = query_df(con, """SELECT name, team, position_group,
                                     projected_points_per_game p
                              FROM player_rates
                              WHERE position_group IN ('F','D')""")
        gr = query_df(con, """SELECT first_name||' '||last_name nm, team
                              FROM roster_2026_27 WHERE position_group='G'""")
    finally:
        con.close()
    pr = pr[~pr["name"].map(_norm).isin(nhl)].copy()
    pr["P"] = pr["p"] * GAMES_PER_TEAM

    def rows(pos):
        return [(r["name"], r["name"].split()[-1], r["team"],
                 f"{r['P']:.0f}", "proj. points")
                for _, r in pr[pr.position_group == pos].nlargest(5, "P").iterrows()]

    from liiga.goalies import compute_goalie_ratings
    g = compute_goalie_ratings().merge(gr, left_on="name", right_on="nm")
    g = g[(~g["name"].map(_norm).isin(nhl)) & (g.tot_games >= 60)]
    grows = [(r["name"], r["name"].split()[-1], r["team"],
              f"{r['proj_save_pct']*100:.1f}", "proj. save %")
             for _, r in g.nlargest(5, "proj_save_pct").iterrows()]
    return rows("F"), rows("D"), grows


def newcomers_slide(t: dict, picks: list) -> str:
    """A full on-ice unit -- 1G/2D/3F, six players, not eleven -- assembled
    only from players with no Liiga games last season."""
    rows = "".join(f"""
      <div class="row">
        <div class="pos">{pos}</div>
        {face_or_crest(full, team)}
        <div class="nc-txt">
          <div class="nc-name">{name}</div>
          <div class="nc-from">{team} &nbsp;·&nbsp; {frm}</div>
        </div>
      </div>""" for pos, full, name, team, frm, _num, _unit in picks)
    return page(t, f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · Ensimmäinen Liiga-kausi</div>
      <div class="title">Tulokkaiden<br>kokoonpano</div>
    </div>
    <div class="rule"></div>
    <div class="body newcomers">{rows}</div>
    <div class="foot">Kukaan näistä kuudesta ei ole pelannut yhtään Liiga-ottelua</div>
  </div>""")


def _newcomer_picks() -> list:
    """Best 1G / 2D / 3F among players with no Liiga games in 2025-26.

    Six players: a hockey team ices a goalie, a defence pair and a forward
    line. (An earlier version called this a "best XI", which is football.)

    "New" means: on a 2026-27 roster, no scoring row for season 2026, and
    either no Liiga history at all (rate_source 'external') or an
    external_players.csv row for 2026 showing they played abroad. Note this
    leans on the scoring table, which only lists players who registered a
    point -- a genuinely scoreless Liiga season would slip through. None of
    the picks below are in that position; all six came from other leagues.
    """
    import pandas as pd
    con = get_connection()
    try:
        pr = query_df(con, """SELECT name, team, position_group,
                                     projected_points_per_game p, rate_source
                              FROM player_rates""")
        played = query_df(con, """SELECT p.name FROM player_rates p
                                  JOIN player_season_scoring s
                                    ON s.player_id = p.player_id AND s.season = 2026""")
        groster = query_df(con, """SELECT first_name||' '||last_name nm, team
                                   FROM roster_2026_27 WHERE position_group='G'""")
    finally:
        con.close()

    ext = pd.read_csv(ROOT / "data/external_players.csv", comment="#")
    abroad = {_norm(n) for n in ext[ext.season == 2026]["name"]}
    src = {_norm(n): l for n, l in zip(ext[ext.season == 2026]["name"],
                                       ext[ext.season == 2026]["league"])}
    pr["k"] = pr["name"].map(_norm)
    # STRICT: never played a Liiga game. rate_source 'external' means the
    # model found no Liiga scoring history at all. The looser "no games last
    # season" test would have admitted returnees like Teemu Turunen (Karpat
    # 2023-25), which is not what "newcomer" should mean here.
    new = pr[(pr["rate_source"] == "external")
             & (~pr["name"].isin(set(played["name"])))
             & (~pr["name"].map(_norm).isin(_nhl_bound() | PRE_WINDOW_LIIGA))]

    picks = []
    from liiga.goalies import parse_goalie_seasons, compute_goalie_ratings
    gs = parse_goalie_seasons()
    last = gs.sort_values("season").groupby("name").tail(1)
    g = compute_goalie_ratings().merge(
        last[["name", "season", "league"]], on="name")
    # goalies with no Liiga season on file at all
    ever_liiga = set(gs[gs.league == "Liiga"]["name"])
    g = g[(g.season == 2026) & (g.league != "Liiga")
          & (~g["name"].map(_norm).isin(PRE_WINDOW_LIIGA))
          & (~g["name"].isin(ever_liiga))].merge(
        groster, left_on="name", right_on="nm")
    if not g.empty:
        gr = g.nlargest(1, "proj_save_pct").iloc[0]
        picks.append(("MV", gr["name"], gr["name"].split()[-1], gr["team"],
                      gr["league"], f"{gr['proj_save_pct']*100:.1f}", "proj. save %"))
    for pos, fi, n in (("D", "P", 2), ("F", "H", 3)):
        for _, r in new[new.position_group == pos].nlargest(n, "p").iterrows():
            picks.append((fi, r["name"], r["name"].split()[-1], r["team"],
                          src.get(r["k"], "abroad"),
                          f"{r['p'] * GAMES_PER_TEAM:.0f}", "proj. points"))
    return picks


# Which rendered slides go into each PDF. The method slide (4) closes BOTH
# bundles, so either can be sent on its own and still explain itself.
PDF_BUNDLES = [
    ("liiga-2026-27-standings.pdf", "Predicted table", [1, 2, 3, 4]),
    ("liiga-2026-27-players.pdf", "Player predictions", [5, 6, 7, 8, 9, 4]),
]
PDF_DPI = 150          # 1080x1350 px -> 7.2 x 9 in, a sane page rather than 15 in


def write_pdfs() -> list:
    """Bundle the rendered PNGs into PDFs (Pillow, no extra dependency)."""
    made = []
    for fname, _label, order in PDF_BUNDLES:
        pages = []
        for n in order:
            f = OUT / f"slide_{n}.png"
            if f.exists():
                pages.append(Image.open(f).convert("RGB"))
        if not pages:
            continue
        dest = OUT / fname
        pages[0].save(dest, "PDF", save_all=True, append_images=pages[1:],
                      resolution=PDF_DPI)
        made.append((dest, len(pages)))
        print(f"  wrote {dest.name}  {len(pages)} pages "
              f"({dest.stat().st_size // 1024} KB)")
    return made


def rasterise(html: str) -> bytes:
    """One slide's HTML to a 1080x1350 PNG, via headless Chrome.

    Chrome is what gives the slides their look -- the layout is CSS, and a
    Python drawing library would be a second, diverging implementation of it.
    The cost is that this only runs where Chrome exists, which is the laptop
    and not Snowflake; callers have to handle that.
    """
    with tempfile.TemporaryDirectory() as tmp:
        src, png = Path(tmp) / "slide.html", Path(tmp) / "slide.png"
        src.write_text(html, encoding="utf-8")
        subprocess.run(
            [CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
             "--force-device-scale-factor=1", f"--window-size={W},{H}",
             f"--screenshot={png}", f"file://{src}"],
            check=True, capture_output=True)
        return png.read_bytes()


def iqr_bands(pos, teams) -> dict:
    """Interquartile finishing range per team, as '3.-7.'.

    The 5-95 band is honest but far too wide to be useful on a slide (KooKoo
    would read "1st-11th"); the IQR still carries 50-87% of the probability
    mass and is legible at a glance.
    """
    bands = {}
    if pos.empty:
        return bands
    cols = [f"rank_{i}" for i in range(1, 18)]
    pos = pos.set_index("team")
    for team in teams:
        cum, lo_r, hi_r = 0.0, None, 17
        for i, c in enumerate(cols, 1):
            cum += float(pos.loc[team, c])
            if lo_r is None and cum >= 0.25:
                lo_r = i
            if cum >= 0.75:
                hi_r = i
                break
        lo_r = lo_r or 1
        bands[team] = (f"{_ordinal(lo_r)}-{_ordinal(hi_r)}" if lo_r != hi_r
                       else _ordinal(lo_r))
    return bands


# Kun historiaa ei vielä ole, rivi ei saa jäädä tyhjäksi eikä valehdella.
_NO_CTX = ("\u2013", MUTED, "")


def rank_context(con) -> dict:
    """Per team: arrow, arrow colour, and the pre-season rank it compares to.

    The baseline is the **last prediction before the season started**, not
    the oldest row in the table. That is the prediction that was published,
    and it is what "originally" means for this project -- the June rows are
    an early draft that moved nine of seventeen teams before opening night.

    Found by `games_played = 0` rather than by a date, so it stays correct
    next season and says in the query what it means. The run on opening day
    still counts: the pipeline runs in the morning and the games are played
    in the evening.
    """
    h = query_df(con, """
        SELECT snapshot_date, team, proj_rank, games_played
        FROM prediction_history""")
    if h.empty or h["snapshot_date"].nunique() < 2:
        return {}
    h["snapshot_date"] = h["snapshot_date"].astype(str)
    dates = sorted(h["snapshot_date"].unique())
    pre = sorted(h.loc[h["games_played"] == 0, "snapshot_date"].unique())
    first, now = (pre[-1] if pre else dates[0]), dates[-1]

    def ranks(d):
        return h[h["snapshot_date"] == d].set_index("team")["proj_rank"]

    r_first, r_now = ranks(first), ranks(now)
    out = {}
    for team in r_now.index:
        if team not in r_first.index:
            continue
        # The arrow measures drift since opening night, not the overnight
        # one: a daily run moves teams around on tenths of a point, so a
        # day-over-day arrow says "KooKoo climbed" about a team sitting in
        # exactly the place it started the season in.
        #
        # proj_rank is smaller when better, so a fall in the number is a rise
        # on the slide; getting this backwards is the obvious way to be wrong.
        moved = int(r_first[team]) - int(r_now[team])
        arrow, colour = (("\u25b2", GOLD) if moved > 0 else
                         ("\u25bc", MUTED) if moved < 0 else ("\u2013", MUTED))
        # The number under the arrow is the one the arrow compares against.
        # Putting any other rank there is what makes a reader mistrust both.
        out[team] = (arrow, colour, f"alkup. {_ordinal(int(r_first[team]))}")
    # Alaviite tarvitsee päivämäärän: "ennen kauden alkua" on tyhjä ilmaisu
    # ilman sitä. Avain ei voi törmätä joukkueen nimeen.
    out["__first_date__"] = _fi_date(first)
    return out


def _fi_date(iso: str) -> str:
    y, m, d = iso[:10].split("-")
    return f"{int(d)}.{int(m)}.{y}"


def slides_to_pdf(slides) -> bytes:
    """The slides as one PDF, in order. LinkedIn carousels are PDFs.

    Pillow only, no extra dependency -- the same route write_pdfs() takes for
    the on-disk bundles.
    """
    pages = [Image.open(io.BytesIO(png)).convert("RGB") for _name, png in slides]
    if not pages:
        return b""
    buf = io.BytesIO()
    pages[0].save(buf, "PDF", save_all=True, append_images=pages[1:],
                  resolution=PDF_DPI)
    return buf.getvalue()


def season_stats(con) -> dict:
    """Current-season production per player, with their place in the race.

    Keyed on the normalised full name because that is all the pick lists
    carry -- they come from player_rates, which has no player_id.

    RANK(), not ROW_NUMBER(): five players tied on three points are all
    third, and picking one of them to be sixth would be an invention.
    """
    df = query_df(con, """
        SELECT first_name || ' ' || last_name AS nm, team, goals, assists,
               points,
               RANK() OVER (ORDER BY points DESC) AS rank_p,
               RANK() OVER (ORDER BY goals  DESC) AS rank_g
        FROM player_season_scoring
        WHERE season = (SELECT MAX(season) FROM player_season_scoring)""")
    out = {_norm(r.nm): {"points": int(r.points), "goals": int(r.goals),
                         "rank_p": int(r.rank_p), "rank_g": int(r.rank_g)}
           for r in df.itertuples()}
    # Goalies produce no points, so they are absent above and need their own
    # pass. There is no save percentage to be had: liiga.fi publishes no
    # shots, so `game_goalies` records goals against and nothing to divide it
    # by. Starts and goals against are what the season actually measured.
    gk = query_df(con, """
        SELECT first_name || ' ' || last_name AS nm,
               SUM(CASE WHEN started THEN 1 ELSE 0 END) AS starts,
               COALESCE(SUM(goals_against), 0) AS ga
        FROM game_goalies
        WHERE season = (SELECT MAX(season) FROM game_goalies)
        GROUP BY 1""")
    for r in gk.itertuples():
        out.setdefault(_norm(r.nm), {}).update(
            {"starts": int(r.starts or 0), "ga": int(r.ga or 0)})
    return out


def _points_line(stats: dict, full: str) -> str:
    """'6 p · 3. pistepörssissä', or an honest blank."""
    s = stats.get(_norm(full))
    if not s or "points" not in s:
        return "ei vielä pisteitä"
    return f"{s['points']} p · {_ordinal(s['rank_p'])} pistepörssissä"


def award_status_slide(t: dict, picks: list, stats: dict) -> str:
    """The same three award picks, scored against what has happened.

    Keeps the original slide's layout and its own projection on the row, so
    the comparison is legible without flipping back to the carousel.
    """
    rows = []
    for cat, full, name, team, num, unit in picks:
        s = stats.get(_norm(full), {})
        # The pick list's unit already reads "ennustettua pistettä"; prefixing
        # it with "ennuste" would say the word twice.
        short = unit.replace("ennustettua ", "").replace("ennustettu ", "")
        if "torjunta" in unit:
            # No shots in the API, so no save percentage. Saying "-" and
            # naming the reason beats printing a number that is not one.
            big, small = "&ndash;", f"{s.get('starts', 0)} aloitusta &middot; ei mitattavissa"
        elif "maalia" in unit:
            big = str(s.get("goals", 0))
            small = (f"maalia &middot; {_ordinal(s['rank_g'])} maalipörssissä"
                     if s.get("goals") else "maalia")
        else:
            big = str(s.get("points", 0))
            small = (f"pistettä &middot; {_ordinal(s['rank_p'])} pistepörssissä"
                     if s.get("points") else "pistettä")
        rows.append(f"""
      <div class="aw">
        {face_or_crest(full, team)}
        <div class="aw-txt">
          <div class="aw-cat">{cat}</div>
          <div class="aw-name">{name}</div>
          <div class="aw-sub">{team} &middot; ennuste {num} {short}</div>
        </div>
        <div>
          <div class="aw-num">{big}</div>
          <div class="aw-unit">{small}</div>
        </div>
      </div>""")
    return page(t, f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026-27 &middot; Ennuste vs. toteuma</div>
      <div class="title">Kuka voittaa<br>mitäkin</div>
    </div>
    <div class="rule"></div>
    <div class="body">
      <div class="award">{"".join(rows)}</div>
    </div>
    <div class="foot">Ennakkovalinnat ja niiden tuotto tähän mennessä &middot;
      torjunta-%:a ei voi laskea: liiga.fi ei julkaise laukauksia</div>
  </div>""")


def newcomers_status_slide(t: dict, picks: list, stats: dict) -> str:
    """The same six newcomers, with what they have produced so far."""
    rows = []
    for pos, full, name, team, frm, _num, _unit in picks:
        s = stats.get(_norm(full), {})
        if pos == "MV":
            line = (f"{s['starts']} aloitusta &middot; {s['ga']} päästettyä"
                    if s.get("starts") else "ei vielä aloituksia")
        else:
            line = _points_line(stats, full)
        rows.append(f"""
      <div class="row">
        <div class="pos">{pos}</div>
        {face_or_crest(full, team)}
        <div class="nc-txt">
          <div class="nc-name">{name}</div>
          <div class="nc-from">{team} &nbsp;&middot;&nbsp; {line}</div>
        </div>
      </div>""")
    return page(t, f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026-27 &middot; Ennuste vs. toteuma</div>
      <div class="title">Tulokkaiden<br>kokoonpano</div>
    </div>
    <div class="rule"></div>
    <div class="body newcomers">{"".join(rows)}</div>
    <div class="foot">Sama kuusikko kuin ennakkodiassa &middot; tuotto tähän mennessä</div>
  </div>""")


def live_slides(con=None) -> list:
    """The standings slides plus the movement slide, from the current tables.

    Returns [(filename, png bytes)]. This is the entry point the Streamlit
    app uses; `build()` still writes the full nine-slide carousel to disk.
    """
    own = con is None
    con = con or get_connection()
    try:
        st = query_df(con, """SELECT proj_rank, team, mean_points, p05_points,
                                     p95_points
                              FROM standings_2026_27 ORDER BY proj_rank""")
        pos = query_df(con, "SELECT * FROM position_distribution_2026_27")
        ctx = rank_context(con)
        stats = season_stats(con)
    finally:
        if own:
            con.close()
    if st.empty:
        return []

    bands = iqr_bands(pos, st["team"])
    themes = [theme(g) for g in GRADIENTS]
    out = []
    for i, (lo, hi) in enumerate([(1, 6), (7, 12), (13, 17)]):
        rows = list(st[(st.proj_rank >= lo) & (st.proj_rank <= hi)].itertuples())
        out.append((f"sijat_{lo}-{hi}.png",
                    standings_slide(rows, lo, hi, themes[i], bands, ctx)))
    # The pick lists come from player_rates, so they are the same names the
    # published carousel named; only the right-hand column is new.
    out.append(("palkinnot_toteuma.png",
                award_status_slide(themes[4], _award_picks(), stats)))
    out.append(("tulokkaat_toteuma.png",
                newcomers_status_slide(themes[8], _newcomer_picks(), stats)))
    return [(name, rasterise(html)) for name, html in out]


# ============================================================================
# Kaksi erillistä postausta: xG-varjosarjataulukko ja "peli ratkeaa 40 minuutissa"
# ============================================================================
# Kumpikin renderöi tämän hetken datasta eikä koske site_instagram/:iin --
# build() on ainoa joka kirjoittaa julkaistun karusellin.
#
# ⚠️ Kaikki otteluliitokset ovat (season, game_id). game_id toistuu joka
# kaudella 2022-26 (1 055 eri arvoa 2 852 ottelulle), ja pelkällä game_id:llä
# rivit monistuvat viisinkertaisiksi. Se virhe antoi 15.9. viimeistelyonnen
# pysyvyydeksi r = +0,39; oikea on +0,08.

XG_UP, XG_DOWN = GOLD_HI, "#e0574b"
_GEN = {3: "kolmen", 4: "neljän", 5: "viiden", 6: "kuuden", 7: "seitsemän"}
_NOM = {3: "Kolme", 4: "Neljä", 5: "Viisi", 6: "Kuusi", 7: "Seitsemän"}


def _fi(x: float, d: int = 1, sign: bool = False) -> str:
    """Suomalainen luku: desimaalipilkku ja oikea miinusmerkki."""
    s = f"{x:+.{d}f}" if sign else f"{x:.{d}f}"
    return s.replace("-", "−").replace(".", ",")


def _thou(n: int) -> str:
    return f"{int(n):,}".replace(",", " ")


def _xpts(xf: np.ndarray, xa: np.ndarray, k_max: int = 13) -> np.ndarray:
    """Odotetut sarjapisteet per ottelu maalipaikoista.

    Kumpikin joukkue tekee maaleja Poisson-jakauman mukaan omalla xG:llään.
    Voitto 3; tasapeli menee jatkoajalle, josta saa 2 tai 1 -- odotus 1,5.
    Ottelu jakaa siis aina tasan 3 pistettä kuten oikeakin taulukko, joten
    varjotaulukon ja sarjataulukon pistesummat ovat samat.
    """
    k = np.arange(k_max)
    fact = np.array([math.factorial(i) for i in k], dtype=float)
    pf = np.exp(-xf[:, None]) * xf[:, None] ** k / fact
    pa = np.exp(-xa[:, None]) * xa[:, None] ** k / fact
    win = (pf[:, 1:] * np.cumsum(pa, axis=1)[:, :-1]).sum(axis=1)
    tie = (pf * pa).sum(axis=1)
    return 3 * win + 1.5 * tie


def xg_shadow(con):
    """Kauden pisteet sellaisina kuin maalipaikat ne jakaisivat.

    "Sarjassa" on liiga.fi:n järjestys (pisteet, maaliero, tehdyt) -- sama
    sääntö kuin sovelluksessa, joten luku on sama kuin oikeassa taulukossa.
    """
    d = query_df(con, """
        SELECT team, xg_for, xg_against, points, goals_for, goals_against
        FROM team_game_log
        WHERE season = (SELECT MAX(season) FROM team_game_log)
          AND xg_for IS NOT NULL AND xg_against IS NOT NULL""")
    if d.empty:
        return d
    d["xp"] = _xpts(d["xg_for"].to_numpy(float), d["xg_against"].to_numpy(float))
    g = (d.groupby("team")
          .agg(o=("points", "size"), p=("points", "sum"), xp=("xp", "sum"),
               gf=("goals_for", "sum"), ga=("goals_against", "sum"))
          .reset_index())
    g["gd"] = g["gf"] - g["ga"]
    real = g.sort_values(["p", "gd", "gf"], ascending=False)["team"].tolist()
    g["real_rank"] = g["team"].map({t: i + 1 for i, t in enumerate(real)})
    g = g.sort_values(["xp", "gd"], ascending=False).reset_index(drop=True)
    g["xg_rank"] = range(1, len(g) + 1)
    g["diff"] = g["p"] - g["xp"]
    return g


_XG_HIST: dict = {}


def xg_history(con) -> dict:
    """Mitä edelliset kaudet sanovat, 10 ensimmäisen ottelun kohdalta.

      r_xg / r_real : ennustaako varjo- vai oikea taulukko loppukauden
                      pisteitä per ottelu paremmin
      r_fin         : jatkuuko viimeistelyonni (maalit - xG) loppukaudelle

    Historia ei muutu, joten tulos pidetään muistissa istunnon ajan.
    """
    if _XG_HIST:
        return _XG_HIST
    d = query_df(con, """
        SELECT l.season, l.team, l.points, l.goals_for, l.goals_against,
               l.xg_for, l.xg_against,
               ROW_NUMBER() OVER (PARTITION BY l.season, l.team
                                  ORDER BY g.start_ts) AS n
        FROM team_game_log l
        JOIN stg_games g ON g.season = l.season AND g.game_id = l.game_id
        WHERE l.season < (SELECT MAX(season) FROM team_game_log)
          AND l.xg_for IS NOT NULL AND l.xg_against IS NOT NULL""")
    if d.empty:
        return {}
    d["xp"] = _xpts(d["xg_for"].to_numpy(float), d["xg_against"].to_numpy(float))
    d["fin"] = d["goals_for"] - d["xg_for"]
    d["gk"] = d["xg_against"] - d["goals_against"]
    early = d[d["n"] <= 10].groupby(["season", "team"])[["points", "xp", "fin", "gk"]].mean()
    late = d[d["n"] > 10].groupby(["season", "team"])[["points", "fin", "gk"]].mean()
    m = early.join(late, rsuffix="_l").dropna()
    _XG_HIST.update({
        "r_real": float(m["points"].corr(m["points_l"])),
        "r_xg": float(m["xp"].corr(m["points_l"])),
        "r_fin": float(m["fin"].corr(m["fin_l"])),
        "r_gk": float(m["gk"].corr(m["gk_l"])),
        "seasons": int(d["season"].nunique()), "n": len(m)})
    return _XG_HIST


def xg_table_slide(t: dict, g) -> str:
    head = ('<div class="g17 xg hd"><div>Sija</div><div></div>'
            '<div class="l">Joukkue</div><div>O</div><div>Sarjassa</div>'
            '<div>Paikkojen mukaan</div><div>Oikeat pisteet</div>'
            '<div>Yli / ali</div></div>')
    rows = []
    for r in g.itertuples():
        col = XG_UP if r.diff > 0.05 else (XG_DOWN if r.diff < -0.05 else MUTED)
        rows.append(f"""
      <div class="g17 xg r">
        <div class="r17">{r.xg_rank}</div>
        <div class="c17"><img src="{logo_uri(r.team)}" alt=""></div>
        <div class="n17">{r.team}</div>
        <div class="m17">{r.o}</div>
        <div class="m17">{r.real_rank}.</div>
        <div class="b17">{_fi(r.xp)}</div>
        <div class="m17">{int(r.p)}</div>
        <div class="d17" style="color:{col}">{_fi(r.diff, sign=True)}</div>
      </div>""")
    return page(t, f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · Jos maalipaikat ratkaisisivat</div>
      <div class="title long">Varjosarjataulukko</div>
    </div>
    <div class="rule"></div>
    <div class="body tbl17">{head}{"".join(rows)}</div>
    <div class="foot">Paikkojen mukaan = pisteet, jotka joukkue olisi saanut
      maalipaikkojensa perusteella · yli / ali = kuinka paljon enemmän (+) tai
      vähemmän (−) pisteitä joukkue on saanut kuin paikat antaisivat odottaa</div>
  </div>""")


def xg_insight_slide(t: dict, g, hist: dict) -> str:
    def block(title: str, df) -> str:
        rows = "".join(f"""
        <div class="duo-r">
          <div class="c17"><img src="{logo_uri(r.team)}" alt=""></div>
          <div class="duo-t"><div class="duo-nm">{r.team}</div>
            <div class="duo-sub">sarjassa {r.real_rank}. · varjosarjataulukossa {r.xg_rank}.</div></div>
          <div class="duo-n" style="color:{XG_UP if r.diff > 0 else XG_DOWN}"
            >{_fi(r.diff, sign=True)} p</div>
        </div>""" for r in df.itertuples())
        return f'<div><div class="duo-h">{title}</div>{rows}</div>'

    over = g.sort_values("diff", ascending=False).head(3)
    under = g.sort_values("diff").head(3)
    call = ""
    if hist:
        n = _GEN.get(hist["seasons"], str(hist["seasons"]))
        if hist["r_xg"] > hist["r_real"]:
            claim = (f"{n.capitalize()} edellisen kauden aikana varjosarjataulukko ennusti "
                     "loppukauden pisteitä <b>paremmin kuin oikea sarjataulukko</b>")
        else:
            claim = (f"{n.capitalize()} edellisen kauden aikana oikea sarjataulukko ennusti "
                     "loppukautta paremmin kuin varjosarjataulukko")
        luck = ("ja viimeistelyn onni <b>tasoittui lähes kokonaan</b>."
                if hist["r_fin"] < 0.2 else "ja viimeistelyn etu jatkui osittain.")
        call = (f'<div class="callout"><b>Kumpaan uskoa?</b>'
                f'<span>{claim} {luck}</span></div>')
    return page(t, f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · Varjosarjataulukko</div>
      <div class="title">Yli vai ali<br>varojen?</div>
    </div>
    <div class="rule"></div>
    <div class="body">
      <div class="duo">
        {block("Enemmän pisteitä kuin paikkoja", over)}
        {block("Vähemmän pisteitä kuin paikkoja", under)}
      </div>
      {call}
    </div>
    <div class="foot">Luku = kuinka monta pistettä enemmän (+) tai vähemmän (−) joukkue
      on saanut kuin sen maalipaikat antaisivat odottaa</div>
  </div>""")


def forty_minutes(con) -> dict:
    """Kuka johti kahden erän jälkeen, ja voittiko se.

    Tilanne otetaan maalitapahtumien omasta tilanneluvusta
    (MAX(home_score_after) erissä 1-2) eikä laskemalla tapahtumia: VT0
    (hylätty videotarkistuksessa) ja RL0 (epäonnistunut rangaistuslaukaus)
    ovat tapahtumia joissa tilanne ei muutu. Laskettuna ne tekivät 8/57
    ottelusta väärän. Validoitu 2027:n eräaineistoa vasten 57/57 ja
    historiassa lopputulosta vasten 2087/2088.
    """
    g = query_df(con, """
        WITH e AS (SELECT season, game_id,
                          MAX(home_score_after) AS h40, MAX(away_score_after) AS a40
                   FROM raw_goal_events WHERE period <= 2
                   GROUP BY season, game_id)
        SELECT g.season, g.home_team, g.away_team, g.home_goals, g.away_goals,
               COALESCE(e.h40, 0) AS h40, COALESCE(e.a40, 0) AS a40
        FROM stg_games g
        LEFT JOIN e ON e.season = g.season AND e.game_id = g.game_id
        WHERE g.ended""")
    if g.empty:
        return {}
    cur_season = int(g["season"].max())
    g["lead"] = np.where(g.h40 > g.a40, g.home_team,
                         np.where(g.a40 > g.h40, g.away_team, None))
    g["win"] = np.where(g.home_goals > g.away_goals, g.home_team, g.away_team)
    led = g[g["lead"].notna()]
    cur, hist = led[led.season == cur_season], led[led.season < cur_season]

    def rate(x):
        return float((x["lead"] == x["win"]).mean()) if len(x) else float("nan")

    p_hist = rate(hist)
    n_cur, won_cur = len(cur), int((cur["lead"] == cur["win"]).sum())
    sd = math.sqrt(n_cur * p_hist * (1 - p_hist)) if n_cur else 0.0
    teams = {}
    for r in g[g.season == cur_season].itertuples():
        for team in (r.home_team, r.away_team):
            s = teams.setdefault(team, {"led": 0, "held": 0, "trail": 0,
                                        "turned": 0, "tied": 0})
            # Tasatilanne on pandas-sarakkeessa NaN, ei None -- `is None`
            # laski jokaisen tasapelin molemmille tappioasemaksi.
            if not isinstance(r.lead, str):
                s["tied"] += 1
            elif r.lead == team:
                s["led"] += 1
                s["held"] += int(r.win == team)
            else:
                s["trail"] += 1
                s["turned"] += int(r.win == team)
    # Jokaisella johdolla on vastapuolella tappioasema, ja jokainen käännös on
    # jonkun menetetty johto. Jos nämä eivät täsmää, joukkuedia valehtelee.
    led_sum = sum(v["led"] for v in teams.values())
    assert led_sum == sum(v["trail"] for v in teams.values()) == n_cur, \
        (led_sum, sum(v["trail"] for v in teams.values()), n_cur)
    assert sum(v["turned"] for v in teams.values()) == n_cur - won_cur
    return {"cur_rate": won_cur / n_cur if n_cur else float("nan"),
            "cur_n": n_cur, "cur_won": won_cur, "cur_turned": n_cur - won_cur,
            "hist_rate": p_hist, "hist_n": len(hist),
            "hist_seasons": int(hist["season"].nunique()),
            "z": (won_cur - n_cur * p_hist) / sd if sd else 0.0,
            "teams": teams}


def forty_hero_slide(t: dict, f: dict) -> str:
    every = round(1 / (1 - f["hist_rate"])) if f["hist_rate"] < 1 else 0
    seasons = _NOM.get(f["hist_seasons"], str(f["hist_seasons"]))
    verdict = ("Ero historiaan on vielä normaalin vaihtelun rajoissa — "
               f"{f['cur_n']} ottelua on pieni otos."
               if abs(f["z"]) < 2 else
               "Ero historiaan on selvä, ei pelkkää vaihtelua.")
    return page(t, f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · Kahden erän jälkeen</div>
      <div class="title">Peli ratkeaa<br>40 minuutissa</div>
    </div>
    <div class="rule"></div>
    <div class="body">
      <div class="hero">
        <div>
          <div class="hero-n">{f['cur_rate'] * 100:.0f} %</div>
          <div class="hero-t">Kun joukkue on johtanut toisen erän jälkeen,
            se on voittanut ottelun.</div>
          <div class="hero-s">{f['cur_won']} / {f['cur_n']} ottelua tällä kaudella</div>
        </div>
        <div class="versus">
          <div class="callout"><b>{seasons} edellistä kautta</b>
            <div class="vnum">{f['hist_rate'] * 100:.0f} %</div>
            <span>{_thou(f['hist_n'])} ottelua</span></div>
          <div class="callout"><b>Johto käännetty</b>
            <div class="vnum">{f['cur_turned']} kertaa</div>
            <span>tällä kaudella · historiassa joka {every}. kerta</span></div>
        </div>
      </div>
    </div>
    <div class="foot">{verdict} Voitto sisältää jatkoajan ja voittolaukaukset.</div>
  </div>""")


def forty_teams_slide(t: dict, f: dict) -> str:
    head = ('<div class="g17 ft hd"><div></div><div class="l">Joukkue</div>'
            '<div>Johti → voitti</div><div>Tappiolla → voitti</div>'
            '<div>Tasan</div></div>')
    order = sorted(f["teams"].items(),
                   key=lambda kv: (-kv[1]["led"], -kv[1]["held"], kv[1]["trail"], kv[0]))
    rows = []
    for team, s in order:
        led = f"{s['held']} / {s['led']}" if s["led"] else "–"
        trl = f"{s['turned']} / {s['trail']}" if s["trail"] else "–"
        tcol = XG_UP if s["turned"] else MUTED
        rows.append(f"""
      <div class="g17 ft r">
        <div class="c17"><img src="{logo_uri(team)}" alt=""></div>
        <div class="n17">{team}</div>
        <div class="b17">{led}</div>
        <div class="d17" style="color:{tcol}">{trl}</div>
        <div class="m17">{s['tied']}</div>
      </div>""")
    return page(t, f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · Peli ratkeaa 40 minuutissa</div>
      <div class="title">Joukkueittain</div>
    </div>
    <div class="rule"></div>
    <div class="body tbl17">{head}{"".join(rows)}</div>
    <div class="foot">Tilanne kahden erän jälkeen · "johti → voitti" = voitot / johtoasemat ·
      tasan = ei johtoa 40 minuutin kohdalla</div>
  </div>""")


def goalie_saves(con, min_games: int = 3):
    """Maalivahdit keskivertomaalivahtiin verrattuna, samoista paikoista.

    Mitä verrataan, ja miksi juuri niin:

    * Maalivahdin OMAT päästetyt (game_goalies nettoaa tyhjät maalit), ei
      joukkueen. liiga.fi:n xG ei sisällä tyhjää maalia kohti laukaistuja
      paikkoja: 2022-26 ottelutasolla (maalit - xG) nousee +1,61 ± 0,06 per
      tyhjä maali. Joukkueen päästetyillä maalivahti vastaisi maaleista
      joiden aikana hän istui penkillä -- Saarinen olisi −2 väärin.
    * Odotus = vastustajan xG × kauden keskivertomaalivahdin päästösuhde.
      Raaka xG yliarvioi tällä kaudella maalit ~8 % (ja historiassa samaan
      suuntaan), jolloin lähes jokainen maalivahti näyttäisi hyvältä ja
      keskitasoinen päätyisi "heikoimpiin".
    * Vain ottelut joissa pelasi yksi maalivahti: peliaikaa ei ole, joten
      jaettua ottelua ei voi jakaa (2/114 kun tämä tehtiin).
    """
    d = query_df(con, """
        WITH cur AS (SELECT MAX(season) AS s FROM game_goalies),
        solo AS (SELECT season, game_id, team FROM game_goalies
                 WHERE played AND season = (SELECT s FROM cur)
                 GROUP BY season, game_id, team HAVING COUNT(*) = 1)
        SELECT g.team, g.player_id, MAX(g.first_name) AS first_name,
               MAX(g.last_name) AS last_name, COUNT(*) AS o,
               SUM(g.goals_against) AS ga, SUM(l.xg_against) AS xga
        FROM game_goalies g
        JOIN solo s ON s.season = g.season AND s.game_id = g.game_id
                   AND s.team = g.team
        JOIN team_game_log l ON l.season = g.season AND l.game_id = g.game_id
                            AND l.team = g.team
        WHERE g.played
        GROUP BY g.team, g.player_id""")
    if d.empty:
        return d
    scale = float(d["ga"].sum() / d["xga"].sum())
    d["exp"] = d["xga"] * scale
    d["saved"] = d["exp"] - d["ga"]
    out = (d[d["o"] >= min_games].sort_values("saved", ascending=False)
             .reset_index(drop=True))
    out.attrs.update(scale=scale, min_games=min_games)
    return out


def goalie_slide(t: dict, rows, kicker: str, title: str, foot: str) -> str:
    items = []
    for r in rows.itertuples():
        full = f"{r.first_name} {r.last_name}"
        col = XG_UP if r.saved > 0 else XG_DOWN
        items.append(f"""
      <div class="aw">
        {face_or_crest(full, r.team)}
        <div class="aw-txt">
          <div class="aw-name">{r.last_name}</div>
          <div class="aw-sub">{r.team} · {r.o} ottelua · päästi {int(r.ga)},
            keskiverto olisi päästänyt {_fi(r.exp)}</div>
        </div>
        <div>
          <div class="aw-num" style="color:{col}">{_fi(r.saved, sign=True)}</div>
          <div class="aw-unit">maalia</div>
        </div>
      </div>""")
    return page(t, f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">{kicker}</div>
      <div class="title">{title}</div>
    </div>
    <div class="rule"></div>
    <div class="body">
      <div class="award six">{"".join(items)}</div>
    </div>
    <div class="foot">{foot}</div>
  </div>""")


def goalie_post(con=None, n: int = 6) -> list:
    """Maalivahtipostaus: kärki ja häntäpää. [(tiedostonimi, png)]."""
    own = con is None
    con = con or get_connection()
    try:
        g, hist = goalie_saves(con), xg_history(con)
    finally:
        if own:
            con.close()
    if g.empty:
        return []
    k = g.attrs["min_games"]
    # "Torjunut" eikä "päästänyt": plus tarkoittaa VÄHEMMÄN päästettyjä, ja
    # "päästänyt enemmän (+)" sanoi 26.9. ensimmäisessä versiossa päinvastoin
    # kuin luku. Torjunnoilla sana ja merkki osoittavat samaan suuntaan.
    what = ("Maalia = kuinka monta maalia maalivahti on torjunut enemmän (+) "
            "tai vähemmän (−) kuin keskivertomaalivahti samoista vastustajan "
            f"maalipaikoista · vähintään {k} ottelua")
    fade = ""
    if hist and "r_gk" in hist:
        seasons = _GEN.get(hist["seasons"], str(hist["seasons"]))
        fade = (f". {seasons.capitalize()} edellisen kauden aikana alkukauden "
                "maalivahtipelin etu " + ("tasoittui suurelta osin."
                                          if hist["r_gk"] < 0.3 else "jatkui osittain."))
    kicker = "Liiga 2026–27 · Maalivahdit"
    out = [("maalivahdit_karki.png",
            goalie_slide(theme(GRADIENTS[3]), g.head(n), kicker,
                         "Kovimmat<br>torjujat", what)),
           ("maalivahdit_vaikein_alku.png",
            goalie_slide(theme(GRADIENTS[7]), g.tail(n).iloc[::-1], kicker,
                         "Vaikein<br>alku", what + fade))]
    return [(name, rasterise(html)) for name, html in out]


def xg_post(con=None) -> list:
    """Varjosarjataulukko-postaus: [(tiedostonimi, png)]."""
    own = con is None
    con = con or get_connection()
    try:
        g, hist = xg_shadow(con), xg_history(con)
    finally:
        if own:
            con.close()
    if g.empty:
        return []
    out = [("varjosarjataulukko.png", xg_table_slide(theme(GRADIENTS[2]), g)),
           ("yli_ali_varojen.png", xg_insight_slide(theme(GRADIENTS[5]), g, hist))]
    return [(name, rasterise(html)) for name, html in out]


def forty_post(con=None) -> list:
    """"Peli ratkeaa 40 minuutissa" -postaus: [(tiedostonimi, png)]."""
    own = con is None
    con = con or get_connection()
    try:
        f = forty_minutes(con)
    finally:
        if own:
            con.close()
    if not f:
        return []
    out = [("40min.png", forty_hero_slide(theme(GRADIENTS[0]), f)),
           ("40min_joukkueittain.png", forty_teams_slide(theme(GRADIENTS[6]), f))]
    return [(name, rasterise(html)) for name, html in out]


PRESEASON_RATES = ROOT / "data" / "preseason_player_rates.csv"


def _preseason_snapshot(con) -> str | None:
    """Viimeisin ennuste ennen kauden alkua -- sama määritelmä kuin
    rank_context():ssä (games_played = 0), ei päivämäärä."""
    d = query_df(con, """SELECT MAX(snapshot_date) AS s FROM prediction_history
                         WHERE games_played = 0""")
    return None if d.empty or d["s"].isna().all() else str(d["s"].iloc[0])[:10]


def surprise_teams(con):
    """Pisteet tähän mennessä vs. mitä esikauden malli antoi JUURI NÄISTÄ
    otteluista.

    Odotus otetaan prediction_games-taulun esikauden snapshotista ottelu
    kerrallaan, joten se huomioi vastustajat ja koti/vieras -- KooKoo, joka
    on pelannut helpon alun, ei saa samaa odotusta kuin vaikean alun pelannut.
    Ottelu jakaa 3 pistettä myös odotuksessa, joten summat täsmäävät.

    z = ero / keskihajonta, kun keskihajonta lasketaan samoista
    todennäköisyyksistä (pisteet 3/2/1/0 per ottelu). |z| ≥ 2 on se raja,
    jonka yli ero ei enää ole tavallista vaihtelua.
    """
    snap = _preseason_snapshot(con)
    if snap is None:
        return None
    d = query_df(con, f"""
        WITH g AS (
          SELECT s.home_team, s.away_team, s.home_points, s.away_points,
                 p.p_home_reg AS h3, p.p_away_reg AS a3,
                 p.p_overtime * p.p_home_ot_win AS h2,
                 p.p_overtime * (1 - p.p_home_ot_win) AS a2
          FROM stg_games s
          JOIN prediction_games p ON p.game_id = s.game_id
                                 AND p.snapshot_date = '{snap}'
          WHERE s.season = (SELECT MAX(season) FROM stg_games) AND s.ended),
        x AS (
          SELECT home_team AS team, home_points AS pts,
                 3*h3 + 2*h2 + a2 AS xp, 9*h3 + 4*h2 + a2 AS x2 FROM g
          UNION ALL
          SELECT away_team, away_points, 3*a3 + 2*a2 + h2, 9*a3 + 4*a2 + h2 FROM g)
        SELECT team, COUNT(*) AS o, SUM(pts) AS p, SUM(xp) AS xp,
               SUM(x2 - xp*xp) AS var
        FROM x GROUP BY team""")
    if d.empty:
        return None
    # Joukkue joka ei ole vielä pelannut kuuluu taulukkoon nollilla.
    teams = query_df(con, "SELECT DISTINCT team FROM roster_2026_27")["team"]
    d = d.set_index("team").reindex(teams).fillna(0).reset_index()
    d["diff"] = d["p"] - d["xp"]
    d["z"] = np.where(d["var"] > 0, d["diff"] / np.sqrt(d["var"].clip(lower=1e-9)), 0.0)
    assert abs(d["p"].sum() - d["xp"].sum()) < 0.5, (d["p"].sum(), d["xp"].sum())
    d = d.sort_values(["diff", "team"], ascending=[False, True]).reset_index(drop=True)
    d.attrs["snapshot"] = snap
    return d


def surprise_players(con, min_games: int = 5):
    """Kenttäpelaajat: tehopisteet vs. esikauden ennuste × pelatut ottelut.

    Ennuste tulee jäädytetystä data/preseason_player_rates.csv:stä, ei
    player_rates-taulusta: se rakentuu kauden aikana uudelleen, eikä "mitä
    odotettiin" saa liikkua jälkikäteen. Pelaaja joka ei ollut esikauden
    rosterissa ei ole mukana -- hänelle ei julkaistu odotusta.

    Ottelut lasketaan kokoonpanoista (pelatut ottelut, ei poistetut), pisteet
    player_season_scoring:sta MIINUS epäonnistuneet rangaistuslaukaukset
    (RL0), jotka se laskee maaleiksi (avoin bugi, ks. CLAUDE.md).
    """
    import pandas as pd
    pre = pd.read_csv(PRESEASON_RATES, comment="#")
    d = query_df(con, """
        WITH cur AS (SELECT MAX(season) AS s FROM stg_games),
        gp AS (
          SELECT l.player_id, MAX(l.first_name) AS first_name,
                 MAX(l.last_name) AS last_name, MAX(l.team) AS team,
                 MAX(l.position_group) AS pos, COUNT(DISTINCT l.game_id) AS o
          FROM game_lineups l
          JOIN stg_games s ON s.season = l.season AND s.game_id = l.game_id
          WHERE l.season = (SELECT s FROM cur) AND s.ended
            AND l.position_group <> 'G' AND NOT COALESCE(l.removed, FALSE)
          GROUP BY l.player_id),
        rl0 AS (
          SELECT player_id, COUNT(*) AS n FROM raw_goal_events
          WHERE season = (SELECT s FROM cur) AND goal_types LIKE '%RL0%'
          GROUP BY player_id)
        SELECT gp.*, COALESCE(sc.goals, 0) - COALESCE(rl0.n, 0) AS g,
               COALESCE(sc.points, 0) - COALESCE(rl0.n, 0) AS p
        FROM gp
        LEFT JOIN player_season_scoring sc
               ON sc.player_id = gp.player_id AND sc.season = (SELECT s FROM cur)
        LEFT JOIN rl0 ON rl0.player_id = gp.player_id""")
    if d.empty:
        return d
    by_id = {int(r.player_id): r.ppg for r in pre.dropna(subset=["player_id"]).itertuples()}
    # Tuontipelaajilla ei ollut esikaudella id:tä, joten nimi + joukkue.
    by_name = {(_norm(r.name), r.team): r.ppg for r in pre.itertuples()}
    d["ppg"] = [by_id.get(int(pid), by_name.get((_norm(f"{fn} {ln}"), tm)))
                for pid, fn, ln, tm in zip(d.player_id, d.first_name,
                                           d.last_name, d.team)]
    d = d[d["ppg"].notna() & (d["o"] >= min_games)].copy()
    d["exp"] = d["ppg"] * d["o"]
    d["diff"] = d["p"] - d["exp"]
    d = d.sort_values(["diff", "p"], ascending=False).reset_index(drop=True)
    d.attrs.update(min_games=min_games)
    return d


def surprise_table_slide(t: dict, d) -> str:
    head = ('<div class="g17 sp hd"><div></div><div class="l">Joukkue</div>'
            '<div>O</div><div>Pisteet</div><div>Ennuste</div>'
            '<div>Yli / ali</div></div>')
    rows = []
    for r in d.itertuples():
        col = XG_UP if r.diff >= 0.05 else (XG_DOWN if r.diff <= -0.05 else MUTED)
        rows.append(f"""
      <div class="g17 sp r">
        <div class="c17"><img src="{logo_uri(r.team)}" alt=""></div>
        <div class="n17">{r.team}</div>
        <div class="m17">{int(r.o)}</div>
        <div class="b17">{int(r.p)}</div>
        <div class="m17">{_fi(r.xp)}</div>
        <div class="d17" style="color:{col}">{_fi(r.diff, sign=True)}</div>
      </div>""")
    big = d[d["z"].abs() >= 2]["team"].tolist()
    if not big:
        verdict = "Yhdenkään joukkueen ero ei vielä ylitä tavallista vaihtelua."
    else:
        # Ei genetiiviä: joukkueiden nimet taipuvat epäsäännöllisesti
        # (KooKoon, Ässien, Jukurien), eikä ":n" ole oikein yhdellekään.
        who = big[0] if len(big) == 1 else ", ".join(big[:-1]) + f" ja {big[-1]}"
        verdict = ("Niin suuri ero, ettei sitä selitä tavallinen vaihtelu: "
                   f"{who}.")
    return page(t, f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · Ennuste vs. toteuma</div>
      <div class="title">Alkukauden<br>yllättäjät</div>
    </div>
    <div class="rule"></div>
    <div class="body tbl17">{head}{"".join(rows)}</div>
    <div class="foot">Ennuste = pisteet, jotka esikauden malli
      ({_fi_date(d.attrs['snapshot'])}) antoi juuri näistä otteluista ·
      yli / ali = kuinka paljon enemmän (+) tai vähemmän (−) pisteitä.
      {verdict}</div>
  </div>""")


def surprise_goalies(con, min_games: int = 3):
    """Maalivahdit: päästetyt vs. mitä HÄNEN OMA esikauden torjuntaennusteensa
    olisi päästänyt samoista paikoista.

    Pohja on goalie_saves() (omat päästetyt, vain yksin pelatut ottelut,
    odotus = vastustajan xG × kauden päästösuhde). Siihen kerrotaan
    maalivahdin esikauden kerroin (1 − ennuste) / (1 − liigan keskiarvo),
    jolloin kärkeen nousee se joka ylitti OMAN odotuksensa -- ei se jonka
    tiedettiin jo valmiiksi olevan hyvä. Ennuste on jäädytetty
    data/preseason_player_rates.csv:hen (proj_save_pct).
    """
    import pandas as pd
    g = goalie_saves(con, min_games=min_games)
    if g.empty:
        return g
    pre = pd.read_csv(PRESEASON_RATES, comment="#")
    pre = pre[pre["position_group"] == "G"]
    avg = load_config()["goaltending"]["league_avg_save_pct"]
    by_id = {int(r.player_id): r.proj_save_pct
             for r in pre.dropna(subset=["player_id"]).itertuples()}
    by_name = {(_norm(r.name), r.team): r.proj_save_pct for r in pre.itertuples()}
    g["proj"] = [by_id.get(int(pid), by_name.get((_norm(f"{fn} {ln}"), tm)))
                 for pid, fn, ln, tm in zip(g.player_id, g.first_name,
                                            g.last_name, g.team)]
    g = g[g["proj"].notna()].copy()
    g["exp_own"] = g["exp"] * (1 - g["proj"]) / (1 - avg)
    g["diff"] = g["exp_own"] - g["ga"]
    return g.sort_values("diff", ascending=False).reset_index(drop=True)


def surprise_players_slide(t: dict, picks: list, min_games: int) -> str:
    """Yllättäjien kokoonpano kentän muodossa: kolme hyökkääjää ylhäällä,
    kaksi puolustajaa keskellä, maalivahti alhaalla.
    picks: [(kategoria, rivi, onko maalivahti)] järjestyksessä 3 H, 2 P, 1 MV."""
    def card(cat, r, gk) -> str:
        full = f"{r.first_name} {r.last_name}"
        if gk:
            sub = (f"{r.team} · {int(r.o)} ottelua<br>päästi {int(r.ga)}, "
                   f"ennuste {_fi(r.exp_own)}")
            unit = "maalia"
        else:
            sub = (f"{r.team} · {int(r.o)} ottelua<br>{int(r.p)} p, "
                   f"ennuste {_fi(r.exp)}")
            unit = "pistettä"
        # Pitkä sukunimi ei saa rikkoa kortin leveyttä.
        size = "" if len(r.last_name) <= 10 else \
            f' style="font-size:{max(20, int(30 * 10 / len(r.last_name)))}px"'
        return f"""
        <div class="ln">
          {face_or_crest(full, r.team)}
          <div class="aw-cat">{cat}</div>
          <div class="ln-name"{size}>{r.last_name}</div>
          <div class="ln-sub">{sub}</div>
          <div class="ln-num" style="color:{XG_UP}">{_fi(r.diff, sign=True)}</div>
          <div class="ln-unit">{unit}</div>
        </div>"""
    rows = [[p for p in picks if p[0] == c]
            for c in ("Hyökkääjä", "Puolustaja", "Maalivahti")]
    body = "".join('<div class="ln-row">' + "".join(card(*p) for p in row) + "</div>"
                   for row in rows if row)
    return page(t, f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · Ennuste vs. toteuma</div>
      <div class="title">Yllättäjät<br>kentällä</div>
    </div>
    <div class="rule"></div>
    <div class="body">
      <div class="lineup">{body}</div>
    </div>
    <div class="foot">Kenttäpelaajat: tehopisteet yli oman esikauden ennusteen
      (ennuste × pelatut ottelut), vähintään {min_games} ottelua · maalivahti:
      maaleja vähemmän kuin hänen esikauden torjuntaennusteensa olisi
      päästänyt samoista paikoista · mukana esikauden rosterin pelaajat</div>
  </div>""")


def surprise_post(con=None) -> list:
    """Alkukauden yllättäjät: joukkueet ja pelaajat. [(tiedostonimi, png)]."""
    own = con is None
    con = con or get_connection()
    try:
        teams, players = surprise_teams(con), surprise_players(con)
        goalies = surprise_goalies(con)
    finally:
        if own:
            con.close()
    if teams is None:
        return []
    out = [("yllattajat_joukkueet.png",
            surprise_table_slide(theme(GRADIENTS[4]), teams))]
    # Kokoonpano: kolme hyökkääjää, kaksi puolustajaa ja maalivahti.
    picks = []
    if not players.empty:
        picks += [("Hyökkääjä", r, False)
                  for r in players[players["pos"] == "F"].head(3).itertuples()]
        picks += [("Puolustaja", r, False)
                  for r in players[players["pos"] == "D"].head(2).itertuples()]
    if not goalies.empty:
        picks.append(("Maalivahti", next(goalies.head(1).itertuples()), True))
    if picks:
        out.append(("yllattajat_kentalla.png",
                    surprise_players_slide(theme(GRADIENTS[1]), picks,
                                           players.attrs.get("min_games", 5))))
    return [(name, rasterise(html)) for name, html in out]


def build() -> None:
    OUT.mkdir(exist_ok=True)
    con = get_connection()
    try:
        st = query_df(con, """SELECT proj_rank, team, mean_points, p05_points,
                                     p95_points
                              FROM standings_2026_27 ORDER BY proj_rank""")
        pos = query_df(con, "SELECT * FROM position_distribution_2026_27")
        ctx = rank_context(con)
    finally:
        con.close()

    bands = iqr_bands(pos, st["team"])
    if st.empty:
        raise SystemExit("standings_2026_27 empty — run scripts/refresh_standings.py")

    themes = [theme(g) for g in GRADIENTS]
    slides = []
    for i, (lo, hi) in enumerate([(1, 6), (7, 12), (13, 17)]):
        rows = list(st[(st.proj_rank >= lo) & (st.proj_rank <= hi)].itertuples())
        slides.append(standings_slide(rows, lo, hi, themes[i], bands, ctx))
    slides.append(how_slide(themes[3]))

    # Individual awards, read off the same projections as the table.
    # Blichfeld tops BOTH points and goals; the goals slot uses the runner-up
    # so three different players are named -- see the note in the README.
    picks = _award_picks()
    slides.append(award_slide(themes[4], picks))
    f5, d5, g5 = _top5_lists()
    pf = f"Järjestys ennustettujen pisteiden mukaan, {GAMES_PER_TEAM} ottelua"
    slides.append(top5_slide(themes[5], "Viisi parasta<br>hyökkääjää", f5, pf))
    slides.append(top5_slide(themes[6], "Viisi parasta<br>puolustajaa", d5, pf))
    slides.append(top5_slide(themes[7], "Viisi parasta<br>maalivahtia", g5,
                             "Järjestys ennustetun torjunta-%:n mukaan · vähintään 60 uraottelua"))
    slides.append(newcomers_slide(themes[8], _newcomer_picks()))

    for i, html in enumerate(slides, 1):
        src, png = OUT / f"slide_{i}.html", OUT / f"slide_{i}.png"
        src.write_text(html, encoding="utf-8")
        png.write_bytes(rasterise(html))
        print(f"  wrote {png.name}  ({png.stat().st_size // 1024} KB)")

    print()
    write_pdfs()
    print()

    figs = "".join(f'<figure><img src="slide_{i}.png"></figure>'
                   for i in range(1, len(slides) + 1))
    (OUT / "index.html").write_text(f"""<!doctype html><html><head>
<meta charset="utf-8"><title>Liiga 2026-27 — carousel</title><style>
 body{{font-family:{BODY_F};background:#0e0e0e;color:#EEE;margin:0;padding:40px}}
 h1{{font-family:{HEAD_F};color:{GOLD};font-size:24px;text-transform:uppercase;
    letter-spacing:2px;border-bottom:4px solid {GOLD};padding-bottom:18px}}
 p.lead{{max-width:900px;line-height:1.6;font-size:14px;color:#BBB}}
 .grid{{display:flex;flex-wrap:wrap;gap:20px;margin:30px 0}}
 figure{{margin:0}} figure img{{width:320px;display:block}}
 textarea{{width:100%;max-width:900px;height:360px;font-family:{BODY_F};
   background:#1b1b1b;color:#EEE;font-size:13px;padding:14px;border:1px solid #333;
   line-height:1.5}}
 code{{background:#2a2a2a;color:{GOLD};padding:2px 6px}}
</style></head><body>
<h1>Liiga 2026-27 — carousel</h1>
<p class="lead">Five {W}×{H} images. Upload <code>slide_1.png</code> …
<code>slide_9.png</code> in order. Regenerate with
<code>python scripts/build_instagram.py</code>.</p>
<div class="grid">{figs}</div>
<h2 style="font-size:18px">PDF bundles</h2>
<p class="lead">{"".join(f'<a style="color:{GOLD}" href="{f}">{f}</a> — {l} ({len(o)} pages)<br>' for f, l, o in PDF_BUNDLES)}
Each bundle ends with <em>How it is built</em>, so either can be sent on its own.</p>
<h2 style="font-size:18px">Caption</h2>
<textarea readonly>{CAPTION}</textarea>
</body></html>""", encoding="utf-8")
    print(f"\n  open: file://{OUT/'index.html'}")


if __name__ == "__main__":
    build()
