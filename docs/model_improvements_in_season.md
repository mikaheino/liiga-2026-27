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
