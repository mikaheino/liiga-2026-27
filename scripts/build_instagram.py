"""Build an Instagram carousel of the 2026-27 Liiga prediction.

SEPARATE from the main infographic. Reads the same DuckDB tables as
scripts/build_site.py but writes to site_instagram/ and never touches site/.

Produces five 1080x1350 (4:5) PNGs, ready to upload as a carousel:

    slide_1.png   ranks  1-6
    slide_2.png   ranks  7-12
    slide_3.png   ranks 13-17
    slide_4.png   "how this is made", in plain language
    slide_5.png   what happens next (Snowflake ML through the season)

plus site_instagram/index.html -- a preview page with a copy-paste caption.

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

# keep in sync with scripts/build_site.py / AGENTS.md §10
POISSON_PCT, ELO_PCT, CROWD_PCT = 40, 60, 20
BACKTEST_MAE = 12.7
N_SIMS = "10,000"

# Recordly brand palette, read off recordlydata.com's own stylesheet:
#   #1b1b1b dominant (78 uses), #e3ff87 signature lime (24), #ffaf03 secondary,
#   greys #f3f3f3 / #d0d0d0 / #868686 / #5b5b5b.
# Type: headings "GT America Expanded" -> Arial Black, body "GT America" -> Arial
# (GT America is licensed; Arial Black/Arial are Recordly's own declared fallbacks).
INK      = "#1b1b1b"      # primary background
LIME     = "#e3ff87"      # signature accent
ORANGE   = "#ffaf03"      # secondary accent
OFFWHITE = "#f3f3f3"
GREY     = "#868686"
GREY_DK  = "#5b5b5b"
RULE     = "#333333"
HEAD_F   = '"GT America Expanded","Arial Black",Arial,sans-serif'
BODY_F   = '"GT America",Arial,Helvetica,sans-serif'


def _slug(team: str) -> str:
    return (team.lower().replace("ä", "a").replace("ö", "o").replace("å", "a")
            .replace(" ", "-"))


def logo_uri(team: str) -> str:
    """Inline the logo so each slide renders standalone (no network, no paths)."""
    p = LOGOS / f"{_slug(team)}.png"
    if not p.exists():
        return ""
    return "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()


def zone(rank: int) -> str:
    """Accent colour for the playoff / wild-card / outside bands.

    Colour alone carries the band now -- the explanatory labels under each
    team were removed to cut template chrome.
    """
    if rank <= 6:
        return LIME
    if rank <= 10:
        return ORANGE
    return GREY


CSS = f"""
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ width:{W}px; height:{H}px; overflow:hidden; background:{INK};
         font-family:{BODY_F}; color:#FFFFFF; -webkit-font-smoothing:antialiased; }}
  .slide {{ width:{W}px; height:{H}px; display:flex; flex-direction:column;
           background:{INK}; }}
  .head {{ padding:64px 64px 34px; }}
  .kicker {{ font-family:{HEAD_F}; font-size:21px; letter-spacing:4px;
            text-transform:uppercase; color:{LIME}; margin-bottom:20px; }}
  .title {{ font-family:{HEAD_F}; font-size:82px; line-height:0.95;
           text-transform:uppercase; letter-spacing:-1px; color:#FFFFFF; }}
  .rule {{ height:5px; background:{LIME}; margin:34px 64px 0; }}
  .body {{ flex:1; padding:30px 64px 0; }}
  .foot {{ padding:26px 64px 46px; display:flex; justify-content:space-between;
          align-items:flex-end; font-size:20px; color:{GREY}; }}
  .wordmark {{ font-family:{HEAD_F}; font-size:24px; letter-spacing:2px;
              color:{LIME}; text-transform:uppercase; }}

  /* ---- standings rows ---- */
  .body.standings {{ display:flex; flex-direction:column; padding-bottom:10px; }}
  .body.standings .row {{ flex:1; padding:0; }}
  .row {{ display:flex; align-items:center; gap:30px;
         border-bottom:1px solid {RULE}; }}
  .row:last-child {{ border-bottom:none; }}
  .rank {{ width:96px; font-family:{HEAD_F}; font-size:68px; text-align:right;
          line-height:1; }}
  /* white chip: several club marks are dark-inked and would vanish on #1b1b1b */
  .chip {{ width:92px; height:92px; background:#FFFFFF; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          flex-shrink:0; }}
  .chip img {{ width:66px; height:66px; object-fit:contain; }}
  .name {{ flex:1; font-family:{HEAD_F}; font-size:44px; text-transform:uppercase;
          letter-spacing:-0.5px; color:#FFFFFF; }}
  .pts  {{ text-align:right; }}
  .ptsn {{ font-family:{HEAD_F}; font-size:56px; font-variant-numeric:tabular-nums;
          line-height:1; }}
  .ptsl {{ font-size:19px; color:{GREY}; margin-top:9px; }}

  /* ---- explainer slides ---- */
  .step {{ display:flex; gap:28px; margin-bottom:30px; align-items:flex-start; }}
  .num {{ min-width:56px; height:56px; background:{LIME}; color:{INK};
         font-family:{HEAD_F}; font-size:28px; display:flex; align-items:center;
         justify-content:center; }}
  .txt b {{ font-family:{HEAD_F}; font-size:30px; display:block; color:#FFFFFF;
           margin-bottom:9px; text-transform:uppercase; letter-spacing:-0.3px; }}
  .txt span {{ font-size:25px; line-height:1.45; color:{OFFWHITE}; }}
  .callout {{ background:#252525; border-left:9px solid {LIME};
             padding:30px 34px; margin-top:10px; }}
  .callout > b {{ font-family:{HEAD_F}; font-size:29px; display:block;
                 margin-bottom:13px; color:{LIME}; text-transform:uppercase; }}
  .callout span {{ font-size:25px; line-height:1.5; color:{OFFWHITE}; }}
  .callout span b {{ color:{LIME}; }}
  .big {{ font-size:33px; line-height:1.45; color:{OFFWHITE}; }}
"""


def slide_html(inner: str) -> str:
    return (f"<!doctype html><html><head><meta charset='utf-8'>"
            f"<style>{CSS}</style></head><body>{inner}</body></html>")


def standings_slide(rows, lo: int, hi: int, idx: int, total: int) -> str:
    body = []
    for r in rows:
        col = zone(int(r.proj_rank))
        body.append(f"""
      <div class="row">
        <div class="rank" style="color:{col}">{int(r.proj_rank)}</div>
        <div class="chip"><img src="{logo_uri(r.team)}" alt=""></div>
        <div class="name">{r.team}</div>
        <div class="pts">
          <div class="ptsn" style="color:{col}">{r.mean_points:.0f}</div>
          <div class="ptsl">{int(r.p05_points)}–{int(r.p95_points)} pts</div>
        </div>
      </div>""")
    return slide_html(f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · Season prediction</div>
      <div class="title">Places {lo}–{hi}</div>
    </div>
    <div class="rule"></div>
    <div class="body standings">{''.join(body)}</div>
    <div class="foot">
      <span>Projected points · {N_SIMS} simulated seasons</span>
      <span class="wordmark">Recordly</span>
    </div>
  </div>""")


def how_slide(idx: int, total: int) -> str:
    steps = [
        ("Start with players, not teams",
         "Every team is rebuilt from the players actually on its roster today. "
         "Transfers are baked in from day one."),
        ("Count the goals they really scored",
         "Five seasons of scoring history for each player, with the most "
         "recent season counting the most."),
        ("Adjust for age and league",
         "A 20-year-old and a 38-year-old are not the same bet. Neither is a "
         "goal in the AHL and a goal in Liiga."),
        ("Add the goalies",
         "Save percentage decides how many goals a team lets in — often the "
         "difference between a playoff spot and a golden helmet."),
        ("Play the season 10,000 times",
         "Every one of the 60 games is simulated over and over. The table "
         "shows the average result, not a single guess."),
    ]
    items = "".join(
        f'<div class="step"><div class="num">{i}</div>'
        f'<div class="txt"><b>{t}</b><span>{d}</span></div></div>'
        for i, (t, d) in enumerate(steps, 1))
    return slide_html(f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · Season prediction</div>
      <div class="title">How this is made</div>
    </div>
    <div class="rule"></div>
    <div class="body">
      {items}
      <div class="callout">
        <span>Two models vote on every game — a goal-scoring model ({POISSON_PCT}%)
        and a team-strength rating ({ELO_PCT}%) — then a crowd of {CROWD_PCT}% fan
        predictions is mixed in. Tested on past seasons, it lands within about
        {BACKTEST_MAE} points of a team's real total.</span>
      </div>
    </div>
    <div class="foot">
      <span>Built from public Liiga data</span>
      <span class="wordmark">Recordly</span>
    </div>
  </div>""")


def next_slide(idx: int, total: int) -> str:
    return slide_html(f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · What happens next</div>
      <div class="title">This keeps<br>updating all season</div>
    </div>
    <div class="rule"></div>
    <div class="body">
      <p class="big">This is a pre-season forecast — but it does not stop here.</p>
      <div class="callout" style="margin-top:34px">
        <b>Moving into Snowflake ML jobs</b>
        <span>I am putting this pipeline into <b>Snowflake ML jobs</b> and running
        it as a scheduled job right through the season. Every night it takes the
        real results, re-rates every team, and re-simulates only the games that
        are still to be played.</span>
      </div>
      <p class="big" style="margin-top:34px">So the table above is just the
      starting point. As the season goes on the forecast keeps correcting itself
      — and you get to see exactly where it was right and where it was wrong.</p>
      <div class="callout" style="margin-top:34px;border-left-color:{ORANGE}">
        <b>Follow along</b>
        <span>I will be posting how these predictions hold up as the season
        plays out — hits and misses both.</span>
      </div>
    </div>
    <div class="foot">
      <span>Player-level model · Snowflake ML · updated daily</span>
      <span class="wordmark">Recordly</span>
    </div>
  </div>""")


CAPTION = """I built a model that predicts the whole Liiga 2026–27 season — here is what it says. 🏒

Swipe for places 1–17.

It does not look at last year's table. It starts from the players: five seasons of scoring for every single player on every roster, adjusted for age, for the league they played in, and for who is in goal. Then it plays the season 10,000 times and takes the average.

Next step: I am moving the whole pipeline into Snowflake ML jobs so it re-runs every night on real results and keeps correcting itself all season. I will keep posting how it holds up — including where it gets it wrong.

#liiga #jääkiekko #hockey #datascience #machinelearning #snowflake #analytics"""


def build() -> None:
    OUT.mkdir(exist_ok=True)
    con = get_connection()
    try:
        st = query_df(con, """SELECT proj_rank, team, mean_points, p05_points,
                                     p95_points, p_title
                              FROM standings_2026_27 ORDER BY proj_rank""")
    finally:
        con.close()
    if st.empty:
        raise SystemExit("standings_2026_27 is empty — run scripts/refresh_standings.py first")

    bands = [(1, 6), (7, 12), (13, 17)]
    total = len(bands) + 2
    slides = []
    for i, (lo, hi) in enumerate(bands, 1):
        rows = list(st[(st.proj_rank >= lo) & (st.proj_rank <= hi)].itertuples())
        slides.append(standings_slide(rows, lo, hi, i, total))
    slides.append(how_slide(4, total))
    slides.append(next_slide(5, total))

    made = []
    for i, html in enumerate(slides, 1):
        src = OUT / f"slide_{i}.html"
        png = OUT / f"slide_{i}.png"
        src.write_text(html, encoding="utf-8")
        subprocess.run(
            [CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
             "--force-device-scale-factor=1", f"--window-size={W},{H}",
             f"--screenshot={png}", f"file://{src}"],
            check=True, capture_output=True)
        made.append(png)
        print(f"  wrote {png.name}  ({png.stat().st_size // 1024} KB)")

    preview = "".join(
        f'<figure><img src="slide_{i}.png" alt="slide {i}">'
        f'<figcaption>Slide {i}</figcaption></figure>' for i in range(1, len(slides) + 1))
    (OUT / "index.html").write_text(f"""<!doctype html><html><head>
<meta charset="utf-8"><title>Liiga 2026–27 — Instagram carousel</title>
<style>
 body{{font-family:{BODY_F};background:#0e0e0e;color:#EEE;margin:0;padding:40px}}
 h1{{font-family:{HEAD_F};background:{INK};color:{LIME};margin:-40px -40px 30px;padding:26px 40px;font-size:24px;text-transform:uppercase;letter-spacing:2px;border-bottom:4px solid {LIME}}}
 p.lead{{max-width:900px;line-height:1.6;font-size:14px}}
 .grid{{display:flex;flex-wrap:wrap;gap:24px;margin:30px 0}}
 figure{{margin:0;background:{INK};padding:12px;border:1px solid #333}}
 figure img{{width:320px;display:block}}
 figcaption{{font-size:12px;color:{GREY};padding-top:8px;text-align:center}}
 textarea{{width:100%;max-width:900px;height:230px;font-family:{BODY_F};background:#1b1b1b;color:#EEE;
   font-size:13px;padding:14px;border:1px solid #BBB;line-height:1.5}}
 code{{background:#2a2a2a;color:{LIME};padding:2px 6px}}
</style></head><body>
<h1>Liiga 2026–27 — Instagram carousel</h1>
<p class="lead">Five ready-made {W}×{H} images (Instagram's 4:5 portrait format).
Upload <code>slide_1.png</code> … <code>slide_5.png</code> in order.
Regenerate any time with <code>python scripts/build_instagram.py</code> —
the numbers come straight from the live model.</p>
<div class="grid">{preview}</div>
<h2 style="font-size:18px">Caption</h2>
<textarea readonly>{CAPTION}</textarea>
</body></html>""", encoding="utf-8")
    print(f"\n  wrote {OUT/'index.html'}  (preview + caption)")
    print(f"  open: file://{OUT/'index.html'}")


if __name__ == "__main__":
    build()
