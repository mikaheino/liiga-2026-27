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

# retro sm-liiga.fi palette, same language as the main site (scaled up for 1080px)
NAVY, NAVY2, STEEL = "#001040", "#003464", "#336699"
GREEN, AMBER, SLATE = "#1F7A3D", "#CC5500", "#667788"
INK, LABEL, LINE = "#1A1A1A", "#666666", "#CCCCCC"


def _slug(team: str) -> str:
    return (team.lower().replace("ä", "a").replace("ö", "o").replace("å", "a")
            .replace(" ", "-"))


def logo_uri(team: str) -> str:
    """Inline the logo so each slide renders standalone (no network, no paths)."""
    p = LOGOS / f"{_slug(team)}.png"
    if not p.exists():
        return ""
    return "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()


def zone(rank: int) -> tuple[str, str]:
    """(colour, label) for the playoff / qualifier / outside bands."""
    if rank <= 6:
        return GREEN, "PLAYOFFS"
    if rank <= 10:
        return AMBER, "WILD CARD"
    return SLATE, "OUTSIDE"


CSS = f"""
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ width:{W}px; height:{H}px; overflow:hidden;
         font-family:Verdana,Arial,Helvetica,sans-serif; color:{INK};
         background:#FFFFFF; -webkit-font-smoothing:antialiased; }}
  .slide {{ width:{W}px; height:{H}px; display:flex; flex-direction:column; }}
  .head {{ background:{NAVY}; color:#FFFFFF; padding:38px 56px 30px;
          border-bottom:10px solid {NAVY2}; }}
  .kicker {{ font-size:23px; letter-spacing:3px; text-transform:uppercase;
            color:#8FA8C8; margin-bottom:12px; }}
  .title {{ font-size:57px; font-weight:bold; line-height:1.04; }}
  .sub {{ font-size:25px; color:#B8CCE8; margin-top:14px; }}
  .body {{ flex:1; padding:34px 56px 0; }}
  .foot {{ padding:22px 56px 30px; border-top:3px solid {LINE};
          display:flex; justify-content:space-between; align-items:center;
          font-size:21px; color:{LABEL}; }}
  .pill {{ background:{STEEL}; color:#FFF; font-size:20px; font-weight:bold;
          padding:8px 18px; letter-spacing:1px; }}

  /* ---- standings rows ---- */
  /* rows share the leftover height so 6-row and 5-row slides both fill the
     1080x1350 frame -- no dead space at the bottom of the image */
  .body.standings {{ display:flex; flex-direction:column; padding-bottom:16px; }}
  .body.standings .row {{ flex:1; padding:0; }}
  .row {{ display:flex; align-items:center; gap:26px; padding:19px 0;
         border-bottom:2px solid #E4E4E4; }}
  .row:last-child {{ border-bottom:none; }}
  .rank {{ width:82px; font-size:52px; font-weight:bold; text-align:center;
          color:#FFF; padding:9px 0; }}
  .logo {{ width:80px; height:80px; object-fit:contain; }}
  .name {{ flex:1; font-size:41px; font-weight:bold; letter-spacing:-0.5px; }}
  .zone {{ font-size:17px; letter-spacing:2px; font-weight:bold; margin-top:6px; }}
  .pts  {{ text-align:right; }}
  .ptsn {{ font-size:47px; font-weight:bold; font-variant-numeric:tabular-nums;
          line-height:1; }}
  .ptsl {{ font-size:19px; color:{LABEL}; margin-top:8px; }}

  /* ---- explainer slides ---- */
  .step {{ display:flex; gap:26px; margin-bottom:29px; align-items:flex-start; }}
  .num {{ min-width:60px; height:60px; background:{STEEL}; color:#FFF;
         font-size:31px; font-weight:bold; display:flex; align-items:center;
         justify-content:center; }}
  .txt b {{ font-size:31px; display:block; margin-bottom:8px; }}
  .txt span {{ font-size:26px; line-height:1.45; color:#333; }}
  .callout {{ background:#F0F4F8; border-left:11px solid {STEEL};
             padding:30px 34px; margin-top:8px; }}
  .callout > b {{ font-size:31px; display:block; margin-bottom:12px; color:{NAVY}; }}
  .callout span {{ font-size:26px; line-height:1.5; color:#333; }}
  .big {{ font-size:34px; line-height:1.45; }}
"""


def slide_html(inner: str) -> str:
    return (f"<!doctype html><html><head><meta charset='utf-8'>"
            f"<style>{CSS}</style></head><body>{inner}</body></html>")


def standings_slide(rows, lo: int, hi: int, idx: int, total: int) -> str:
    body = []
    for r in rows:
        col, zlabel = zone(int(r.proj_rank))
        body.append(f"""
      <div class="row">
        <div class="rank" style="background:{col}">{int(r.proj_rank)}</div>
        <img class="logo" src="{logo_uri(r.team)}" alt="">
        <div class="name">{r.team}
          <div class="zone" style="color:{col}">{zlabel}</div>
        </div>
        <div class="pts">
          <div class="ptsn">{r.mean_points:.0f}</div>
          <div class="ptsl">{int(r.p05_points)}–{int(r.p95_points)} pts</div>
        </div>
      </div>""")
    head_sub = {1: "The projected top six", 2: "The chasing pack",
                3: "Predicted to miss out"}[idx]
    return slide_html(f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · Season prediction</div>
      <div class="title">Places {lo}–{hi}</div>
      <div class="sub">{head_sub}</div>
    </div>
    <div class="body standings">{''.join(body)}</div>
    <div class="foot">
      <span>Projected points · {N_SIMS} simulated seasons</span>
      <span class="pill">{idx} / {total}</span>
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
      <div class="sub">No crystal ball — just goals, ages and a lot of maths</div>
    </div>
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
      <span class="pill">{idx} / {total}</span>
    </div>
  </div>""")


def next_slide(idx: int, total: int) -> str:
    return slide_html(f"""
  <div class="slide">
    <div class="head">
      <div class="kicker">Liiga 2026–27 · What happens next</div>
      <div class="title">This keeps<br>updating all season</div>
      <div class="sub">A prediction you can hold me to</div>
    </div>
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
      <div class="callout" style="margin-top:34px;border-left-color:{GREEN}">
        <b>Follow along</b>
        <span>I will be posting how these predictions hold up as the season
        plays out — hits and misses both.</span>
      </div>
    </div>
    <div class="foot">
      <span>Player-level model · Snowflake ML · updated daily</span>
      <span class="pill">{idx} / {total}</span>
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
 body{{font-family:Verdana,Arial,sans-serif;background:#EEE;color:{INK};margin:0;padding:40px}}
 h1{{background:{NAVY};color:#fff;margin:-40px -40px 30px;padding:26px 40px;font-size:24px}}
 p.lead{{max-width:900px;line-height:1.6;font-size:14px}}
 .grid{{display:flex;flex-wrap:wrap;gap:24px;margin:30px 0}}
 figure{{margin:0;background:#fff;padding:12px;border:1px solid #BBB}}
 figure img{{width:320px;display:block}}
 figcaption{{font-size:12px;color:{LABEL};padding-top:8px;text-align:center}}
 textarea{{width:100%;max-width:900px;height:230px;font-family:Verdana,sans-serif;
   font-size:13px;padding:14px;border:1px solid #BBB;line-height:1.5}}
 code{{background:#DDD;padding:2px 6px}}
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
