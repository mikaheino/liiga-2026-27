# IS Liigapörssi fantasy optimiser — side project

**This is a side project. It is not part of the standings-prediction pipeline.**

Nothing in `src/liiga/` or `scripts/` imports anything from this directory. The
dependency runs strictly one way: this tool *reads* the model's projections out
of `data/liiga.duckdb` (read-only) and never writes to the database, never
touches `data/*.csv`, and is not called by `daily_update.py`. Deleting this
folder would leave the main project completely unaffected.

Built 2026-08-18 for the Liigapörssi contest running **1.9.–3.10.2026**.

```bash
python fantasy/optimize.py                 # optimise for the fixture window
python fantasy/optimize.py --full-season   # optimise for a 60-game season
```

Roster: **1 goalie + 3 forwards + 2 defencemen**, budget **2,000,000 €**.

---

## What the scoring system rewards (and why it upends intuition)

Points are *not* proportional to how good a player is at hockey. Three things
dominate, in order:

**1. Goalies are worth ~3× a skater.** A starter banks ~11 points from saves
alone in every appearance before anything good happens, plus win (+4) /
shutout (+12). A goalie playing 50 games projects ~490 points — more than the
best forward in the league. Corollary: **a backup goalie is worthless**, no
matter how good he is. Games started is the single most important variable in
the whole optimisation.

**2. Defencemen out-earn forwards per unit of production.** Goals 9 vs 7,
assists 6 vs 4, plus-minus +3/−2 vs +2/−1, and blocked shots score. A
defenceman at 330 k€ can project like a 400 k€ forward.

**3. Games played in the scoring window.** See below — this is decisive for a
short contest and irrelevant for a full season.

Other levers: the **captain gets 1.3×** (worth ~150 pts over a season — put it
on your highest projected scorer, usually the goalie in season-long play), and
negative games are amplified because the rounding rule rounds *away* from zero
(−7 × 1.3 = −9.1 → −10). Goalies almost never post negative games, which is a
further argument for captaining one.

## Fixture window 1.9.–3.10.2026 — 83 games, wildly uneven

| Games | Teams |
|---|---|
| 11 | Jukurit, K-Espoo, **Jokerit** |
| 10 | HPK, KooKoo, TPS, Sport, SaiPa, Lukko, Ässät, Kärpät |
| 9 | Ilves, Tappara, KalPa, Pelicans, HIFK |
| 8 | **JYP** — and *zero* home games in the window |

A Jokerit player gets **37 % more games** than a JYP player. Over five weeks
that swamps most talent differences, which is why the window-optimal team looks
nothing like the season-optimal one:

- **Season-long:** Patrik Bartosak is the best goalie (53 starts last season,
  .910) — but Pelicans only play 9 games in the window.
- **Window:** Petteri Rimpinen wins instead — K-Espoo play 11, so he gets the
  same ~7.5 starts for 25 k€ less.

## Recommended teams for the window

**Even spread (~406 FP)** — balanced prices, 290–390 k€, no stars-and-scrubs:

| Slot | Player | Club | Price |
|---|---|---|---|
| G | Petteri Rimpinen | K-Espoo | 340 000 |
| F | Patrick Curry ⓒ | Jokerit | 390 000 |
| F | George Diaco | Sport | 325 000 |
| F | Arttu Tuomaala | K-Espoo | 290 000 |
| D | Matt Caito | Jokerit | 360 000 |
| D | Oliver Larsen | Jokerit | 290 000 |

**Even spread + max 2 per club (~402 FP)** — swap Diaco→Kantner and
Caito→Åkerström. Costs 4 points, spreads club risk across four teams, and
replaces an unproven import with Kantner's 46/54/52-point seasons. Probably the
better real-world pick for a five-week sprint with no time to recover from a
bust.

Captain **Curry** in both (highest projected total in the window).

## Assumptions and known weaknesses

- **Goals and assists** come from the standings model (`player_rates`), which
  is recency-weighted, age-adjusted and league-converted. That part is real.
- **Everything else is estimated at position level**: shots, blocked shots,
  plus-minus, stars, penalties. These shift the level more than the ranking,
  but they do influence how the budget splits between forwards and defencemen.
  Treat the absolute point totals as indicative, the ordering as meaningful.
- **`STARTER_SHARE` in `optimize.py` is hand-maintained judgement**, derived
  from each goalie's recent games played plus depth-chart reading. It is the
  highest-leverage guess in the whole model — a wrong call here (a tandem that
  turns into a 50/50 split) costs more than any skater pick. Revisit it once
  the season starts and real starts are observable.
- Players with no Liiga history are projected from foreign-league conversions
  and carry real bust risk; the script falls back to a 20th-percentile
  positional rate for anyone it cannot match at all.
- **Optimiser correctness:** the headline lineup uses an exact dynamic program
  over the *entire* player pool. The constrained variants (price band, club
  cap) use a shortlist of the top N by projected points — fast, but a top-N
  shortlist can in principle miss a cheap "punt" pick that the exact solver
  finds. This bit me during development: an earlier shortlist-only run reported
  a lineup ~140 points below the true optimum.

## Files

| File | What it is |
|---|---|
| `optimize.py` | The whole thing: scoring, projections, exact + constrained solvers |
| `data/player_prices.csv` | Liigapörssi player list — `Name,Position,Price` |
| `data/fixtures_window.txt` | `date\|Home,Away\|Home,Away\|…`, one line per game day |

To rerun for a different contest window, replace `fixtures_window.txt` and
refresh `player_prices.csv`.
