"""Build an Instagram/LinkedIn carousel of the 2026-27 Liiga prediction.

SEPARATE from the main infographic. Reads the same DuckDB tables as
scripts/build_site.py but writes to site_instagram/ and never touches site/.

Five 1080x1350 (4:5) PNGs. Backgrounds run as a ramp from the brand yellow
down to near-black across the carousel; text and accent colours flip with
background luminance so contrast holds on every slide.

    slide_1  places 1-6      slide_4  how it is built (technical)
    slide_2  places 7-12     slide_5  what runs next (Snowflake ML)
    slide_3  places 13-17

Audience is data practitioners, so the method slide and caption are written
with concrete parameters rather than analogies.

    python scripts/refresh_standings.py     # make sure standings are current
    python scripts/build_instagram.py
"""
from __future__ import annotations

import base64
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from liiga.db import get_connection, query_df           # noqa: E402

OUT = ROOT / "site_instagram"
LOGOS = ROOT / "site" / "assets" / "logos"
W, H = 1080, 1350                                        # Instagram 4:5 portrait
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# model facts — keep in sync with scripts/build_site.py / AGENTS.md §10
POISSON_PCT, ELO_PCT, CROWD_PCT = 40, 60, 20
BACKTEST_MAE = 12.65
N_SIMS = "10,000"

LIME = "#e3ff87"        # brand yellow, start of the ramp
INK = "#1b1b1b"         # near-black, end of the ramp

# Each slide is black-dominant with a yellow bloom in the TOP-RIGHT corner,
# falling diagonally to near-black at bottom-left. The bloom's reach varies
# per slide so the carousel has movement without changing its identity.
# Stops are kept tight: the bright zone must die out before it reaches the
# first content row, or lime text sits on lime background.
GRADIENTS = [
    "linear-gradient(to bottom left, #e3ff87 0%, #6d7c39 9%, #1b1b1b 30%)",
    "linear-gradient(to bottom left, #d9f56f 0%, #5d6b31 7%, #1b1b1b 25%)",
    "linear-gradient(to bottom left, #e3ff87 0%, #667535 11%, #1b1b1b 34%)",
    "linear-gradient(to bottom left, #cbe862 0%, #4f5b2b 6%, #1b1b1b 22%)",
    "linear-gradient(to bottom left, #e3ff87 0%, #5a6830 8%, #1b1b1b 27%)",
]

HEAD_F = '"GT America Expanded","Arial Black",Arial,sans-serif'
BODY_F = '"GT America",Arial,Helvetica,sans-serif'


def _slug(team: str) -> str:
    return (team.lower().replace("ä", "a").replace("ö", "o").replace("å", "a")
            .replace(" ", "-"))


def logo_uri(team: str) -> str:
    p = LOGOS / f"{_slug(team)}.png"
    if not p.exists():
        return ""
    return "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()


def theme(gradient: str) -> dict:
    """Every slide is black-dominant now, so one light-on-dark palette serves
    all five -- no luminance flipping needed."""
    return {"grad": gradient, "fg": "#FFFFFF", "accent": LIME, "muted": "#9a9a8f",
            "rule": LIME, "panel": "rgba(255,255,255,0.07)", "bar": LIME}


def css(t: dict) -> str:
    return f"""
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ width:{W}px; height:{H}px; overflow:hidden; background:{INK};
         font-family:{BODY_F}; color:{t['fg']}; -webkit-font-smoothing:antialiased; }}
  .slide {{ width:{W}px; height:{H}px; display:flex; flex-direction:column;
           background:{INK}; background-image:{t['grad']}; }}
  .head {{ padding:60px 64px 28px; }}
  .kicker {{ font-family:{HEAD_F}; font-size:20px; letter-spacing:4px;
            text-transform:uppercase; color:{t['accent']}; margin-bottom:18px; }}
  .title {{ font-family:{HEAD_F}; font-size:78px; line-height:0.95;
           text-transform:uppercase; letter-spacing:-1px; color:{t['fg']}; }}
  .rule {{ height:5px; background:{t['rule']}; margin:26px 64px 0; }}
  .body {{ flex:1; padding:26px 64px 0; }}
  .foot {{ padding:20px 64px 42px; font-size:19px; color:{t['muted']}; }}

  /* ---- standings ---- */
  .body.standings {{ display:flex; flex-direction:column; padding-bottom:8px; }}
  .body.standings .row {{ flex:1; padding:0; }}
  .row {{ display:flex; align-items:center; gap:30px;
         border-bottom:1px solid {t['panel']}; }}
  .row:last-child {{ border-bottom:none; }}
  .rank {{ width:96px; font-family:{HEAD_F}; font-size:68px; text-align:right;
          line-height:1; color:{t['accent']}; }}
  /* white chip: several club crests are dark-inked and vanish on dark slides */
  .chip {{ width:92px; height:92px; background:#FFFFFF; border-radius:50%;
          display:flex; align-items:center; justify-content:center; flex-shrink:0; }}
  .chip img {{ width:66px; height:66px; object-fit:contain; }}
  .name {{ flex:1; font-family:{HEAD_F}; font-size:44px; text-transform:uppercase;
          letter-spacing:-0.5px; }}
  .pts {{ text-align:right; }}
  .ptsn {{ font-family:{HEAD_F}; font-size:56px; line-height:1;
          font-variant-numeric:tabular-nums; color:{t['accent']}; }}
  .ptsl {{ font-size:19px; color:{t['muted']}; margin-top:9px; }}

  /* ---- technical slides ---- */
  .step {{ display:flex; gap:22px; margin-bottom:21px; align-items:flex-start; }}
  .num {{ min-width:48px; height:48px; background:{t['accent']}; color:{INK};
         font-family:{HEAD_F}; font-size:24px; display:flex;
         align-items:center; justify-content:center; }}
  /* DIRECT child only -- inline <b> inside the description must stay inline,
     otherwise every highlighted parameter becomes its own block heading */
  .txt > b {{ font-family:{HEAD_F}; font-size:26px; display:block; color:{t['fg']};
             margin-bottom:6px; text-transform:uppercase; letter-spacing:-0.3px; }}
  .txt span {{ font-size:21px; line-height:1.4; color:{t['fg']}; opacity:0.88; }}
  .txt span b, .callout span b {{ color:{t['accent']}; opacity:1; }}
  .callout {{ background:{t['panel']}; border-left:8px solid {t['bar']};
             padding:22px 28px; margin-top:4px; }}
  .callout > b {{ font-family:{HEAD_F}; font-size:25px; display:block;
                 margin-bottom:10px; color:{t['accent']}; text-transform:uppercase; }}
  .callout span {{ font-size:21px; line-height:1.42; color:{t['fg']}; opacity:0.9; }}
  .big {{ font-size:29px; line-height:1.4; color:{t['fg']}; }}
"""


def page(t: dict, inner: str) -> str:
    return (f"<!doctype html><html><head><meta charset='utf-8'>"
            f"<style>{css(t)}</style></head><body>{inner}</body></html>")


def standings_slide(rows, lo: int, hi: int, t: dict) -> str:
    body = "".join(f"""
      <div class="row">
        <div class="rank">{int(r.proj_rank)}</div>
        <div class="chip"><img src="{logo_uri(r.team)}" alt=""></div>
        <div class="name">{r.team}</div>
        <div class="pts">
          <div class="ptsn">{r.mean_points:.0f}</div>
          <div class="ptsl">{int(r.p05_points)}–{int(r.p95_points)} pts</div>
        </div>
      </div>""" for r in rows)
    return page(t, f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · Season projection</div>
      <div class="title">Places {lo}–{hi}</div>
    </div>
    <div class="rule"></div>
    <div class="body standings">{body}</div>
    <div class="foot">Mean of {N_SIMS} Monte Carlo seasons · 5th–95th percentile</div>
  </div>""")


def how_slide(t: dict) -> str:
    steps = [
        ("Built from players, not last season",
         "Five seasons of goals per game for every player on every roster, "
         "with the most recent season weighted heaviest."),
        ("Foreign leagues converted, not guessed",
         "An import's scoring is rescaled into Liiga terms — <b>SHL 1.20, "
         "AHL 1.15, Allsvenskan 0.75, Mestis 0.35</b> — set from players who "
         "actually made that move."),
        ("Age is a cliff, not a slope",
         "Output holds up to about 28, then falls away fast: <b>0.67</b> of "
         "the previous rate at 35–37, <b>0.40</b> at 38 and over. Measured, "
         "not assumed."),
        ("Goalies carry the defence",
         "Each team's projected save percentage becomes a goals-against "
         "multiplier, pulled toward the league average so one hot 20-game "
         "run does not distort it."),
        ("Two models, then 10,000 seasons",
         "A goal-scoring model and a team-strength rating vote <b>40/60</b> on "
         "every game. The full schedule is then simulated <b>10,000</b> times."),
    ]
    items = "".join(
        f'<div class="step"><div class="num">{i}</div>'
        f'<div class="txt"><b>{a}</b><span>{b}</span></div></div>'
        for i, (a, b) in enumerate(steps, 1))
    return page(t, f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · Method</div>
      <div class="title">How it is built</div>
    </div>
    <div class="rule"></div>
    <div class="body">
      {items}
      <div class="callout">
        <b>Does it actually work?</b>
        <span>Tested on 2023–26, with each season predicted using only the
        seasons before it. On average it lands within about
        <b>{BACKTEST_MAE} points</b> of a team's real end-of-season total.</span>
      </div>
    </div>
    <div class="foot">Python · DuckDB · 10,000-season Monte Carlo</div>
  </div>""")


def next_slide(t: dict) -> str:
    return page(t, f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · What runs next</div>
      <div class="title">Moving it to<br>Snowflake ML</div>
    </div>
    <div class="rule"></div>
    <div class="body">
      <p class="big">The pre-season table is a cold start. What matters is what
      happens once real results land.</p>
      <div class="callout" style="margin-top:24px">
        <b>Scheduled Snowflake ML jobs</b>
        <span>Porting the pipeline into <b>Snowflake ML jobs</b> on a nightly
        schedule. Each run ingests the day's box scores, refits Elo through
        current results, re-derives team strength, and re-simulates
        <b>only unplayed fixtures</b> — banking actual points for games already
        in the book.</span>
      </div>
      <div class="callout" style="margin-top:22px">
        <b>Why the forecast sharpens</b>
        <span>The weight on pre-season expectation drops as the season goes on, handing over from prior belief to observed results. At game 60
        it converges on the real table by construction.</span>
      </div>
      <p class="big" style="margin-top:24px">I will publish the error as it
      moves — including where it was wrong.</p>
    </div>
    <div class="foot">Snowpark · scheduled tasks · nightly re-simulation</div>
  </div>""")


CAPTION = """I built a bottom-up model that projects the full Liiga 2026–27 table. Swipe for places 1–17, plus the method.

It deliberately ignores last season's standings. It starts at player level: five seasons of goals/game per player, exponentially recency-weighted (0.80/yr), shrunk toward positional means with a 20-game prior, then converted across leagues with NHLe-derived factors for every import (SHL 1.20, AHL 1.15, Allsvenskan 0.75, Mestis 0.35) calibrated on within-player movers.

Age is piecewise — 1.5%/yr from peak 26, plus a further 4%/yr past 33. That cliff was fitted on within-player year-over-year rate ratios (0.67 at 35–37, 0.40 at 38+) rather than assumed.

Goaltending enters as a defensive multiplier, (1−SV)/(1−SVlg), regressed 25 games toward a prior. Games are Poisson with Dixon-Coles tie inflation calibrated to Liiga's observed 23% OT rate, blended 40/60 with margin-of-victory Elo (k=16), then run through 10,000 Monte Carlo seasons.

Leakage-free backtest over 2023–26: points MAE 12.65, game log-loss 0.672 against a 0.686 base rate, Spearman ρ 0.48. Tuned on log-loss and MAE — ρ is far too noisy at n=4.

Next: porting it to Snowflake ML jobs on a nightly schedule, refitting Elo on real results and re-simulating only unplayed fixtures. I'll post the error as it moves.

#dataengineering #machinelearning #snowflake #analytics #sportsanalytics #montecarlo #liiga"""


def build() -> None:
    OUT.mkdir(exist_ok=True)
    con = get_connection()
    try:
        st = query_df(con, """SELECT proj_rank, team, mean_points, p05_points,
                                     p95_points
                              FROM standings_2026_27 ORDER BY proj_rank""")
    finally:
        con.close()
    if st.empty:
        raise SystemExit("standings_2026_27 empty — run scripts/refresh_standings.py")

    themes = [theme(g) for g in GRADIENTS]
    slides = []
    for i, (lo, hi) in enumerate([(1, 6), (7, 12), (13, 17)]):
        rows = list(st[(st.proj_rank >= lo) & (st.proj_rank <= hi)].itertuples())
        slides.append(standings_slide(rows, lo, hi, themes[i]))
    slides.append(how_slide(themes[3]))
    slides.append(next_slide(themes[4]))

    for i, html in enumerate(slides, 1):
        src, png = OUT / f"slide_{i}.html", OUT / f"slide_{i}.png"
        src.write_text(html, encoding="utf-8")
        subprocess.run(
            [CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
             "--force-device-scale-factor=1", f"--window-size={W},{H}",
             f"--screenshot={png}", f"file://{src}"],
            check=True, capture_output=True)
        print(f"  wrote {png.name}  ({png.stat().st_size // 1024} KB)")

    figs = "".join(f'<figure><img src="slide_{i}.png"></figure>'
                   for i in range(1, len(slides) + 1))
    (OUT / "index.html").write_text(f"""<!doctype html><html><head>
<meta charset="utf-8"><title>Liiga 2026-27 — carousel</title><style>
 body{{font-family:{BODY_F};background:#0e0e0e;color:#EEE;margin:0;padding:40px}}
 h1{{font-family:{HEAD_F};color:{LIME};font-size:24px;text-transform:uppercase;
    letter-spacing:2px;border-bottom:4px solid {LIME};padding-bottom:18px}}
 p.lead{{max-width:900px;line-height:1.6;font-size:14px;color:#BBB}}
 .grid{{display:flex;flex-wrap:wrap;gap:20px;margin:30px 0}}
 figure{{margin:0}} figure img{{width:320px;display:block}}
 textarea{{width:100%;max-width:900px;height:360px;font-family:{BODY_F};
   background:#1b1b1b;color:#EEE;font-size:13px;padding:14px;border:1px solid #333;
   line-height:1.5}}
 code{{background:#2a2a2a;color:{LIME};padding:2px 6px}}
</style></head><body>
<h1>Liiga 2026-27 — carousel</h1>
<p class="lead">Five {W}×{H} images. Upload <code>slide_1.png</code> …
<code>slide_5.png</code> in order. Regenerate with
<code>python scripts/build_instagram.py</code>.</p>
<div class="grid">{figs}</div>
<h2 style="font-size:18px">Caption</h2>
<textarea readonly>{CAPTION}</textarea>
</body></html>""", encoding="utf-8")
    print(f"\n  open: file://{OUT/'index.html'}")


if __name__ == "__main__":
    build()
