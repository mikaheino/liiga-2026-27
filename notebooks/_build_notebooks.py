"""Generate the 01-06 walkthrough notebooks.

Kept in the repo so the notebooks can be regenerated after code changes:
    python notebooks/_build_notebooks.py
"""
from pathlib import Path

import nbformat as nbf
from nbformat.v4 import new_code_cell, new_markdown_cell, new_notebook

HERE = Path(__file__).resolve().parent

# Every notebook starts by making the src package importable and chdir-ing to root.
BOOTSTRAP = (
    "import sys, os\n"
    "from pathlib import Path\n"
    "ROOT = Path.cwd().parent if Path.cwd().name == 'notebooks' else Path.cwd()\n"
    "sys.path.insert(0, str(ROOT / 'src'))\n"
    "os.chdir(ROOT)\n"
    "import pandas as pd\n"
    "pd.set_option('display.float_format', lambda x: f'{x:.3f}')"
)


def nb(*cells):
    n = new_notebook()
    n.cells = list(cells)
    n.metadata = {"kernelspec": {"name": "python3", "display_name": "Python 3",
                                 "language": "python"}}
    return n


def md(text):
    return new_markdown_cell(text.strip())


def code(text):
    return new_code_cell(text.strip())


NOTEBOOKS = {
    "01_ingest.ipynb": nb(
        md("""
# 01 · Ingest Liiga data

We download six seasons of games from the **public liiga.fi v2 API**
(`/api/v2/games`) — five to learn from (2021-22 … 2025-26) and the **2026-27**
schedule we want to predict. liiga.fi numbers seasons by their end year, so
`season=2027` is 2026-27.

Each game carries goal events (scorer + assist player IDs), which is how we
later measure player production. We also harvest player bios (date of birth,
position) from one game per team, for the age curve and positional priors.
"""),
        code(BOOTSTRAP),
        code("""
from liiga.ingest import ingest_all, harvest_bios
counts = ingest_all()           # cached on disk after the first run
counts
"""),
        code("""
print('player bios captured:', harvest_bios())
"""),
        code("""
from liiga.db import get_connection, query_df
con = get_connection()
display(query_df(con, '''SELECT season, COUNT(*) games,
                                SUM(ended::INT) played
                         FROM raw_games GROUP BY season ORDER BY season'''))
con.close()
"""),
        md("""
**Check:** the 2027 row should show games scheduled but `played = 0` — that is
the season we forecast. Training seasons should each have ~450-480 played games.
"""),
    ),
    "02_explore.ipynb": nb(
        md("""
# 02 · Build clean tables & explore

We run the SQL transforms (portable across DuckDB and Snowflake) to create
`stg_games`, `team_game_log`, `team_season`, and `player_season_scoring`, then
sanity-check the data: top scorers and the spread of team scoring.
"""),
        code(BOOTSTRAP),
        code("""
from liiga.transform import run_transforms
run_transforms()
"""),
        code("""
from liiga.db import get_connection, query_df
con = get_connection()
print('Top goal scorers, 2025-26:')
display(query_df(con, '''
  SELECT first_name, last_name, team, goals, assists
  FROM player_season_scoring WHERE season=2026
  ORDER BY goals DESC LIMIT 10'''))
"""),
        code("""
import matplotlib.pyplot as plt
gf = query_df(con, '''SELECT team, gf_per_game FROM team_season
                      WHERE season=2026 ORDER BY gf_per_game DESC''')
con.close()
ax = gf.plot.bar(x='team', y='gf_per_game', legend=False, figsize=(10,4),
                 title='Goals for per game by team (2025-26)')
ax.set_ylabel('goals / game'); plt.tight_layout(); plt.show()
"""),
        md("Team scoring ranges roughly 1.8–3.8 goals/game — keep this spread in "
           "mind; our projected team strengths should land in a similar range."),
    ),
    "03_player_rates.ipynb": nb(
        md("""
# 03 · Player production rates

The core idea: rate every player by **goals per team-game**, projected to
2026-27 with recency weighting, regression-to-positional-mean (steadies small
samples) and a light age curve. Players new to Liiga (Jokerit/Mestis, imports)
come from `data/external_players.csv` translated via `data/league_factors.csv`;
anyone still unknown gets a replacement-level prior.

All the dials live in `config.yaml` under `players:`.
"""),
        code(BOOTSTRAP),
        code("""
from liiga.rosters import build_rosters
from liiga.players import build_player_rates
build_rosters()                 # official 2026-27 squads + your CSV overrides
rates = build_player_rates()
rates['rate_source'].value_counts()
"""),
        code("""
print('Top 12 projected goal scorers for 2026-27:')
display(rates.sort_values('projected_goals_per_game', ascending=False)
            [['name','team','position_group','projected_goals_per_game','rate_source']].head(12))
"""),
        code("""
print('Jokerit (newly promoted) — projected scoring core:')
jk = rates[rates.team=='Jokerit'].sort_values('projected_goals_per_game', ascending=False)
display(jk[['name','position_group','projected_goals_per_game','rate_source']].head(12))
"""),
        md("""
Notice many Jokerit players already carry **Liiga** history (they signed
established scorers), so they are rated on real production rather than guesses.
To fix a transfer or add a signing, edit `data/rosters_2026_27.csv` and re-run.
"""),
    ),
    "04_team_strength.ipynb": nb(
        md("""
# 04 · Team strength

We aggregate each roster's player rates into a team **offensive rating**
(centred on 1.0). Team history contributes defense and a little offense, mixed
in by `team_strength.team_weight` — **the main knob to tune.** New teams with no
history (Jokerit) are judged purely on their players.
"""),
        code(BOOTSTRAP),
        code("""
from liiga.team_strength import build_team_strength
ts = build_team_strength().sort_values('off_rating', ascending=False)
display(ts)
"""),
        code("""
import matplotlib.pyplot as plt
ax = ts.plot.bar(x='team', y='off_rating', legend=False, figsize=(10,4),
                 title='Projected offensive rating (1.0 = league average)')
ax.axhline(1.0, color='k', lw=0.8, ls='--'); plt.tight_layout(); plt.show()
"""),
        md("""
Want team history to matter more (e.g. you trust last season's results over the
projected rosters)? Raise `team_strength.team_weight` in `config.yaml` toward
1.0 and re-run this notebook.
"""),
    ),
    "05_model_backtest.ipynb": nb(
        md("""
# 05 · Match model & backtest

The match model turns two teams' ratings into goal expectations and, via a
**Poisson** model, into win / overtime / loss probabilities. Before trusting it
on 2026-27 we **backtest**: for each past season we rebuild ratings from only
earlier data (no leakage) and score predictions against what actually happened.

We report three numbers per season:
- **accuracy** — share of games where the favourite won (beat ~0.55 home-win base
  rate);
- **log-loss** and **Brier** — reward well-calibrated probabilities (lower is
  better). The baseline always predicts the league's average home-win rate.
"""),
        code(BOOTSTRAP),
        code("""
from liiga.model import backtest
bt = backtest()
display(bt)
"""),
        code("""
print('Seasons where the model beats the base-rate baseline on log-loss:')
display(bt.assign(beats_baseline=bt.model_logloss < bt.baseline_logloss)
          [['season','model_acc','model_logloss','baseline_logloss','beats_baseline']])
"""),
        md("""
A modest but real edge over the naive baseline. To improve it, tune the knobs in
`config.yaml` (`home_ice`, `team_weight`, `recency_decay`, `regression_strength`)
or add features later (rest days, head-to-head, goalie quality).
"""),
    ),
    "06_simulate_standings.ipynb": nb(
        md("""
# 06 · Simulate the 2026-27 standings

Finally we play the whole 2026-27 schedule **10,000 times**, sampling each game
from its probabilities and awarding Liiga points (regulation win 3, OT win 2, OT
loss 1, regulation loss 0). The result is a *distribution* of final tables.
"""),
        code(BOOTSTRAP),
        code("""
from liiga.simulate import simulate
res = simulate()
standings = res['standings']
display(standings)
"""),
        code("""
import matplotlib.pyplot as plt
s = standings.iloc[::-1]   # best at top
err = [s.mean_points - s.p05_points, s.p95_points - s.mean_points]
plt.figure(figsize=(9,6))
plt.barh(s.team, s.mean_points, xerr=err, color='#3b7dd8')
plt.xlabel('points'); plt.title('Projected 2026-27 points (bar=mean, whiskers=5–95%)')
plt.tight_layout(); plt.show()
"""),
        code("""
# Position distribution heatmap — how likely is each team to finish in each spot?
import matplotlib.pyplot as plt
pos = res['position_distribution'].loc[standings['team']]
fig, ax = plt.subplots(figsize=(11,6))
im = ax.imshow(pos.values, aspect='auto', cmap='viridis')
ax.set_xticks(range(pos.shape[1])); ax.set_xticklabels(pos.columns)
ax.set_yticks(range(len(pos))); ax.set_yticklabels(pos.index)
ax.set_xlabel('final position'); ax.set_title('P(team finishes in position)')
fig.colorbar(im, label='probability'); plt.tight_layout(); plt.show()
"""),
        code("""
print('Title and playoff odds:')
display(standings[['proj_rank','team','mean_points','p_title','p_top_playoff']])
print('\\nJokerit (newly promoted):')
display(standings[standings.team=='Jokerit'])
"""),
        md("""
## Tuning the forecast

Everything is driven by `config.yaml` and the editable CSVs in `data/`:

- **Rosters wrong?** Edit `data/rosters_2026_27.csv` → re-run **03 → 04 → 06**.
- **Trust team history more?** Raise `team_strength.team_weight` → re-run 04 → 06.
- **Home ice / OT lean / recency / regression** → edit `config.yaml` → re-run.

Switch `database.target` to `snowflake` to run the exact same pipeline in
production.
"""),
    ),
}


def main():
    for name, notebook in NOTEBOOKS.items():
        path = HERE / name
        with open(path, "w", encoding="utf-8") as fh:
            nbf.write(notebook, fh)
        print("wrote", path.relative_to(HERE.parent))


if __name__ == "__main__":
    main()
