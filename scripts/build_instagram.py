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
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from PIL import Image                                    # noqa: E402

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

HEAD_F = '"Arial Black","Helvetica Neue",Arial,sans-serif'
BODY_F = '"Helvetica Neue",Arial,Helvetica,sans-serif'


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
    return f"""
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
  .body {{ flex:1; padding:26px 64px 0; }}
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
  .pts {{ text-align:right; }}
  .ptsn {{ font-family:{HEAD_F}; font-size:54px; line-height:1; font-style:italic;
          font-variant-numeric:tabular-nums; color:{CREAM}; }}
  .ptsl {{ font-size:19px; color:{t['muted']}; margin-top:8px; }}
  .ptsr {{ font-size:21px; color:{t['accent']}; margin-top:5px; opacity:0.85; }}

  /* ---- technical slides ---- */
  .step {{ display:flex; gap:18px; margin-bottom:11px; align-items:flex-start; }}
  .num {{ min-width:42px; height:42px; background:{CREAM}; color:{INK};
         font-family:{HEAD_F}; font-size:21px; display:flex;
         align-items:center; justify-content:center; }}
  /* DIRECT child only -- inline <b> inside the description must stay inline,
     otherwise every highlighted parameter becomes its own block heading */
  .txt > b {{ font-family:{HEAD_F}; font-size:23px; display:block; color:{t['fg']};
             margin-bottom:4px; text-transform:uppercase; letter-spacing:-0.3px; }}
  .txt span {{ font-size:18px; line-height:1.34; color:{t['fg']}; opacity:0.88; }}
  .txt span b, .callout span b {{ color:{t['accent']}; opacity:1; }}
  .callout {{ background:{t['panel']}; border-left:8px solid {t['bar']};
             padding:14px 22px; margin-top:2px; }}
  .callout > b {{ font-family:{HEAD_F}; font-size:22px; display:block;
                 margin-bottom:7px; color:{t['accent']}; text-transform:uppercase; }}
  .callout span {{ font-size:18px; line-height:1.34; color:{t['fg']}; opacity:0.9; }}
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
"""


def page(t: dict, inner: str) -> str:
    return (f"<!doctype html><html><head><meta charset='utf-8'>"
            f"<style>{css(t)}</style></head><body>{inner}</body></html>")


def standings_slide(rows, lo: int, hi: int, t: dict, bands: dict) -> str:
    body = "".join(f"""
      <div class="row">
        <div class="rank">{int(r.proj_rank)}</div>
        <div class="chip"><img src="{logo_uri(r.team)}" alt=""></div>
        <div class="name">{r.team}</div>
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
    <div class="foot">{N_SIMS} simuloitua kautta · ”todennäk.” = keskimmäiset 50 % lopputuloksista</div>
  </div>""")


def how_slide(t: dict) -> str:
    steps = [
        ("Kaikki lähtee pelaajista, ei viime kauden taulukosta",
         "Jokaisesta pelaajasta on kerätty viiden kauden datasetti — vain "
         "sellaisia tilastoja, jotka löytyvät EliteProspectsista. Ei "
         "taikakaavoja."),
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
         "35–37-vuotiaana ja <b>0,40</b>:een 38+ (case Harri Pesonen). "
         "Mitattu, ei arvattu."),
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
      <div class="callout">
        <b>Ottelumalli</b>
        <span>Maalit arvotaan <b>Poisson</b>-mallista, λ = sarjan ka. ×
        hyökkäys × vastustajan puolustus × kotietu. <b>Dixon-Coles</b>-korjaus
        nostaa vähämaalisia tasatuloksia niin että jatkoajat osuvat Liigan
        oikeaan <b>23 %</b>:iin. Elo huomioi maalieron (k=16).</span>
      </div>
      <div class="callout" style="margin-top:16px">
        <b>Toimiiko se?</b>
        <span>Testattu kausilla 2023–26 niin, että jokainen kausi
        ennustettiin vain sitä edeltävällä datalla: pistevirhe keskimäärin
        <b>{MAE_FI}</b>, ottelutason log-loss <b>0,672</b> vs. <b>0,686</b>
        pelkällä arvauksella, taulukon <b>Spearman ρ 0,48</b>.</span>
      </div>
      <p class="next">Tämä on vasta ennakko. Jatkossa hilavitkutin päivittyy
      toteuman mukaan ajastetuissa <b>Snowflake ML -ajoissa</b>: joka yö
      oikeat tulokset sisään ja uusi simulointi vain pelaamattomista
      otteluista. Ja kyllä, Snowflakella voi tehdä ML:ää.</p>
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


def build() -> None:
    OUT.mkdir(exist_ok=True)
    con = get_connection()
    try:
        st = query_df(con, """SELECT proj_rank, team, mean_points, p05_points,
                                     p95_points
                              FROM standings_2026_27 ORDER BY proj_rank""")
        pos = query_df(con, "SELECT * FROM position_distribution_2026_27")
    finally:
        con.close()

    # Interquartile finishing range per team. The 5-95 band is honest but far
    # too wide to be useful on a slide (KooKoo would read "1st-11th"); the IQR
    # still carries 50-87% of the probability mass and is legible at a glance.
    bands = {}
    if not pos.empty:
        cols = [f"rank_{i}" for i in range(1, 18)]
        pos = pos.set_index("team")
        for team in st["team"]:
            cum, lo_r, hi_r = 0.0, None, 17
            for i, c in enumerate(cols, 1):
                cum += float(pos.loc[team, c])
                if lo_r is None and cum >= 0.25:
                    lo_r = i
                if cum >= 0.75:
                    hi_r = i
                    break
            lo_r = lo_r or 1
            bands[team] = (f"{_ordinal(lo_r)}–{_ordinal(hi_r)}" if lo_r != hi_r
                           else _ordinal(lo_r))
    if st.empty:
        raise SystemExit("standings_2026_27 empty — run scripts/refresh_standings.py")

    themes = [theme(g) for g in GRADIENTS]
    slides = []
    for i, (lo, hi) in enumerate([(1, 6), (7, 12), (13, 17)]):
        rows = list(st[(st.proj_rank >= lo) & (st.proj_rank <= hi)].itertuples())
        slides.append(standings_slide(rows, lo, hi, themes[i], bands))
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
        subprocess.run(
            [CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
             "--force-device-scale-factor=1", f"--window-size={W},{H}",
             f"--screenshot={png}", f"file://{src}"],
            check=True, capture_output=True)
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
