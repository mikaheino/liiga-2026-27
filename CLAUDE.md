# Liiga 2026-27 — Claude Code notes

## Repo & git (since 2026-08-18)

Version-controlled at **https://github.com/mikaheino/liiga-2026-27** (public),
pushed over SSH using a dedicated key **`~/.ssh/id_ed25519_liiga`** (configured
in `~/.ssh/config`, not one of the other keys on this machine). Never print or
paste the private key contents. Commit after roster-update batches — see
AGENTS.md §13 for why (a prompt-injection incident this repo recovered from
manually before git existed here).

## ⚠️ NEVER update the claude.ai artifact

The infographic is LOCAL-ONLY (`site/index.html`). Do NOT publish or redeploy
it to a claude.ai artifact — not with the Artifact tool, not on request to
"update the infographic" (that means the local site). The old artifact at
https://claude.ai/code/artifact/c1cda021-9ae9-4199-a8f0-c92483b50d0f is a
frozen snapshot; leave it alone.

## Standings infographic — local site (2026-07-06)

The infographic is generated from the DuckDB tables by `scripts/build_site.py`
and lives in `site/` (self-contained HTML, no external requests):

```bash
python scripts/daily_update.py        # refetch results → re-predict remaining games → rebuild site
python -m http.server 8765 --directory site   # serve locally (or just open site/index.html)
```

A launchd job (`com.liiga.daily-update`, 08:30 daily, installed in
`~/Library/LaunchAgents/`) runs `scripts/daily_update.sh` automatically — once
the season starts the site banks real points, retrains Elo on current results,
simulates only the remaining games, and decays the crowd weight by season
progress. Logs: `logs/daily_update.log`. Pre-season the job is a harmless no-op
refresh. (`refresh_standings.py` + `build_site.py` remain the manual
pre-season path.)

What's in it (all the "more informative" ideas from June are done):
- 17-team table: projected points + 5th–95th pct range bars, P(title),
  P(top 6) and P(quali 7–10) split, explicit Crowd # column + Δ chips
- "Where the model disagrees with the fans" card grid (auto: |Δ| ≥ 3)
- Position-distribution heatmap (gold sequential, power-scaled alpha so flat
  mid-table rows stay visible; labels ≥ 8%, title-attr tooltips)
- Wild-cards/safest-bets note from rank stdevs
- "Who carries each team's rating?" — top-3 contributors per team (F/D/G mixed),
  ranked by value above positional average (skaters: goals/game above position
  mean; goalies: goals prevented per start vs league-average goaltending —
  raw goals/game would make it all-forwards everywhere)
- ELI5 (10 steps) — includes league-strength conversion, the age curve, MOV-Elo, 40/60 blend, and OT-calibration steps

Keep the header strip + ELI5 numbers in sync with the model: weights and MAE
are constants at the top of `scripts/build_site.py`.

**Verify visual changes by screenshot, not by reading HTML** — the ELI5 section
is server-rendered static HTML while the standings/cards/heatmap/contributors
are JS-populated from the embedded DATA blob, so a change can look right in the
source and render wrong:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --screenshot=/tmp/site.png --window-size=1024,4600 \
  "file://$PWD/site/index.html"
```

**Presenting numbers to a non-technical audience** (learned 2026-07-17): "show
hard data" and "no visible math" are not in conflict. Step 1's table originally
exposed the weighted-goals / weighted-games arithmetic; that was right when the
ask was "hard data for a LinkedIn screenshot" and wrong once the audience was
specified as sports fans who don't do math. The resolution was to keep real
per-season stats (goals, games — numbers any fan reads fluently) and state the
blended result as a fact, dropping the visible formula. Hard data means real
stats, not exposed arithmetic.

## Adding new players — required steps

When the user says to add a new player (new signing, transfer update):

1. **Update `data/transfers_2026_27.txt`** with the new player in the correct team section.
2. **Check for existing stats** — query `player_rates` and `raw_goal_events`/`player_season_scoring` by last name to see if the player already has Liiga history in the DB.
3. **Check that history is actually CURRENT — do this for every player, not just brand-new ones.** "Has Liiga history" only means they've played in Liiga *at some point*; it is not proof their record is up to date. A player can have five Liiga seasons on file and still be missing last season because they spent it abroad before returning. Compare the player's most recent season on file against the most recently completed season (`config.yaml → ingestion.target_season - 1`). If it's older, that's a real gap — treat it exactly like a player with no Liiga history at all (go to step 4) for the missing season(s), even though older Liiga seasons stay in the DB. **Never skip this check just because the player already showed up in step 2.** Run `python scripts/check_roster_coverage.py` after any roster batch to catch this systematically (flags "STALE" players — have history, but nothing in the latest completed season).
4. **Fetch external stats for any gap** — whether the player has zero Liiga history or a stale/missing recent season, look up the missing seasons (aim for the last 5, regular season only: GP, G, A, league, club).
   **Working fetch method (confirmed 2026-08-04): EliteProspects.com via the `r.jina.ai` reader proxy** — `curl -s "https://r.jina.ai/https://www.eliteprospects.com/player/<id>/<slug>/print" -A "Mozilla/5.0"` (the `/print` path is more reliably server-rendered than the main profile, which sometimes snapshots mid-JS-load and returns "No Data Found"). This bypasses EliteProspects' normal Cloudflare/scraping block and returns the verbatim season-by-season markdown table — parse it directly with regex, don't trust an AI summarizer's numeric tables. hockeydb.com used to work the same way (direct curl, or via the same jina proxy) but started hard Cloudflare-challenging both plain curl *and* the jina proxy in Aug 2026 — try it, but don't burn time on it if it 403s. For Finnish Mestis players, `mestis.fi/fi/pelaajat/<player_id>/<slug>` (same `<player_id>` as our own Liiga player_id) is directly curlable, server-rendered, and a great independent cross-check against the EliteProspects table. Note any season gaps rather than guessing.
5. **Add to `data/external_players.csv`** — format: `player_id,name,birth_year,season,league,games,goals,assists,position` (player_id and birth_year can be blank — a blank player_id resolves to the existing Liiga player automatically by name, which is exactly what lets a returnee's abroad season merge with their old Liiga rows into a `blended` rate). Combine mid-season splits into one row per season (per league if they switched leagues). League names must match `data/league_factors.csv` exactly (e.g. `AHL`, `SHL`, `Allsvenskan`, `Switzerland`).
6. **Re-run the pipeline from step 5:**
   ```python
   from liiga.transfers import build_rosters_from_article
   from liiga.players import build_player_rates
   build_rosters_from_article()
   build_player_rates()
   ```
7. **Re-run standings + rebuild site:**
   ```bash
   python scripts/refresh_standings.py
   python scripts/build_site.py
   ```
8. **Verify:** `python scripts/check_roster_coverage.py` — confirm the players you just touched are no longer flagged STALE (or, if they legitimately didn't play a full season anywhere last year — injury, juniors — confirm that's genuinely the case rather than a missed lookup).

Players with prior Liiga history (e.g. returning from abroad) skip straight to step 3's coverage check instead of assuming they're covered — only skip step 4/5 (external stats) if that check confirms their most recent season is already in the DB.

## Design system (retro 2005 sm-liiga.fi theme, since 2026-07-17)

Replaced the old "dark rink" theme on user request, styled after the archived
early-2000s sm-liiga.fi site (https://web.archive.org/web/20051101093139/http://www.sm-liiga.fi/):
white body, navy header bar, steel-blue table heads, square corners, dense
small type. NOT a literal table-layout clone — modern flexbox/grid CSS
recreating the period color/type language, self-contained (no hotlinked
archive.org assets).

Palette in use (CSS var names kept stable from the old dark theme so most
rules didn't need touching — only the `:root` values changed):
- `#FFFFFF` background, `#F6F6F6`/`#EBEBEB` zebra rows (odd/even)
- `#001040` navy header bar + high-contrast text (`--texthi`), `#003464` accent stripe
- `#336699` primary accent (`--gold` var name, repurposed) — playoff cutoff line,
  heatmap ramp, Elo example, chip.on — steel-blue instead of the old gold
- `#758FA8` table header background (white text on it)
- `#1F7A3D` playoff green, `#CC5500` amber (quali zone 7–10), `#CC0000` red (crowd-higher)
- `#667788` slate, `#666666` label/secondary text, `#1A1A1A` body text

Typography: `Verdana, Arial, Helvetica` throughout (was Helvetica Neue), 12px
base (was 14px) for a denser retro feel. `font-variant-numeric: tabular-nums`
on all data columns. `border-radius: 0` everywhere except circular avatars/photos
(50%) — square corners are part of the period look. Zone colors always ship
with text/position encoding (rank numbers, ± signs, % labels) — never color alone.

ELI5 section (10 steps — age is its own step, separate from recency
weighting, per user request 2026-07-17) was rewritten short — each step is now a tight,
quotable blurb (bold claim + 1-2 sentences + a concrete stat), short enough to
double as a standalone LinkedIn post. Don't let it re-balloon back into long
narrative paragraphs; when adding a new example, cut something else to keep
each step's length roughly where it is.

**Single-team narrative (2026-07-17):** all 10 steps now follow ONE consistent
story — Pelicans, built outward from a single player (Mikko Kousa: scoring
rate → age curve → league conversion), then adding teammates (Aidan Dudas,
Gabriel Fortier) for team attack, Pelicans' own goalie (Patrik Bartosak) for
goaltending, and the same Pelicans-vs-Sport game for both the Elo and 40/60
blend examples. Do NOT mix in other teams/players (e.g. the old Tappara/
Blichfeld/Tim Juel examples) — every example must trace back to Pelicans.
Audience is explicitly "follows sports, not math" — step 1's table dropped
the recency/league weighted-math columns (Weighted G, Weighted GP) in favor
of a plain Season/Team/Goals/Games table with a stated one-line result; don't
reintroduce visible weighted-sum arithmetic there. Pelicans' rank/points/
crowd-rank appear via `__PELICANS_RANK_ORD__` etc. placeholders (render()),
not hardcoded numbers — hardcoding them silently goes stale on the next
`daily_update.py` run. `_ordinal()` in build_site.py handles the 1st/2nd/3rd/
11th-13th suffix correctly; reuse it for any new ordinal, never string-concat
a literal "th".
