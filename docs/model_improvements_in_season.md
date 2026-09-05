# In-season model improvements

Written 2026-08-30, two days before the season opens (first game 2026-09-01,
seven games that day). Ordered by when the data to act on actually exists —
not by how interesting the idea is.

The standing rule from AGENTS.md §10 applies throughout: **tune on log-loss
and points MAE, never on Spearman ρ.** ρ was already too noisy at n=4 seasons;
half a season is worse.

---

## Done — capture the evidence (2026-08-30)

`persist()` now writes **`prediction_games`**: one row per unplayed game per
daily run, with `p_home_reg`, `p_away_reg`, `p_overtime`, `p_home_ot_win`,
`p_home_win` and the `snapshot_date`.

This had a deadline. The per-game probability frame was computed in
`forecast()` and thrown away; only the season standings survived in
`prediction_history`. Once a game is played there is no way back to the
probabilities that were on offer for it, so every in-season measurement of
the model depends on this table existing beforehand.

To score a game, join the **last snapshot before puck drop**:

```sql
SELECT g.game_id, g.home_team, g.away_team, g.home_goals, g.away_goals,
       p.p_home_win, p.p_overtime
FROM stg_games g
JOIN prediction_games p ON p.game_id = g.game_id
WHERE g.ended
  AND p.snapshot_date = (SELECT MAX(snapshot_date) FROM prediction_games p2
                         WHERE p2.game_id = g.game_id
                           AND p2.snapshot_date < SUBSTR(g.start_ts, 1, 10))
```

Rows accumulate at (remaining games × days), so roughly 50k over a full
season. Small enough to leave alone.

---

## Backtestable now — the API had xG all along (2026-09-05)

The ranked list below was written believing the only new in-season signal
would be unvalidatable until spring. That was wrong. `expectedGoals`,
`powerplayInstances` and `shortHandedInstances` are present in **every one of
the 2 308 cached games from 2022–2026**, and were simply discarded at parse
time. They are now in `raw_games`, and `team_season` derives `pp_pct`,
`pk_pct` and `xg_share` from them.

That means these can go through the same leakage-free harness as every other
knob — `model.backtest()` and `backtest_standings()` on 2023–26, judged on
log-loss and points MAE, **never ρ** (AGENTS.md §10). In priority order:

1. **xG into team strength.** `team_strength.team_history_ratings` uses actual
   goals; xG is the lower-variance version of the same signal. Run both.
2. **xG margin into MOV-Elo.** `elo.py` scales by goal margin; xG margin is
   less noisy.
3. **Special teams into the Poisson.** `powerplayInstances` separates "scores
   on the power play" from "gets power plays" — the model sees only goals.
4. **Score effects** from `raw_periods` and `home_score_after`. Teams play
   differently when leading; this is part of what the Dixon-Coles correction
   currently absorbs as a flat constant.

Two that stay out of the model:

- **On-ice plus/minus** (`raw_on_ice`). 73% coverage historically, and 22% of
  even-strength goals repeat a jersey number, meaning a skater is missing.
  They are jersey numbers, not player ids, and there are no historical lineups
  to translate them. Collect it; do not model on it.
- **Per-game detail** (penalty windows, referees, player physicals). Current
  season only — the historical per-game responses were never stored, and
  fetching 2 841 of them is off the table. No history means no backtest.

There is no possession metric to be had: liiga.fi publishes no shots, no
Corsi, no faceoffs and no zone time. `xg_share` is chance quality, and should
be labelled as such rather than as possession.

## After ~15–20 games — measure, do not tune

**Score the model for real.** The backtest gave log-loss 0.672 against a
0.686 base rate. That edge is **0.014** — thin. The season is the first look
at whether it holds in 2026-27 rather than in 2023-26.

Look at the calibration curve as well as the aggregate: when the model says
60%, does the home team win 60% of the time? That catches a different fault
than accuracy does. A model can be well-ranked and badly calibrated.

**Thaw `team_strength`.** Probably the biggest modelling gain available, and
currently ruled out by design — `daily_update.py` says so explicitly:

> The player-model side (team_strength) deliberately stays a roster-based
> pre-season prior; current form enters through Elo and the banked points.

That was right pre-season, when nothing else existed. After 20 games a team's
actual scoring rate is direct evidence about whether the roster projection was
correct, and right now that evidence reaches the model only through Elo, which
does not separate offence from defence. Blend the roster prior toward observed
goals-for/against with a weight that grows with games played.

Look at `src/liiga/elo_od.py` (offence/defence Elo) first — some of this may
already exist there.

---

## After ~30 games — revisit the blend, carefully

**The 40/60 Poisson/Elo weight is fixed.** As the season progresses Elo gains
current-season signal while the Poisson side still rests on pre-season
rosters, so the optimal weight plausibly drifts toward Elo. Testable only
once `prediction_games` has accumulated.

**Use in-season data for diagnosis, not parameter search.** "Calibration is
off and in which direction" is a fair question to ask of half a season.
"Which weight minimises log-loss" is not — fit that when the season is
complete and the backtest window grows to five seasons.

**Validate the crowd decay.** It is `crowd_weight × (1 − frac_played)`:
linear, reasoned, never measured. After the season, check retrospectively
which decay curve would have minimised error. Cheap, and strictly a
post-season job.

---

## Two gaps new data will not close by itself

**Injuries and line-ups.** `player_rates` assumes the roster plays. A team
losing its top scorer for a month is invisible to the model until results
start saying so, and even then only through Elo. This is the clearest
weakness once real games exist.

**Goalie starts.** `team_goaltending` gives a team one save percentage. If
the backup plays half the games, the real figure is something else. The
season shows actual start distributions for the first time — see the
goalie-census caveat in the backtest notes.
