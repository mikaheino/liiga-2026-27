"""Generate the standings infographic as a self-contained local site.

Reads standings_2026_27 + position_distribution_2026_27 from DuckDB (read-only)
and the crowd consensus, and writes:

    site/index.html — full HTML document (open locally / http.server)

This local site is the ONLY output — never publish it to a claude.ai artifact.

Run after `python scripts/refresh_standings.py`:
    python scripts/build_site.py
Serve with:
    python -m http.server 8765 --directory site
"""
from __future__ import annotations

import glob
import json
import math
import re
import unicodedata
from datetime import date
from pathlib import Path

import duckdb
import pandas as pd

from liiga.config import load_config
from liiga.crowd import crowd_consensus

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
ASSETS = SITE / "assets"

# production ensemble facts shown in the header strip (keep in sync with
# scripts/refresh_standings.py and AGENTS.md §10)
POISSON_PCT, ELO_PCT, CROWD_PCT = 40, 60, 20
BACKTEST_MAE = 12.7
N_SIMS = "10 000"

# players named in the "How does this model work?" walkthrough — not always
# top-3 contributors, so their photos need explicit fetching (see load_data).
ELI5_PLAYERS = ["Mikko Kousa", "Aidan Dudas", "Gabriel Fortier", "Patrik Bartosak"]


def _slug(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def _ordinal(n: int) -> str:
    if 10 <= n % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def _download(url: str, dest: Path) -> bool:
    """Fetch url to dest unless already cached. Offline-safe: failures skip."""
    if dest.exists():
        return True
    try:
        import requests
        resp = requests.get(url, timeout=20,
                            headers={"User-Agent": "liiga-predict/0.1 (site assets)"})
        resp.raise_for_status()
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(resp.content)
        return True
    except Exception as exc:                       # noqa: BLE001 — build must not die offline
        print(f"  asset skipped ({dest.name}): {exc}")
        return False


def _assets(teams: list[str], player_names: list[str]) -> dict:
    """Team logos + player headshots, cached under site/assets/.

    Logos come from the season JSON (darkBg variant suits the theme). Player
    photos are mined from every cached game-detail file, newest season wins;
    players without a photo (e.g. fresh imports) get null -> initials avatar.
    """
    logos: dict[str, str | None] = {t: None for t in teams}
    season = json.loads((ROOT / "data/raw/games_2027.json").read_text())
    logo_urls: dict[str, str] = {}
    for g in season:
        for side in ("homeTeam", "awayTeam"):
            t = g[side]
            if t.get("teamName") in logos and t.get("logos", {}).get("darkBg"):
                logo_urls.setdefault(t["teamName"], t["logos"]["darkBg"])
    for team, url in logo_urls.items():
        dest = ASSETS / "logos" / f"{_slug(team)}.png"
        if _download(url + "?width=96", dest):
            logos[team] = f"assets/logos/{dest.name}"

    wanted = set(player_names)
    photo_urls: dict[str, list[tuple[int, str]]] = {}
    for f in sorted(glob.glob(str(ROOT / "data/raw/game_2*_*.json"))):
        season_no = int(Path(f).name.split("_")[1])
        try:
            d = json.loads(Path(f).read_text())
        except Exception:
            continue
        for side in ("homeTeamPlayers", "awayTeamPlayers"):
            for p in d.get(side) or []:
                nm = f"{p.get('firstName', '')} {p.get('lastName', '')}".strip()
                if nm in wanted and p.get("pictureUrl"):
                    photo_urls.setdefault(nm, []).append((season_no, p["pictureUrl"]))
    photos: dict[str, str | None] = {n: None for n in wanted}
    for nm, urls in photo_urls.items():
        dest = ASSETS / "players" / f"{_slug(nm)}.jpg"
        # newest season first; fall back to older URLs (2027 assets often 403)
        for _, url in sorted(set(urls), key=lambda x: -x[0]):
            if _download(url, dest):
                photos[nm] = f"assets/players/{dest.name}"
                break
    return {"logos": logos, "photos": photos}


def _history(con) -> dict:
    """Prediction-history snapshots (one per date) for the evolution chart."""
    try:
        h = con.execute(
            """SELECT snapshot_date, games_played, team, mean_points, proj_rank
               FROM prediction_history ORDER BY snapshot_date"""
        ).df()
    except duckdb.CatalogException:
        return {"dates": [], "gamesPlayed": [], "teams": {}}
    dates = sorted(h["snapshot_date"].unique())
    gp = [int(h[h["snapshot_date"] == d]["games_played"].iloc[0]) for d in dates]
    teams = {}
    for team, d in h.groupby("team"):
        by_date = d.set_index("snapshot_date")
        teams[team] = [
            round(float(by_date.loc[dt, "mean_points"]), 1) if dt in by_date.index else None
            for dt in dates
        ]
    return {"dates": dates, "gamesPlayed": gp, "teams": teams}


def _contributors(con, cfg) -> dict[str, list[dict]]:
    """Top-3 contributors per team, ranked by VALUE ABOVE POSITIONAL AVERAGE so
    forwards, defencemen and goalies compete on one scale.

    Skater impact = projected goals/game above the rostered average for their
    position (a 0.15 g/g defenceman is exceptional; a 0.15 g/g forward is not).
    Goalie impact = goals prevented per start vs league-average goaltending:
    league_avg_goals * (1 - goalie_mult). Raw goals/game would rank forwards
    1-2-3 on every team — goalie save% is regressed into a .904-.911 band, so
    even an elite goalie prevents only ~0.08 goals per start.
    """
    from liiga.goalies import parse_goalie_seasons, compute_goalie_ratings

    league_goals = cfg["team_strength"]["league_avg_goals_per_game"]
    league_sv = cfg["goaltending"]["league_avg_save_pct"]

    sk = con.execute(
        """SELECT team, name, position_group, projected_goals_per_game AS raw
           FROM player_rates
           WHERE position_group IS NULL OR position_group != 'G'"""
    ).df()
    sk["pos"] = sk["position_group"].fillna("F")
    pos_avg = sk.groupby("pos")["raw"].mean().to_dict()
    sk["impact"] = sk["raw"] - sk["pos"].map(pos_avg)

    seasons = parse_goalie_seasons()
    ratings = compute_goalie_ratings(seasons=seasons)
    groster = con.execute(
        """SELECT team, first_name || ' ' || last_name AS name
           FROM roster_2026_27 WHERE position_group = 'G'"""
    ).df()
    g = groster.merge(ratings, on="name", how="left").dropna(subset=["proj_save_pct"])
    grows = [{"team": r["team"], "name": r["name"], "pos": "G",
              "impact": league_goals * (1 - (1 - r["proj_save_pct"]) / (1 - league_sv))}
             for _, r in g.iterrows()]

    allc = pd.concat(
        [sk[["team", "name", "pos", "impact"]], pd.DataFrame(grows)],
        ignore_index=True,
    )
    top = allc.sort_values("impact", ascending=False).groupby("team").head(3)
    return {
        team: [{"name": r["name"], "pos": r["pos"], "impact": round(float(r["impact"]), 2)}
               for _, r in d.sort_values("impact", ascending=False).iterrows()]
        for team, d in top.groupby("team")
    }


def _yoy_decline(con, cfg, st, n=3) -> list[dict]:
    """Teams whose points-per-game rate is projected to fall the most vs
    their actual final points last season. Compares RATES, not raw totals,
    because the schedule grew from 60 to 64 games (17th team promoted) —
    comparing raw totals would flatter every returning team. Newly promoted
    teams (no prior Liiga season to compare against) are excluded.

    `st` is the standings_2026_27 DataFrame (team, mean_points, proj_rank),
    fetched via the same `con` that must still be open (called inside
    load_data()'s try/finally, before the connection closes).
    """
    from liiga.simulate import banked_points

    target = cfg["ingestion"]["target_season"]
    last_season = target - 1
    actual_pts = banked_points(con, last_season)
    if not actual_pts:
        return []

    def _games_played(season, ended_only):
        clause = "AND ended" if ended_only else ""
        df = con.execute(
            f"""SELECT team, COUNT(*) AS gp FROM (
                    SELECT home_team AS team FROM stg_games WHERE season = {season} {clause}
                    UNION ALL
                    SELECT away_team AS team FROM stg_games WHERE season = {season} {clause}
                ) GROUP BY team"""
        ).df()
        return df.set_index("team")["gp"].to_dict()

    gp_last = _games_played(last_season, ended_only=True)
    gp_proj = _games_played(target, ended_only=False)

    rank_last = {t: i + 1 for i, (t, _) in
                 enumerate(sorted(actual_pts.items(), key=lambda kv: -kv[1]))}

    out = []
    for _, r in st.iterrows():
        team = r["team"]
        if team not in actual_pts or not gp_last.get(team):
            continue  # promoted team, no prior Liiga season to compare
        ppg_last = actual_pts[team] / gp_last[team]
        ppg_proj = float(r["mean_points"]) / gp_proj.get(team, 64)
        out.append({
            "team": team,
            "rankLast": rank_last[team],
            "ptsLast": round(actual_pts[team]),
            "ppgLast": round(ppg_last, 2),
            "rankProj": int(r["proj_rank"]),
            "ptsProj": round(float(r["mean_points"]), 1),
            "ppgProj": round(ppg_proj, 2),
            "deltaPpg": round(ppg_proj - ppg_last, 2),
        })
    out.sort(key=lambda d: d["deltaPpg"])
    return out[:n]


def load_data():
    cfg = load_config()
    con = duckdb.connect(str(ROOT / "data" / "liiga.duckdb"), read_only=True)
    try:
        st = con.execute("SELECT * FROM standings_2026_27 ORDER BY proj_rank").df()
        pos = con.execute("SELECT * FROM position_distribution_2026_27").df()
        contributors = _contributors(con, cfg)
        history = _history(con)
        declines = _yoy_decline(con, cfg, st)
        try:  # written by scripts/daily_update.py; absent before the first run
            pm = con.execute("SELECT * FROM prediction_meta").df().iloc[0].to_dict()
        except duckdb.CatalogException:
            pm = None
    finally:
        con.close()

    all_names = [c["name"] for v in contributors.values() for c in v] + ELI5_PLAYERS
    assets = _assets(list(st["team"]), all_names)
    crowd = crowd_consensus()[["team", "rank_stdev"]].set_index("team")["rank_stdev"]

    rank_cols = [f"rank_{i}" for i in range(1, 18)]
    pos = pos.set_index("team")

    rows, heat = [], []
    for _, r in st.iterrows():
        team = r["team"]
        probs = [float(pos.loc[team, c]) for c in rank_cols]
        mean_r = sum(p * (i + 1) for i, p in enumerate(probs))
        var_r = sum(p * (i + 1) ** 2 for i, p in enumerate(probs)) - mean_r**2
        rows.append({
            "rank": int(r["proj_rank"]),
            "team": team,
            "pts": round(float(r["mean_points"]), 1),
            "p05": int(r["p05_points"]),
            "p95": int(r["p95_points"]),
            "pTitle": round(float(r["p_title"]), 4),
            "pTop6": round(float(r["p_top_playoff"]), 4),
            "pQuali": round(sum(probs[6:10]), 4),      # ranks 7-10
            "crowdRank": int(r["crowd_rank"]),
            "crowdStdev": round(float(crowd.get(team, float("nan"))), 1),
            "rankStdev": round(math.sqrt(max(var_r, 0.0)), 1),
        })
        heat.append({"team": team, "p": [round(p, 4) for p in probs]})

    meta = {
        "generated": date.today().strftime("%-d %b %Y"),
        "ptsMin": math.floor(min(x["p05"] for x in rows) / 5) * 5,
        "ptsMax": math.ceil(max(x["p95"] for x in rows) / 5) * 5,
        "gamesPlayed": int(pm["games_played"]) if pm else 0,
        "gamesTotal": int(pm["games_total"]) if pm else 544,
        "crowdPct": round(float(pm["crowd_weight_eff"]) * 100) if pm else CROWD_PCT,
    }
    return rows, heat, meta, contributors, history, assets, declines


TEMPLATE = r"""
<style>
  :root {
    /* retro (sm-liiga.fi ~2005) palette: white body, navy header, steel-blue
       table heads, flat squared-off boxes. Var NAMES kept stable from the
       prior dark theme so every downstream rule just re-themes automatically. */
    --bg:        #FFFFFF;
    --surf:      #F6F6F6;
    --row-a:     #FFFFFF;
    --row-b:     #EBEBEB;
    --row-hover: #DCE6F0;
    --border:    #CCCCCC;
    --border-hi: #99AABB;
    --gold:      #336699;
    --gold-dim:  rgba(51,102,153,0.12);
    --green:     #1F7A3D;
    --green-dim: rgba(31,122,61,0.12);
    --amber:     #CC5500;
    --amber-dim: rgba(204,85,0,0.12);
    --slate:     #667788;
    --label:     #666666;
    --text:      #1A1A1A;
    --texthi:    #001040;
    --red:       #CC0000;
    --red-dim:   rgba(204,0,0,0.10);
    --navy:      #001040;
    --navy-2:    #003464;
    --thead-bg:  #758FA8;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: Verdana, Arial, Helvetica, sans-serif;
    font-size: 12px;
    line-height: 1.5;
    padding: 0 0 60px;
  }

  .page { max-width: 1040px; margin: 0 auto; padding: 24px 20px 0; }

  /* ── retro header bar ── */
  .retro-bar {
    background: var(--navy); padding: 10px 20px; margin-bottom: 2px;
    display: flex; align-items: baseline; justify-content: space-between;
  }
  .retro-bar .brand {
    color: #FFFFFF; font-weight: 700; font-size: 13px; letter-spacing: 0.04em;
  }
  .retro-bar .tagline { color: #AFC4DC; font-size: 11px; }
  .retro-accent { height: 3px; background: var(--navy-2); margin-bottom: 22px; }

  .tlogo { width: 22px; height: 22px; object-fit: contain; flex: none; }
  .tlogo.sm { width: 17px; height: 17px; }
  .tcell { display: flex; align-items: center; gap: 10px; }
  .pphoto, .avatar {
    width: 28px; height: 28px; border-radius: 50%; flex: none;
    border: 1px solid var(--border-hi); background: var(--row-b);
  }
  .pphoto { object-fit: cover; object-position: top; }
  .avatar {
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 700; color: var(--slate); letter-spacing: 0.03em;
  }

  .eyebrow {
    font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
    color: var(--gold); font-weight: 700; margin-bottom: 10px;
    display: flex; align-items: center; gap: 10px;
  }
  .eyebrow::after { content: ''; flex: 1; height: 1px; background: var(--border-hi); }

  h1 {
    font-size: 19px; font-weight: 700; color: var(--texthi);
    letter-spacing: -0.01em; text-wrap: balance; margin-bottom: 4px;
  }
  .subtitle { font-size: 11.5px; color: var(--label); margin-bottom: 20px; }

  .model-strip { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 26px; align-items: center; }
  .chip {
    font-size: 11px; font-weight: 600; letter-spacing: 0.05em;
    padding: 3px 9px; border-radius: 0;
    background: var(--surf); border: 1px solid var(--border-hi); color: var(--label);
  }
  .chip.on { border-color: var(--gold); color: var(--gold); background: var(--gold-dim); }
  .chip-sep { color: var(--border-hi); font-size: 13px; }

  .tbl-wrap { overflow-x: auto; border: 1px solid var(--border-hi); border-radius: 0; }

  table {
    width: 100%; border-collapse: collapse;
    font-variant-numeric: tabular-nums; white-space: nowrap;
  }
  thead {
    background: var(--thead-bg); border-bottom: 1px solid var(--border-hi);
    position: sticky; top: 0; z-index: 1;
  }
  th {
    padding: 8px 14px; text-align: left;
    font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: #FFFFFF;
  }
  th.r { text-align: right; } th.c { text-align: center; }

  tbody tr { border-bottom: 1px solid var(--border); cursor: default; transition: background 0.1s; }
  tbody tr:last-child { border-bottom: none; }
  tbody tr:nth-child(odd)  { background: var(--row-a); }
  tbody tr:nth-child(even) { background: var(--row-b); }
  tbody tr:hover { background: var(--row-hover); }

  tr.cutoff td { border-top: 2px solid var(--gold); }
  tr.cutoff10 td { border-top: 1px dashed var(--slate); }

  td { padding: 11px 16px; vertical-align: middle; }
  td.r { text-align: right; } td.c { text-align: center; }

  .rnum {
    font-size: 13px; font-weight: 700; color: var(--slate);
    display: inline-block; width: 20px; text-align: right;
  }
  .rnum.p1 { color: var(--gold); }

  .tname { font-weight: 600; font-size: 14px; color: var(--texthi); }
  tr.quali .tname { color: var(--text); }
  tr.out .tname { color: var(--label); }

  .rc { min-width: 260px; }
  .range-wrap { display: flex; align-items: center; gap: 8px; }
  .pts-val {
    font-size: 14px; font-weight: 700; color: var(--texthi);
    min-width: 34px; text-align: right;
  }
  tr.quali .pts-val { color: var(--text); }
  tr.out .pts-val { color: var(--label); }

  .track { position: relative; flex: 1; height: 5px; background: var(--border); border-radius: 0; min-width: 80px; }
  .fill  { position: absolute; height: 100%; border-radius: 0; background: var(--green); opacity: 0.35; }
  tr.quali .fill { background: var(--amber); opacity: 0.35; }
  tr.out   .fill { background: var(--slate); opacity: 0.50; }
  .pin {
    position: absolute; width: 2px; height: 9px; top: -2px; border-radius: 1px;
    background: var(--green); transform: translateX(-50%);
  }
  tr.quali .pin { background: var(--amber); }
  tr.out   .pin { background: var(--slate); opacity: 0.8; }

  .prob {
    display: inline-block; font-size: 11.5px; font-weight: 700;
    padding: 2px 7px; border-radius: 0; min-width: 40px; text-align: center;
    letter-spacing: 0.01em;
  }
  .prob.pg    { color: var(--green); background: var(--green-dim); }
  .prob.pa    { color: var(--amber); background: var(--amber-dim); }
  .prob.ps    { color: var(--slate); background: transparent; }
  .prob.pgold { color: var(--gold);  background: var(--gold-dim); }

  .crowd-rank { font-size: 12.5px; font-weight: 600; color: var(--label); }

  .delta {
    display: inline-block; font-size: 11.5px; font-weight: 700;
    padding: 2px 6px; border-radius: 0; min-width: 36px; text-align: center;
  }
  .delta.up { color: var(--green); background: var(--green-dim); }
  .delta.dn { color: var(--red);   background: var(--red-dim); }
  .delta.eq { color: var(--slate); background: transparent; }

  .footer { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 18px 32px; align-items: center; }
  .legend-item { display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--label); }
  .leg-line { width: 24px; height: 2px; background: var(--gold); }
  .leg-dash { width: 24px; height: 0; border-top: 1px dashed var(--slate); }
  .leg-bar  { width: 24px; height: 5px; background: var(--green); opacity: 0.4; border-radius: 0; }

  /* ── section scaffolding ── */
  .section { margin-top: 44px; }
  .sec-head {
    font-size: 13px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--label); margin-bottom: 6px;
  }
  .sec-sub { font-size: 12px; color: var(--slate); margin-bottom: 18px; max-width: 680px; }

  /* ── disagreements ── */
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
  .card {
    background: var(--surf); border: 1px solid var(--border-hi); border-radius: 0;
    padding: 12px 14px;
  }
  .card-top { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
  .card-team { font-size: 14px; font-weight: 700; color: var(--texthi); }
  .card-ranks { font-size: 12px; color: var(--label); font-variant-numeric: tabular-nums; }
  .card-ranks strong { color: var(--texthi); font-weight: 700; }
  .card-note { font-size: 11.5px; color: var(--label); line-height: 1.55; }
  .card.warn { border-left: 3px solid var(--red); }
  .card-delta { font-size: 12px; font-weight: 700; color: var(--red); font-variant-numeric: tabular-nums; }

  /* ── heatmap ── */
  .heat-wrap { overflow-x: auto; border: 1px solid var(--border-hi); border-radius: 0; padding: 14px; background: var(--surf); }
  .heat { border-collapse: collapse; font-variant-numeric: tabular-nums; width: 100%; }
  .heat th {
    padding: 4px 0; font-size: 9px; color: var(--slate); text-align: center;
    text-transform: none; letter-spacing: 0;
  }
  .heat td.team {
    font-size: 11.5px; font-weight: 600; color: var(--text);
    padding: 0 10px 0 0; text-align: right; white-space: nowrap;
  }
  .heat td.cell { padding: 1px; }
  .heat .sq {
    position: relative; width: 100%; min-width: 26px; height: 22px; border-radius: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 9.5px; font-weight: 700; background: #F6F6F6;
    border: 1px solid #E0E0E0;
  }
  .heat .sq:hover { outline: 1px solid var(--gold); }
  .heat .sq.dim { font-weight: 400; font-size: 9px; }
  .heat th.cut, .heat td.cut { border-right: 2px solid var(--gold); }
  .heat th.cut10, .heat td.cut10 { border-right: 1px dashed var(--slate); }
  .heat-note { margin-top: 12px; font-size: 11px; color: var(--slate); line-height: 1.7; }
  .heat-note strong { color: var(--label); }

  /* ── history ── */
  .hist-wrap {
    border: 1px solid var(--border-hi); border-radius: 0; background: var(--surf);
    padding: 18px 18px 10px; overflow-x: auto;
  }
  .hist-svg { display: block; width: 100%; height: 400px; }
  .hist-line { fill: none; stroke-width: 2; opacity: 0.55; transition: opacity 0.12s; }
  .hist-hit { fill: none; stroke: transparent; stroke-width: 10; cursor: pointer; }
  .hist-label { font-size: 10.5px; fill: var(--label); cursor: pointer; }
  .hist-svg.focus .hist-line { opacity: 0.10; }
  .hist-svg.focus .hist-line.active { opacity: 1; }
  .hist-svg.focus .hist-label { opacity: 0.25; }
  .hist-svg.focus .hist-label.active { opacity: 1; fill: var(--texthi); font-weight: 700; }
  .hist-grid { stroke: var(--border); stroke-width: 1; }
  .hist-tick { font-size: 10px; fill: var(--slate); }
  .hist-tip {
    position: fixed; pointer-events: none; z-index: 5; display: none;
    background: #FFFFFF; border: 1px solid var(--border-hi); border-radius: 0;
    box-shadow: 1px 1px 0 rgba(0,0,0,0.15);
    padding: 6px 10px; font-size: 11.5px; color: var(--text);
    font-variant-numeric: tabular-nums; white-space: nowrap;
  }
  .hist-tip strong { color: var(--texthi); }
  .hist-empty {
    padding: 26px 10px; text-align: center; font-size: 12.5px; color: var(--slate);
  }

  /* ── contributors ── */
  .contrib-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(255px, 1fr)); gap: 12px; }
  .tcard {
    background: var(--surf); border: 1px solid var(--border-hi); border-radius: 0;
    padding: 10px 12px 8px;
  }
  .tcard-head {
    display: flex; align-items: baseline; gap: 7px;
    padding-bottom: 7px; margin-bottom: 5px; border-bottom: 1px solid var(--border);
  }
  .tcard-rank { font-size: 11px; font-weight: 700; color: var(--slate); font-variant-numeric: tabular-nums; }
  .tcard-team { font-size: 13px; font-weight: 700; color: var(--texthi); }
  .contrib-row {
    display: flex; align-items: center; gap: 9px;
    font-size: 12px; line-height: 1.4; color: var(--text);
    font-variant-numeric: tabular-nums; padding: 4px 0;
  }
  .pos-tag {
    flex: none; width: 16px; height: 16px; border-radius: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 700;
    background: var(--row-b); border: 1px solid var(--border-hi); color: var(--label);
  }
  .pos-tag.g { background: var(--gold-dim); border-color: var(--gold); color: var(--gold); }
  .contrib-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .contrib-val { font-weight: 700; color: var(--texthi); font-size: 12px; }

  /* ── eli5 ── */
  .eli5 { margin-top: 44px; border-top: 1px solid var(--border-hi); padding-top: 28px; }
  .eli5-head {
    font-size: 13px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--label); margin-bottom: 10px;
  }
  .eli5-intro { font-size: 13px; color: var(--text); margin-bottom: 14px; }
  .eli5-intro strong { color: var(--texthi); }

  .eli5-hero {
    display: flex; align-items: center; gap: 16px; margin-bottom: 22px;
    padding: 14px 18px; background: var(--surf); border: 1px solid var(--border-hi);
  }
  .eli5-hero .eli5-logo { width: 40px; height: 40px; margin: 0; }
  .eli5-hero-name { font-size: 16px; font-weight: 700; color: var(--texthi); }
  .eli5-hero-stats { display: flex; gap: 22px; margin-left: auto; }
  .eli5-hero-stat { text-align: right; }
  .eli5-hero-stat .num {
    font-size: 16px; font-weight: 700; color: var(--texthi);
    display: block; font-variant-numeric: tabular-nums;
  }
  .eli5-hero-stat .lbl { font-size: 9px; text-transform: uppercase; color: var(--label); letter-spacing: 0.05em; }

  .eli5-photo { margin-right: 6px; vertical-align: middle; }
  .eli5-photo.avatar { display: inline-flex; }
  .eli5-logo { width: 18px; height: 18px; vertical-align: middle; margin: 0 3px; }

  .eli5-steps { display: flex; flex-direction: column; gap: 0; }
  .eli5-step { display: flex; gap: 18px; padding: 14px 0; border-bottom: 1px solid var(--border); }
  .eli5-step:last-child { border-bottom: none; }
  .eli5-num {
    font-size: 12px; font-weight: 700; color: var(--gold); min-width: 20px;
    padding-top: 2px; font-variant-numeric: tabular-nums; opacity: 0.8;
  }
  .eli5-body { font-size: 13px; color: var(--text); line-height: 1.65; max-width: 760px; }
  .eli5-body strong { color: var(--texthi); font-weight: 600; }

  .eli5-calc {
    display: flex; flex-direction: column; gap: 3px; margin: 12px 0 10px;
    padding: 12px 14px; background: var(--surf);
    border: 1px solid var(--border-hi); border-radius: 0;
    font-variant-numeric: tabular-nums;
  }
  .calc-row { display: flex; align-items: baseline; gap: 0; font-size: 13px; line-height: 1.8; color: var(--text); }
  .calc-label  { min-width: 120px; color: var(--label); }
  .calc-val    { min-width: 44px; text-align: right; color: var(--texthi); font-weight: 600; }
  .calc-weight { min-width: 52px; text-align: right; color: var(--slate); font-size: 12px; padding: 0 6px; }
  .calc-result { min-width: 56px; text-align: right; color: var(--texthi); font-weight: 700; }
  .calc-total { border-top: 1px solid var(--border-hi); margin-top: 4px; padding-top: 4px; }
  .calc-total .calc-label, .calc-total .calc-result { color: var(--gold); }

  .league-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px 18px;
    max-width: none;
  }
  .league-grid .calc-row { font-size: 12px; line-height: 1.7; justify-content: space-between; }
  .league-grid .calc-row.calc-total { border-top: none; margin-top: 0; padding-top: 0; }
  .league-grid .calc-label { min-width: 0; }
  .league-grid .calc-weight { min-width: 0; text-align: right; }

  .eli5-table {
    width: 100%; border-collapse: collapse; margin: 12px 0 10px;
    font-size: 11.5px; font-variant-numeric: tabular-nums;
    border: 1px solid var(--border-hi);
  }
  .eli5-table th {
    background: var(--thead-bg); color: #FFFFFF; font-weight: 700;
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em;
    padding: 5px 9px; text-align: right;
  }
  .eli5-table th:first-child, .eli5-table th:nth-child(2) { text-align: left; }
  .eli5-table td { padding: 5px 9px; text-align: right; border-bottom: 1px solid var(--border); color: var(--text); }
  .eli5-table td:first-child, .eli5-table td:nth-child(2) { text-align: left; }
  .eli5-table tbody tr:nth-child(even) td { background: var(--row-b); }
  .eli5-table tr.total td {
    border-top: 2px solid var(--gold); border-bottom: none;
    font-weight: 700; color: var(--texthi); background: var(--surf);
  }

  .elo-example { gap: 6px; }
  .elo-setup {
    display: flex; align-items: baseline; gap: 8px;
    padding-bottom: 8px; margin-bottom: 4px; border-bottom: 1px solid var(--border-hi);
  }
  .elo-team   { font-weight: 700; color: var(--texthi); font-size: 13px; }
  .elo-rating { font-size: 12px; color: var(--gold); font-weight: 700; }
  .elo-vs     { color: var(--slate); font-size: 11px; margin: 0 4px; }
  .elo-desc   { font-size: 12px; color: var(--label); margin-bottom: 2px; }
  .elo-boring { color: var(--slate) !important; font-weight: 400 !important; font-size: 12px; }
  .elo-upset  { color: var(--green) !important; font-weight: 600 !important; font-size: 12px; }

  .note {
    margin-top: 20px; font-size: 11px; color: var(--slate); line-height: 1.8;
    max-width: 700px; border-top: 1px solid var(--border); padding-top: 14px;
  }
  .note strong { color: var(--label); }
</style>

<div class="retro-bar">
  <span class="brand">LIIGA ENNUSTE</span>
  <span class="tagline">Kausi 2026&ndash;27</span>
</div>
<div class="retro-accent"></div>

<div class="page">

  <div class="eyebrow">Liiga 2026–27 &nbsp;·&nbsp; Regular season prediction</div>
  <h1>2026–27 Standings Forecast</h1>
  <p class="subtitle">Monte Carlo simulation over the 64-game schedule &nbsp;·&nbsp; __NSIMS__ seasons &nbsp;·&nbsp; __STATUS__</p>

  <div class="model-strip">
    <span class="chip on">Poisson __PW__%</span>
    <span class="chip-sep">+</span>
    <span class="chip on">MOV-Elo __EW__%</span>
    <span class="chip-sep">+</span>
    <span class="chip on">Crowd __CW__%</span>
    <span class="chip" style="margin-left:4px">Backtest: __MAE__ pts MAE</span>
    <span class="chip">40 predictors</span>
  </div>

  <div class="tbl-wrap">
    <table id="standings">
      <thead>
        <tr>
          <th style="width:36px">#</th>
          <th>Team</th>
          <th class="rc">Projected points &nbsp;<span style="font-weight:400;opacity:.6;letter-spacing:0">(5th–95th pct.)</span></th>
          <th class="c">P(title)</th>
          <th class="c">P(top 6)</th>
          <th class="c">P(quali 7–10)</th>
          <th class="c">Crowd #</th>
          <th class="c">Δ</th>
        </tr>
      </thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>

  <div class="footer">
    <div class="legend-item"><div class="leg-line"></div> Direct playoff cutoff (top 6)</div>
    <div class="legend-item"><div class="leg-dash"></div> Qualification-round cutoff (ranks 7–10)</div>
    <div class="legend-item"><div class="leg-bar"></div> 5th–95th percentile of simulated points</div>
    <div class="legend-item"><span class="delta up" style="font-size:10px">+3</span> Model higher than crowd</div>
    <div class="legend-item"><span class="delta dn" style="font-size:10px">−3</span> Crowd higher than model</div>
  </div>

  <div class="section">
    <h2 class="sec-head">Where the model disagrees with the fans</h2>
    <div class="sec-sub">40 Jatkoaika.com forum members predicted the final table before the season.
      These are the teams where the model's projected rank differs most from the crowd consensus.</div>
    <div class="cards" id="cards"></div>
  </div>

  <div class="section">
    <h2 class="sec-head">Where could each team finish?</h2>
    <div class="sec-sub">Probability of each final position across __NSIMS__ simulated seasons.
      Gold line = direct playoffs (top 6), dashed line = qualification round (7–10).
      A long light row means a genuine wild card; a short bright row means the simulations agree.</div>
    <div class="heat-wrap">
      <table class="heat" id="heat"></table>
      <div class="heat-note" id="heatnote"></div>
    </div>
  </div>

  <div class="section">
    <h2 class="sec-head">Who carries each team's rating?</h2>
    <div class="sec-sub">The three biggest contributors to each team's projected strength in this
      prediction — the mix of forwards, defencemen and goalies the model actually leans on.
      Ranked by value above an average player in the same role: skaters by projected
      goals per game above their position's average, goalies by goals prevented per
      start versus league-average goaltending.</div>
    <div class="contrib-grid" id="contrib"></div>
  </div>

  <div class="section">
    <h2 class="sec-head">How the forecast has moved</h2>
    <div class="sec-sub">Projected final points per team, one snapshot per daily update.
      Hover a line to follow one team. Once the season starts, watch pre-season opinion
      give way to results.</div>
    <div class="hist-wrap" id="histwrap"></div>
    <div class="hist-tip" id="histtip"></div>
  </div>

  <div class="section">
    <h2 class="sec-head">Who did the worst off-season business?</h2>
    <div class="sec-sub">The 3 teams whose projected points-per-game fell the most versus their
      actual final result last season (rates, not raw totals — the schedule grew from 60 to 64
      games). Candidates for a roster that got weaker, not stronger — though some of this is
      ordinary regression to the mean, not necessarily bad team building.</div>
    <div class="cards" id="declines"></div>
  </div>

  <div class="eli5">
    <h2 class="eli5-head">How does this model work?</h2>
    <p class="eli5-intro">One team, built from scratch: <strong>Pelicans</strong>. Every step below uses their real players and their real schedule.</p>
    <div class="eli5-hero">
      __PELICANS_LOGO__
      <div class="eli5-hero-name">Pelicans</div>
      <div class="eli5-hero-stats">
        <div class="eli5-hero-stat"><span class="num">__PELICANS_RANK_ORD__</span><span class="lbl">Projected</span></div>
        <div class="eli5-hero-stat"><span class="num">__PELICANS_PTS__</span><span class="lbl">Points</span></div>
        <div class="eli5-hero-stat"><span class="num">__PELICANS_RANGE__</span><span class="lbl">Range</span></div>
      </div>
    </div>
    <div class="eli5-steps">
      <div class="eli5-step">
        <div class="eli5-num">1</div>
        <div class="eli5-body">
          <strong>Each player gets a scoring rate.</strong> Take Pelicans defenceman __KOUSA_PHOTO__<strong>Mikko Kousa</strong>, 39 years old. Here's his last five seasons:
          <table class="eli5-table">
            <thead><tr><th>Season</th><th>Team / League</th><th>Goals</th><th>Games</th></tr></thead>
            <tbody>
              <tr><td>2022</td><td>Pelicans</td><td>0</td><td>60</td></tr>
              <tr><td>2023</td><td>Germany (DEL)</td><td>5</td><td>52</td></tr>
              <tr><td>2024</td><td>Slovakia</td><td>2</td><td>32</td></tr>
              <tr><td>2025</td><td>SaiPa</td><td>4</td><td>60</td></tr>
              <tr class="total"><td>2026</td><td>Pelicans</td><td>2</td><td>60</td></tr>
            </tbody>
          </table>
          A scoreless 2022 and a two-goal 2026 aren't treated the same — recent seasons count for a lot more than old ones. Blend the five together, and Kousa profiles as a <strong>0.045</strong> goals/game defenceman.
        </div>
      </div>
      <div class="eli5-step">
        <div class="eli5-num">2</div>
        <div class="eli5-body">
          <strong>Age drags scoring down — and not gently.</strong> Real Liiga data: players score at just <strong>two-thirds</strong> of their rate the very next season once they hit 35, and less past 38. Kousa, 39, is deep in that zone: his 0.045 gets cut to <strong>0.03</strong>.
        </div>
      </div>
      <div class="eli5-step">
        <div class="eli5-num">3</div>
        <div class="eli5-body">
          <strong>Not every league is equally hard.</strong> A goal in the NHL isn't a goal in a junior league, so every season gets converted to a Liiga-equivalent scale:
          <div class="eli5-calc league-grid">
            <span class="calc-row"><span class="calc-label">NHL</span><span class="calc-weight">× 1.85</span></span>
            <span class="calc-row"><span class="calc-label">KHL</span><span class="calc-weight">× 1.40</span></span>
            <span class="calc-row"><span class="calc-label">SHL (Sweden)</span><span class="calc-weight">× 1.20</span></span>
            <span class="calc-row"><span class="calc-label">AHL (N. America)</span><span class="calc-weight">× 1.15</span></span>
            <span class="calc-row calc-total"><span class="calc-label">Liiga</span><span class="calc-weight">× 1.00</span></span>
            <span class="calc-row"><span class="calc-label">Czechia</span><span class="calc-weight">× 1.00</span></span>
            <span class="calc-row"><span class="calc-label">Switzerland</span><span class="calc-weight">× 1.00</span></span>
            <span class="calc-row"><span class="calc-label">NCAA</span><span class="calc-weight">× 0.80</span></span>
            <span class="calc-row"><span class="calc-label">DEL (Germany)</span><span class="calc-weight">× 0.80</span></span>
            <span class="calc-row"><span class="calc-label">Allsvenskan</span><span class="calc-weight">× 0.75</span></span>
            <span class="calc-row"><span class="calc-label">ICEHL (Austria)</span><span class="calc-weight">× 0.55</span></span>
            <span class="calc-row"><span class="calc-label">CHL (jr. Canada)</span><span class="calc-weight">× 0.55</span></span>
            <span class="calc-row"><span class="calc-label">Slovakia</span><span class="calc-weight">× 0.50</span></span>
            <span class="calc-row"><span class="calc-label">ECHL</span><span class="calc-weight">× 0.48</span></span>
            <span class="calc-row"><span class="calc-label">USHL (jr. USA)</span><span class="calc-weight">× 0.46</span></span>
            <span class="calc-row"><span class="calc-label">Denmark</span><span class="calc-weight">× 0.41</span></span>
            <span class="calc-row"><span class="calc-label">DEL2 (Germany)</span><span class="calc-weight">× 0.41</span></span>
            <span class="calc-row"><span class="calc-label">Norway</span><span class="calc-weight">× 0.37</span></span>
            <span class="calc-row"><span class="calc-label">France</span><span class="calc-weight">× 0.37</span></span>
            <span class="calc-row"><span class="calc-label">Mestis (Liiga 2nd tier)</span><span class="calc-weight">× 0.35</span></span>
            <span class="calc-row"><span class="calc-label">Other/unclassified</span><span class="calc-weight">× 0.30</span></span>
            <span class="calc-row"><span class="calc-label">Poland</span><span class="calc-weight">× 0.28</span></span>
            <span class="calc-row"><span class="calc-label">SWE-U20 (juniors)</span><span class="calc-weight">× 0.25</span></span>
            <span class="calc-row"><span class="calc-label">Liiga-U20 (juniors)</span><span class="calc-weight">× 0.20</span></span>
          </div>
          Kousa's own numbers: his 2023 season in Germany (5 goals in 52 games, 0.096/game) gets discounted to <strong>0.077</strong> — DEL's a bit weaker than Liiga. His 2024 season in Slovakia (2 goals in 32 games, 0.063/game) drops further, to <strong>0.031</strong> — an even easier league to score in.
        </div>
      </div>
      <div class="eli5-step">
        <div class="eli5-num">4</div>
        <div class="eli5-body">
          <strong>Team attack = its best 18 skaters, added up.</strong> Kousa is one piece of Pelicans' roster — but a small one: he's their <strong>23rd</strong>-highest projected scorer, outside the top 18 that count toward attack. __DUDAS_PHOTO__<strong>Aidan Dudas</strong> (0.22 goals/game) and __FORTIER_PHOTO__<strong>Gabriel Fortier</strong> (0.20) are the two who actually drive it.
        </div>
      </div>
      <div class="eli5-step">
        <div class="eli5-num">5</div>
        <div class="eli5-body">
          <strong>Goaltending drives defence.</strong> Not last year's goals-against (too dependent on opponents) — each goalie's own save%. Pelicans' __BARTOSAK_PHOTO__<strong>Patrik Bartosak</strong> projects a .911 save% vs the league's .908 average: worth about <strong>0.08</strong> fewer goals against per start.
        </div>
      </div>
      <div class="eli5-step">
        <div class="eli5-num">6</div>
        <div class="eli5-body">
          <strong>Elo tracks who's actually winning — and by how much.</strong> Every team starts at 1500. Wins transfer points from loser to winner, scaled by surprise and by goal margin.
          <div class="eli5-calc elo-example">
            <span class="calc-row elo-setup">
              <span class="elo-team">__PELICANS_LOGO__Pelicans</span><span class="elo-rating">1496</span>
              <span class="elo-vs">vs</span>
              <span class="elo-team">__SPORT_LOGO__Sport</span><span class="elo-rating">1367</span>
            </span>
            <span class="elo-desc">Pelicans are favoured to win ~72% of the time:</span>
            <span class="calc-row"><span class="calc-label">Pelicans win</span><span class="calc-result elo-boring">expected — small swing</span></span>
            <span class="calc-row"><span class="calc-label">Sport wins</span><span class="calc-result elo-upset">big upset — large swing</span></span>
          </div>
          Ratings move slowly across five seasons — right for a season that hasn't started yet. Every summer, they reset halfway back to 1500.
        </div>
      </div>
      <div class="eli5-step">
        <div class="eli5-num">7</div>
        <div class="eli5-body">
          <strong>Two models blend 40/60, game by game.</strong> That same game, __PELICANS_LOGO__Pelicans host __SPORT_LOGO__Sport: the player model says 57%, Elo says 72%.
          <div class="eli5-calc">
            <span class="calc-row"><span class="calc-label">Player model</span><span class="calc-val">57%</span><span class="calc-weight">× 40%</span><span class="calc-result">= 22.8%</span></span>
            <span class="calc-row"><span class="calc-label">Elo model</span><span class="calc-val">72%</span><span class="calc-weight">× 60%</span><span class="calc-result">= 43.2%</span></span>
            <span class="calc-row calc-total"><span class="calc-label">Blended</span><span class="calc-val"></span><span class="calc-weight"></span><span class="calc-result">= 66.0%</span></span>
          </div>
          Same formula for all 544 games. 40/60 tested best across four historical seasons.
        </div>
      </div>
      <div class="eli5-step">
        <div class="eli5-num">8</div>
        <div class="eli5-body">
          <strong>Overtime reality check.</strong> Pure math predicts ~16% of games go to OT; the real Liiga rate is <strong>23%</strong> — Pelicans' games included. The model inflates tie odds to match, and treats OT as a near coin flip (52% to the favourite) — worth 2 points instead of 3.
        </div>
      </div>
      <div class="eli5-step">
        <div class="eli5-num">9</div>
        <div class="eli5-body">
          <strong>40 fans add their two cents.</strong> Before puck drop, 40 Jatkoaika.com forum members predicted the final table — they had Pelicans <strong>__PELICANS_CROWD_ORD__</strong>. The model has them <strong>__PELICANS_RANK_ORD__</strong>. Their average rank, converted to points, gets blended in at 20% weight — phased out as real games replace it.
        </div>
      </div>
      <div class="eli5-step">
        <div class="eli5-num">10</div>
        <div class="eli5-body">
          <strong>The season is simulated __NSIMS__ times.</strong> Every remaining game plays out at its modeled odds, __NSIMS__ times over. That's how Pelicans land at <strong>__PELICANS_PTS__ points, __PELICANS_RANK_ORD__ place</strong> — with a realistic range of <strong>__PELICANS_RANGE__</strong>, not one fixed number.
        </div>
      </div>
    </div>
  </div>

  <div class="note">
    <strong>Model:</strong> Bottom-up player goal production (5-season recency-weighted history, age curve) → Poisson match model with goaltending-driven defense and an overtime-rate calibration (Liiga's observed 23% OT/SO share). Blended with margin-of-victory Elo (slow k, trained on 2022–2026 results). Crowd signal: mean predicted rank from 40 Jatkoaika.com forum members, converted to expected-points scale and weighted at 20%.
    <br><strong>Playoffs:</strong> Top 6 advance directly to the quarterfinals. Ranks 7–10 play a best-of-three qualification round for the last two spots — shown as its own probability column above (the round itself is not simulated).
    <br><strong>Regenerate:</strong> <code>python scripts/daily_update.py</code> (refetches results, re-predicts the remaining schedule, rebuilds this page)
  </div>

</div>

<script>
  const DATA = __DATA__;
  const { rows, heat, meta } = DATA;
  const PTS_MIN = meta.ptsMin, PTS_MAX = meta.ptsMax, PTS_SPAN = PTS_MAX - PTS_MIN;

  const pctPos = v => ((v - PTS_MIN) / PTS_SPAN * 100).toFixed(1) + '%';
  const fmtPct = p => Math.round(p * 100) + '%';

  const logo = (team, sm) => {
    const src = DATA.assets.logos[team];
    return src ? `<img class="tlogo${sm ? ' sm' : ''}" src="${src}" alt="">` : '';
  };
  const headshot = name => {
    const src = DATA.assets.photos[name];
    if (src) return `<img class="pphoto" src="${src}" alt="" loading="lazy">`;
    const init = name.split(' ').map(w => w[0]).slice(0, 2).join('');
    return `<div class="avatar">${init}</div>`;
  };
  const zoneColor = rank => rank <= 6 ? 'var(--green)' : rank <= 10 ? 'var(--amber)' : 'var(--slate)';

  function probChip(p, kind) {
    if (p < 0.005) return `<span class="prob ps">—</span>`;
    const pc = Math.round(p * 100);
    let cls;
    if (kind === 'title')      cls = p >= 0.15 ? 'pgold' : p >= 0.05 ? 'pa' : 'ps';
    else if (kind === 'top6')  cls = p >= 0.55 ? 'pg' : p >= 0.30 ? 'pa' : 'ps';
    else                       cls = p >= 0.30 ? 'pa' : 'ps';
    return `<span class="prob ${cls}">${pc}%</span>`;
  }

  function deltaChip(modelRank, crowdRank) {
    const d = crowdRank - modelRank; // positive = model more bullish
    if (d === 0) return `<span class="delta eq">—</span>`;
    const sign = d > 0 ? '+' : '−';
    const cls  = d > 0 ? 'up' : 'dn';
    return `<span class="delta ${cls}">${sign}${Math.abs(d)}</span>`;
  }

  // ── standings table ──
  const tbody = document.getElementById('tbody');
  rows.forEach(r => {
    const tr = document.createElement('tr');
    if (r.rank === 7)  tr.classList.add('cutoff');
    if (r.rank === 11) tr.classList.add('cutoff10');
    if (r.rank >= 7 && r.rank <= 10) tr.classList.add('quali');
    if (r.rank >= 11) tr.classList.add('out');

    const left  = pctPos(r.p05);
    const width = ((r.p95 - r.p05) / PTS_SPAN * 100).toFixed(1) + '%';
    const mean  = pctPos(r.pts);

    tr.innerHTML = `
      <td><span class="rnum${r.rank === 1 ? ' p1' : ''}">${r.rank}</span></td>
      <td><div class="tcell">${logo(r.team)}<span class="tname">${r.team}</span></div></td>
      <td class="rc">
        <div class="range-wrap">
          <span class="pts-val">${r.pts.toFixed(0)}</span>
          <div class="track">
            <div class="fill" style="left:${left};width:${width}"></div>
            <div class="pin"  style="left:${mean}"></div>
          </div>
          <span style="font-size:11px;color:var(--slate);min-width:72px">${r.p05}–${r.p95}</span>
        </div>
      </td>
      <td class="c">${probChip(r.pTitle, 'title')}</td>
      <td class="c">${probChip(r.pTop6, 'top6')}</td>
      <td class="c">${probChip(r.pQuali, 'quali')}</td>
      <td class="c"><span class="crowd-rank">${r.crowdRank}</span></td>
      <td class="c">${deltaChip(r.rank, r.crowdRank)}</td>
    `;
    tbody.appendChild(tr);
  });

  // ── disagreements ──
  const cards = document.getElementById('cards');
  rows
    .map(r => ({ ...r, d: r.crowdRank - r.rank }))
    .filter(r => Math.abs(r.d) >= 3)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d) || a.rank - b.rank)
    .forEach(r => {
      const bullish = r.d > 0;
      const note = bullish
        ? `The model has ${r.team} ${r.d} place${Math.abs(r.d) > 1 ? 's' : ''} higher than the fans do. Fan uncertainty here: σ ${r.crowdStdev} ranks.`
        : `The fans back ${r.team} ${Math.abs(r.d)} place${Math.abs(r.d) > 1 ? 's' : ''} higher than the model does. Fan uncertainty here: σ ${r.crowdStdev} ranks.`;
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `
        <div class="card-top">
          <span class="tcell">${logo(r.team, true)}<span class="card-team">${r.team}</span></span>
          ${deltaChip(r.rank, r.crowdRank)}
        </div>
        <div class="card-ranks">Model <strong>#${r.rank}</strong> &nbsp;·&nbsp; Crowd <strong>#${r.crowdRank}</strong></div>
        <div class="card-note">${note}</div>
      `;
      cards.appendChild(el);
    });

  // ── year-over-year declines ──
  const declineCards = document.getElementById('declines');
  (DATA.declines || []).forEach(d => {
    const el = document.createElement('div');
    el.className = 'card warn';
    el.innerHTML = `
      <div class="card-top">
        <span class="tcell">${logo(d.team, true)}<span class="card-team">${d.team}</span></span>
        <span class="card-delta">${d.deltaPpg.toFixed(2)} pts/gm</span>
      </div>
      <div class="card-ranks">Last season <strong>#${d.rankLast}</strong> (${d.ptsLast} pts, ${d.ppgLast}/gm)
        &nbsp;→&nbsp; Projected <strong>#${d.rankProj}</strong> (${d.ptsProj.toFixed(0)} pts, ${d.ppgProj}/gm)</div>
      <div class="card-note">Points-per-game down ${Math.abs(Math.round(d.deltaPpg / d.ppgLast * 100))}% versus their actual final rate last season.</div>
    `;
    declineCards.appendChild(el);
  });

  // ── position heatmap ──
  const heatTbl = document.getElementById('heat');
  const head = document.createElement('tr');
  head.innerHTML = '<th></th>' + Array.from({length: 17}, (_, i) => {
    const cut = i === 5 ? ' class="cut"' : i === 9 ? ' class="cut10"' : '';
    return `<th${cut}>${i + 1}</th>`;
  }).join('');
  heatTbl.appendChild(head);

  heat.forEach(row => {
    const tr = document.createElement('tr');
    let html = `<td class="team"><span class="tcell" style="justify-content:flex-end">${logo(row.team, true)}<span>${row.team}</span></span></td>`;
    row.p.forEach((p, i) => {
      // power ramp: flat mid-table distributions (peak ~9%) stay visible while
      // the 35-63% peaks still read as clearly darker-to-brighter
      const alpha = p < 0.002 ? 0 : Math.min(0.92, Math.pow(p / 0.35, 0.6) * 0.92);
      // every non-zero cell is labeled; sub-1% cells show <1, sub-0.05% stay blank
      let label = '';
      if (p >= 0.005) label = Math.round(p * 100);
      else if (p >= 0.0005) label = '&lt;1';
      const strong = p >= 0.08;
      const ink = alpha > 0.45 ? '#FFFFFF' : strong ? 'var(--texthi)' : 'var(--label)';
      const cut = i === 5 ? ' cut' : i === 9 ? ' cut10' : '';
      const tip = `${row.team} — ${(p * 100).toFixed(1)}% chance of finishing ${i + 1}.`;
      html += `<td class="cell${cut}"><div class="sq${strong ? '' : ' dim'}" title="${tip}"
        style="background:rgba(51,102,153,${alpha.toFixed(3)});color:${ink}">${label}</div></td>`;
    });
    tr.innerHTML = html;
    heatTbl.appendChild(tr);
  });

  // ── contributors per team (in table order) ──
  const contribGrid = document.getElementById('contrib');
  rows.forEach(r => {
    const list = DATA.contributors[r.team] || [];
    const card = document.createElement('div');
    card.className = 'tcard';
    const rowsHtml = list.map(c => {
      const tip = c.pos === 'G'
        ? 'Goals prevented per start vs league-average goaltending'
        : 'Projected goals per game above the average ' + (c.pos === 'D' ? 'defenceman' : 'forward');
      return `<div class="contrib-row" title="${tip}">
        ${headshot(c.name)}
        <span class="pos-tag${c.pos === 'G' ? ' g' : ''}">${c.pos}</span>
        <span class="contrib-name">${c.name}</span>
        <span class="contrib-val">+${c.impact.toFixed(2)}</span>
      </div>`;
    }).join('');
    card.innerHTML = `
      <div class="tcard-head">
        <span class="tcard-rank">${r.rank}</span>
        ${logo(r.team, true)}
        <span class="tcard-team">${r.team}</span>
      </div>${rowsHtml}`;
    contribGrid.appendChild(card);
  });

  // ── prediction history chart ──
  (function renderHistory() {
    const H = DATA.history;
    const wrap = document.getElementById('histwrap');
    if (!H.dates || H.dates.length < 2) {
      const when = H.dates && H.dates.length === 1
        ? `First snapshot saved ${H.dates[0]}. ` : '';
      wrap.innerHTML = `<div class="hist-empty">${when}History builds up one snapshot per
        daily update — the chart appears after the second snapshot.</div>`;
      return;
    }
    const W = 1200, HT = 400, mL = 46, mR = 130, mT = 14, mB = 30;
    const iw = W - mL - mR, ih = HT - mT - mB;
    const n = H.dates.length;
    const xs = i => mL + (n === 1 ? iw / 2 : i / (n - 1) * iw);
    const all = Object.values(H.teams).flat().filter(v => v != null);
    const yMin = Math.floor(Math.min(...all) / 10) * 10;
    const yMax = Math.ceil(Math.max(...all) / 10) * 10;
    const ys = v => mT + (1 - (v - yMin) / (yMax - yMin)) * ih;

    const fmtDate = d => {
      const [y, m, dd] = d.split('-');
      return `${+dd} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]}`;
    };

    let svg = `<svg class="hist-svg" viewBox="0 0 ${W} ${HT}" preserveAspectRatio="none" id="histsvg">`;
    for (let v = yMin; v <= yMax; v += 10) {
      svg += `<line class="hist-grid" x1="${mL}" x2="${W - mR}" y1="${ys(v)}" y2="${ys(v)}"/>`;
      svg += `<text class="hist-tick" x="${mL - 8}" y="${ys(v) + 3}" text-anchor="end">${v}</text>`;
    }
    const step = Math.max(1, Math.ceil(n / 6));
    for (let i = 0; i < n; i += step) {
      svg += `<text class="hist-tick" x="${xs(i)}" y="${HT - 10}" text-anchor="middle">${fmtDate(H.dates[i])}</text>`;
    }

    const rankByTeam = Object.fromEntries(rows.map(r => [r.team, r.rank]));
    // label placement: sort by final value, nudge apart at least 15px
    const finals = rows.map(r => {
      const series = H.teams[r.team] || [];
      const last = [...series].reverse().find(v => v != null);
      return { team: r.team, last, y: ys(last ?? yMin) };
    }).sort((a, b) => a.y - b.y);
    for (let i = 1; i < finals.length; i++) {
      if (finals[i].y - finals[i - 1].y < 15) finals[i].y = finals[i - 1].y + 15;
    }
    const labelY = Object.fromEntries(finals.map(f => [f.team, f.y]));

    rows.forEach(r => {
      const series = H.teams[r.team] || [];
      const pts = series.map((v, i) => v == null ? null : `${xs(i)},${ys(v)}`)
                        .filter(Boolean).join(' ');
      if (!pts) return;
      const col = zoneColor(r.rank);
      svg += `<polyline class="hist-line" data-team="${r.team}" points="${pts}" stroke="${col}"/>`;
      svg += `<polyline class="hist-hit" data-team="${r.team}" points="${pts}"/>`;
      svg += `<text class="hist-label" data-team="${r.team}" x="${W - mR + 10}" y="${labelY[r.team] + 3.5}">${r.team}</text>`;
    });
    svg += '</svg>';
    wrap.innerHTML = svg;

    const svgEl = document.getElementById('histsvg');
    const tip = document.getElementById('histtip');
    const clear = () => { svgEl.classList.remove('focus');
      svgEl.querySelectorAll('.active').forEach(e => e.classList.remove('active'));
      tip.style.display = 'none'; };
    svgEl.addEventListener('mouseover', e => {
      const team = e.target.dataset && e.target.dataset.team;
      if (!team) { clear(); return; }
      svgEl.classList.add('focus');
      svgEl.querySelectorAll('.active').forEach(el => el.classList.remove('active'));
      svgEl.querySelectorAll(`[data-team="${team}"]`).forEach(el => el.classList.add('active'));
    });
    svgEl.addEventListener('mousemove', e => {
      const team = e.target.dataset && e.target.dataset.team;
      if (!team) return;
      const rect = svgEl.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width * W;
      const i = Math.max(0, Math.min(n - 1, Math.round((fx - mL) / iw * (n - 1))));
      const v = (H.teams[team] || [])[i];
      if (v == null) return;
      tip.innerHTML = `<strong>${team}</strong> &nbsp;${fmtDate(H.dates[i])} &nbsp;·&nbsp; ${v.toFixed(1)} pts &nbsp;·&nbsp; ${H.gamesPlayed[i]} gp`;
      tip.style.display = 'block';
      tip.style.left = (e.clientX + 14) + 'px';
      tip.style.top = (e.clientY - 10) + 'px';
    });
    svgEl.addEventListener('mouseleave', clear);
  })();

  // wild-card note from rank stdevs
  const byStdev = [...rows].sort((a, b) => b.rankStdev - a.rankStdev);
  const wild = byStdev.slice(0, 2), tight = byStdev.slice(-2).reverse();
  document.getElementById('heatnote').innerHTML =
    `<strong>Wild cards:</strong> ${wild.map(r => `${r.team} (σ ${r.rankStdev} ranks)`).join(', ')} could land almost anywhere. ` +
    `<strong>Safest bets:</strong> ${tight.map(r => `${r.team} (σ ${r.rankStdev})`).join(', ')} — the simulations broadly agree on where they finish.`;
</script>
"""


def _eli5_photo(assets: dict, name: str) -> str:
    """Server-rendered player headshot for the static ELI5 section (mirrors
    the client-side headshot() JS used by the JS-populated sections)."""
    src = assets["photos"].get(name)
    if src:
        return f'<img class="pphoto eli5-photo" src="{src}" alt="" loading="lazy">'
    init = "".join(w[0] for w in name.split(" ")[:2])
    return f'<div class="avatar eli5-photo">{init}</div>'


def _eli5_logo(assets: dict, team: str) -> str:
    src = assets["logos"].get(team)
    return f'<img class="tlogo eli5-logo" src="{src}" alt="">' if src else ""


def render() -> str:
    rows, heat, meta, contributors, history, assets, declines = load_data()
    pelicans = next(r for r in rows if r["team"] == "Pelicans")
    if meta["gamesPlayed"] > 0:
        status = (f"Updated {meta['generated']} &nbsp;·&nbsp; "
                  f"{meta['gamesPlayed']} of {meta['gamesTotal']} games played")
    else:
        status = f"Generated {meta['generated']}"
    html = (
        TEMPLATE
        .replace("__DATA__", json.dumps({"rows": rows, "heat": heat, "meta": meta,
                                         "contributors": contributors,
                                         "history": history, "assets": assets,
                                         "declines": declines}))
        .replace("__STATUS__", status)
        .replace("__NSIMS__", N_SIMS)
        .replace("__PW__", str(POISSON_PCT))
        .replace("__EW__", str(ELO_PCT))
        .replace("__CW__", str(meta["crowdPct"]))
        .replace("__MAE__", str(BACKTEST_MAE))
        .replace("__PELICANS_RANGE__", f"{pelicans['p05']}–{pelicans['p95']}")
        .replace("__PELICANS_PTS__", f"{pelicans['pts']:.0f}")
        .replace("__PELICANS_RANK_ORD__", _ordinal(pelicans["rank"]))
        .replace("__PELICANS_CROWD_ORD__", _ordinal(pelicans["crowdRank"]))
        .replace("__KOUSA_PHOTO__", _eli5_photo(assets, "Mikko Kousa"))
        .replace("__DUDAS_PHOTO__", _eli5_photo(assets, "Aidan Dudas"))
        .replace("__FORTIER_PHOTO__", _eli5_photo(assets, "Gabriel Fortier"))
        .replace("__BARTOSAK_PHOTO__", _eli5_photo(assets, "Patrik Bartosak"))
        .replace("__PELICANS_LOGO__", _eli5_logo(assets, "Pelicans"))
        .replace("__SPORT_LOGO__", _eli5_logo(assets, "Sport"))
    )
    return html


def main() -> None:
    SITE.mkdir(exist_ok=True)
    fragment = render()

    title = "Liiga 2026–27 Standings Prediction"
    desc = ("Model-based season prediction for the 2026-27 Liiga season "
            "combining Poisson, margin-of-victory Elo, and crowd wisdom signals.")

    (SITE / "index.html").write_text(
        "<!doctype html>\n<html lang=\"en\">\n<head>\n"
        "<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n"
        f"<title>{title}</title>\n"
        f"<meta name=\"description\" content=\"{desc}\">\n"
        "</head>\n<body>\n" + fragment + "\n</body>\n</html>\n",
        encoding="utf-8",
    )
    (SITE / "artifact.html").unlink(missing_ok=True)   # legacy artifact fragment
    print(f"wrote {SITE / 'index.html'}")
    print("serve with: python -m http.server 8765 --directory site")


if __name__ == "__main__":
    main()
