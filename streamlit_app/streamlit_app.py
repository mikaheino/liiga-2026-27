"""Liiga 2026-27 -ennuste: sijoitusjakauma ja ennusteen liike.

Sama tiedosto ajetaan kahdessa paikassa:

  * paikallisesti  -> lukee data/liiga.duckdb (dev)
  * Snowflakessa   -> lukee LIIGA.MODEL (prod), Snowpark-sessiolla

Siksi tässä ei importata `liiga`-pakettia: Streamlit in Snowflake saa vain
tämän tiedoston ja environment.yml:n, joten kaiken on oltava omavaraista.

    streamlit run streamlit_app/streamlit_app.py     # paikallisesti
    snow streamlit deploy --replace                  # Snowflakeen

Taulukot päivittyvät jokaisen ennustusajon jälkeen ilman erillistä toimintoa:
välimuistin avain on prediction_metan `updated_at`, joten uusi ennuste
mitätöi välimuistin ja vanha jää voimaan vain jos mikään ei ole muuttunut.
"""
from __future__ import annotations

import datetime as dt
from pathlib import Path

import altair as alt
import pandas as pd
import streamlit as st

TEAMS = 17
PLAYOFF_CUT = 6          # 1-6 suoraan playoffeihin
QUALI_CUT = 10           # 7-10 karsintoihin
# 15.-17. putoaa B-sarjaan. Lasketaan joukkuemäärästä eikä kirjoiteta
# 14:ää: sarjan koko on muuttunut ennenkin, putoajien määrä on se sääntö.
RELEGATION = 3           # montako viimeistä putoaa
RELEGATION_CUT = TEAMS - RELEGATION   # tämän jälkeen tulevat putoavat
# Paletti on poimittu Liigan logosta pikseleistä, ei silmämääräisesti:
# kirkkain korostus #EBCA68, kulta #CCA752, keskikulta #69521E, ruskea
# #36270D, varjo #2A1904. Tausta on musta, joten kaikki sävyt on valittu
# toimimaan mustaa vasten eikä valkoista.
ACCENT = (204, 167, 82)  # #CCA752, logon kulta
ACCENT_LIGHT = "#4a3a18"  # tumma kulta: palkin simuloitu osa mustalla
N_SIMS = "10 000"        # pidä synkassa config.yaml -> simulation.n_simulations
HIT = "#EBCA68"          # malli osui
MISS = "#E0574B"         # malli meni pieleen
CONTEXT = "#3a3226"      # taustaviivat pienissä kuvissa

st.set_page_config(page_title="Liiga 2026-27 -ennuste",
                   page_icon="🏒", layout="wide")


# --------------------------------------------------------------------------
# Datalähde: Snowflake jos ajetaan siellä, muuten paikallinen DuckDB
# --------------------------------------------------------------------------
def _snowpark_session():
    """Aktiivinen Snowpark-sessio, tai None jos ei ajeta Snowflakessa."""
    try:
        from snowflake.snowpark.context import get_active_session
        return get_active_session()
    except Exception:
        return None


def _duckdb_path() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "liiga.duckdb"


def backend() -> str:
    return "snowflake" if _snowpark_session() is not None else "duckdb"


def read_sql(table: str) -> pd.DataFrame:
    """Lue yksi taulu kummasta tahansa backendistä, sarakkeet pienellä.

    Snowflake palauttaa sarakenimet isolla ja DuckDB sellaisenaan; tämä on
    sama normalisointi kuin liiga.db.query_df tekee, jotta muu koodi ei
    joudu tietämään kummassa ollaan.
    """
    session = _snowpark_session()
    if session is not None:
        df = session.table(f"LIIGA.MODEL.{table.upper()}").to_pandas()
    else:
        import duckdb
        con = duckdb.connect(str(_duckdb_path()), read_only=True)
        try:
            df = con.execute(f'SELECT * FROM "{table}"').df()
        finally:
            con.close()
    df.columns = [c.lower() for c in df.columns]
    return df


def run_query(sql: str) -> pd.DataFrame:
    """Run one SQL statement on whichever backend we are on."""
    session = _snowpark_session()
    if session is not None:
        df = session.sql(sql).to_pandas()
    else:
        import duckdb
        con = duckdb.connect(str(_duckdb_path()), read_only=True)
        try:
            df = con.execute(sql).df()
        finally:
            con.close()
    df.columns = [c.lower() for c in df.columns]
    return df


def _qualify(table: str) -> str:
    """Table reference for the current backend.

    In Snowflake the app runs in LIIGA.CODE (that is where the Streamlit
    object lives), so an unqualified name does not resolve to the tables in
    LIIGA.MODEL. Everything else here reads through session.table() with the
    full path; hand-written SQL has to do the same.
    """
    return f"LIIGA.MODEL.{table.upper()}" if backend() == "snowflake" else table


MONTHS_FI = ["tammikuu", "helmikuu", "maaliskuu", "huhtikuu", "toukokuu",
             "kesäkuu", "heinäkuu", "elokuu", "syyskuu", "lokakuu",
             "marraskuu", "joulukuu"]


def fixtures_sql() -> str:
    """Every game of the target season with the last prediction made before it.

    LEFT JOIN, because a game played before prediction_games existed has no
    row to match -- it should still be listed, just without a forecast.

    The snapshot is the newest one dated on or before the game's own day.
    For a future game that is simply today's run; for a played game it is
    what the model said going in, which is the only version worth scoring.
    Same-day is allowed because the pipeline runs in the morning and games
    start in the afternoon.
    """
    games, sched = _qualify("prediction_games"), _qualify("stg_games")
    return f"""
        SELECT g.start_ts, g.home_team, g.away_team, g.ended,
               g.home_goals, g.away_goals, g.result_category,
               p.p_home_win, p.p_overtime
        FROM {sched} g
        LEFT JOIN {games} p ON p.game_id = g.game_id
             AND p.snapshot_date = (
                 SELECT MAX(p2.snapshot_date) FROM {games} p2
                 WHERE p2.game_id = g.game_id
                   AND p2.snapshot_date <= SUBSTR(g.start_ts, 1, 10))
        WHERE g.season = (SELECT MAX(season) FROM {sched})
        -- Several games share a kickoff time, so start_ts alone would leave
        -- the order to chance and the list would reshuffle between runs.
        ORDER BY g.start_ts, g.home_team
    """


def banked_sql() -> str:
    """Points already earned per team, and how many games produced them."""
    log = _qualify("team_game_log")
    return f"""
        SELECT team, SUM(points) AS banked, COUNT(*) AS played
        FROM {log}
        WHERE season = (SELECT MAX(season) FROM {log})
        GROUP BY team
    """


def team_log_sql() -> str:
    """Every played game of the target season, one row per team per game.

    This is the whole input to the form table: Liiga's 3/2/1/0 points make
    win, overtime win, overtime loss and loss recoverable from `points`
    alone, and the rest of the columns feed the goals and special-teams tabs.
    """
    log = _qualify("team_game_log")
    return f"""
        SELECT team, opponent, is_home, start_ts, goals_for, goals_against,
               points, result_category, xg_for, xg_against,
               pp_goals, pp_instances, sh_instances, pp_goals_against
        FROM {log}
        WHERE season = (SELECT MAX(season) FROM {log})
        ORDER BY team, start_ts
    """


def load_updated_at() -> str:
    """Ennusteen aikaleima. Tätä EI kacheta -- se on välimuistin avain."""
    meta = read_sql("prediction_meta")
    if meta.empty:
        return ""
    return str(meta.iloc[0]["updated_at"])


@st.cache_data(show_spinner=False)
def load_data(updated_at: str) -> dict[str, pd.DataFrame]:
    """Kaikki näytettävä data. Avaimena aikaleima: uusi ennuste -> uusi haku."""
    # Only games still unplayed exist here, so no season filter is needed:
    # every past season is fully ended.
    try:
        banked = run_query(banked_sql())
    except Exception:                     # noqa: BLE001 -- nothing played yet
        banked = pd.DataFrame(columns=["team", "banked", "played"])
    try:
        upcoming, upcoming_error = run_query(fixtures_sql()), ""
    except Exception as exc:              # noqa: BLE001 -- degrade, but say so
        upcoming = pd.DataFrame(columns=[
            "start_ts", "home_team", "away_team", "ended", "home_goals",
            "away_goals", "result_category", "p_home_win", "p_overtime"])
        upcoming_error = str(exc).strip().splitlines()[0][:200]
    try:
        team_log = run_query(team_log_sql())
    except Exception:                     # noqa: BLE001 -- nothing played yet
        team_log = pd.DataFrame(columns=[
            "team", "opponent", "is_home", "start_ts", "goals_for",
            "goals_against", "points", "result_category", "xg_for",
            "xg_against", "pp_goals", "pp_instances", "sh_instances",
            "pp_goals_against"])
    return {
        "team_log": team_log,
        "standings": read_sql("standings_2026_27"),
        "position": read_sql("position_distribution_2026_27"),
        "history": read_sql("prediction_history"),
        "meta": read_sql("prediction_meta"),
        "upcoming": upcoming,
        "upcoming_error": upcoming_error,
        "banked": banked,
    }


def _supported(render, kwargs: dict) -> dict:
    """Drop keyword arguments this Streamlit build does not accept.

    Streamlit in Snowflake runs an older build than a local install -- old
    enough that `st.column_config` does not exist at all, so sibling
    arguments of the same vintage (`hide_index`) cannot be assumed either.
    Filtering against the real signature beats guessing from a version
    number, and beats letting the app die on an unknown keyword.
    """
    import inspect
    try:
        params = inspect.signature(render).parameters
    except (TypeError, ValueError):
        return kwargs
    if any(p.kind == p.VAR_KEYWORD for p in params.values()):
        return kwargs
    return {k: v for k, v in kwargs.items() if k in params}


def full_width(render, *args, **kwargs):
    """Piirrä elementti täyteen leveyteen Streamlitin versiosta riippumatta.

    Streamlit 1.49+ haluaa width="stretch"; Streamlit in Snowflake ajaa
    vanhempaa versiota, jossa width on int ja täysi leveys on
    use_container_width=True. Sama tiedosto ajetaan molemmissa, joten
    kokeillaan uutta API:a ensin ja pudotaan vanhaan -- versionumeron
    vertailu arvaisi, tämä mittaa.
    """
    kwargs = _supported(render, kwargs)
    try:
        return render(*args, width="stretch", **kwargs)
    except (TypeError, ValueError, st.errors.StreamlitAPIException):
        return render(*args, use_container_width=True, **kwargs)


def dark(chart):
    """Paint an Altair chart for the black page.

    Altair renders on white by default, which on this background reads as a
    hole punched in the page rather than as a chart. Every part has to be
    named -- axis lines, ticks, grid, labels, legend, facet headers -- because
    each falls back to its own light default independently.
    """
    return (chart
            .configure(background="#000000")
            .configure_view(strokeWidth=0, fill="#000000")
            .configure_axis(domainColor=GRID, tickColor=GRID, gridColor=GRID,
                            labelColor=MUTED, titleColor=MUTED,
                            labelFontSize=11, titleFontSize=11)
            .configure_legend(labelColor="#D8D0BF", titleColor=MUTED,
                              symbolStrokeWidth=3)
            .configure_header(labelColor="#D8D0BF"))


# --------------------------------------------------------------------------
# Sijoitusjakauma
# --------------------------------------------------------------------------
def position_matrix(position: pd.DataFrame,
                    standings: pd.DataFrame) -> pd.DataFrame:
    """Joukkueet ennustetussa järjestyksessä, sarakkeina sijat 1..17."""
    cols = [f"rank_{i}" for i in range(1, TEAMS + 1)]
    order = standings.sort_values("proj_rank")["team"].tolist()
    m = (position.set_index("team")
                 .reindex(order)[cols]
                 .astype(float))
    m.columns = list(range(1, TEAMS + 1))
    m.index.name = "Joukkue"
    return m


def rank_stdev(m: pd.DataFrame) -> pd.Series:
    """Sijoituksen keskihajonta per joukkue -- villit kortit vs. varmat."""
    ranks = pd.Series(m.columns, dtype=float)
    mean = m.mul(ranks.values, axis=1).sum(axis=1)
    var = m.mul((ranks.values ** 2), axis=1).sum(axis=1) - mean ** 2
    return var.clip(lower=0) ** 0.5


SURFACE = (13, 11, 7)    # --lp-gray-25, rivin pohja jota vasten solu sekoitetaan


def _cell_style(p: float) -> str:
    """Solun väri. Sama potenssiramppi kuin sivustolla (build_site.py).

    Suora lineaarinen alpha hukuttaisi tasaiset keskikastin rivit, joiden
    huippu on ~9 %, samalla kun kärjen 43 % veisi kaiken kontrastin.

    Kaksi asiaa on pakko tehdä näin, eikä ilmeisemmällä tavalla:

    * **`background`, ei `background-color`.** Streamlitin HTML-sanitointi
      pudottaa `background-color`:n inline-tyylistä ja jättää `color`:n --
      todennettu DOM:ista, jossa 289 solusta jäi jäljelle pelkkä tekstiväri.
      Kirkkaimmat solut muuttuivat siis mustaksi tekstiksi mustalla.
    * **Valmiiksi laskettu heksa, ei alpha.** Sekoitus rivin pohjaa vasten
      tehdään tässä, jolloin solu ei ole riippuvainen siitä mitä sen takana
      sattuu olemaan.
    """
    if pd.isna(p) or p < 0.002:
        return "color:#4a443a"
    alpha = min(0.92, (p / 0.35) ** 0.6 * 0.92)
    mix = tuple(round(a * alpha + b * (1 - alpha))
                for a, b in zip(ACCENT, SURFACE))
    # Mustalla pohjalla musteet menevät päinvastoin kuin valkoisella: mitä
    # kirkkaampi kultatäyttö, sitä tummempi teksti sen päälle.
    ink = "#140f06" if alpha > 0.45 else ("#F2EDE2" if p >= 0.08 else MUTED)
    return f"background:#{mix[0]:02x}{mix[1]:02x}{mix[2]:02x}; color:{ink}"


def _cell_label(p: float) -> str:
    """Prosenttiluku. Alle 1 % näytetään '<1', alle 0,05 % jätetään tyhjäksi."""
    if pd.isna(p) or p < 0.0005:
        return ""
    if p < 0.005:
        return "<1"
    return f"{round(p * 100):.0f}"


def render_position_table(m: pd.DataFrame, highlight: set[str]) -> None:
    """Probability of every finishing place, one row per team.

    Hand-built rather than a Styler for the same reason as the form table:
    the sidebar highlight has to reach it, and a Styler cannot fade a row.
    """
    cols = ["110px"] + ["minmax(0,1fr)"] * TEAMS
    template = " ".join(cols)
    borders = {PLAYOFF_CUT + 1: f"2px solid {BRAND_DARK}",
               QUALI_CUT + 1: f"1px dashed {GOLD_MID}",
               RELEGATION_CUT + 1: f"2px solid {DANGER}"}

    head = ['<div class="lp-hteam">Joukkue</div>']
    for rank in range(1, TEAMS + 1):
        edge = f";border-left:{borders[rank]}" if rank in borders else ""
        head.append(f'<div style="text-align:center{edge}">{rank}</div>')

    body = []
    for team, row in m.iterrows():
        cells = [f'<div class="lp-hteam">{_esc(team)}</div>']
        for rank in range(1, TEAMS + 1):
            p = row[rank]
            edge = f";border-left:{borders[rank]}" if rank in borders else ""
            cells.append(f'<div style="{_cell_style(p)}{edge}">'
                         f'{_cell_label(p)}</div>')
        body.append(
            f'<div class="lp-row lp-heat {dim_class(team, highlight)}" '
            f'style="grid-template-columns:{template}">{"".join(cells)}</div>')

    html(f'<div class="lp-tbl">'
         f'<div class="lp-row lp-head lp-heat" '
         f'style="grid-template-columns:{template}">{"".join(head)}</div>'
         f'{"".join(body)}</div>')


# --------------------------------------------------------------------------
# Ennusteen liike
# --------------------------------------------------------------------------
def render_history(history: pd.DataFrame, order: list[str],
                   highlight: set[str]) -> None:
    """Small multiples, not seventeen lines in one frame.

    One panel per team is the standard fix for a spaghetti chart: with all
    seventeen in a single set of axes the lines cross constantly and no colour
    legend can separate them. Each panel repeats every team's line in grey as
    context, so a team is read against the field rather than against nothing.

    The context layer carries its own copy of the data with the team column
    renamed, so faceting -- which filters on `team` -- leaves it whole.
    """
    if history.empty:
        return
    h = history.copy()
    h["snapshot_date"] = pd.to_datetime(h["snapshot_date"])
    h["mean_points"] = h["mean_points"].astype(float)

    # One row per (team, panel): every panel carries the whole field, and the
    # focus layer picks its own team out of it. Altair needs a single
    # top-level dataset to facet a layered chart, so the context cannot just
    # be a second frame.
    panels = ([t for t in order if t in highlight] + [t for t in order
                                                     if t not in highlight]
              if highlight else order)
    big = h.merge(pd.DataFrame({"panel": panels}), how="cross")
    # Colour by the panel, not by the line, so a highlighted team's own panel
    # stays gold while the rest of the grid recedes.
    big["vari"] = big["panel"].map(
        lambda t: f"rgb{ACCENT}" if (not highlight or t in highlight)
        else "#b6bfbb")

    x = alt.X("snapshot_date:T", title=None,
              axis=alt.Axis(format="%-d.%-m.", grid=False, tickCount=3))
    # Lyhyt otsikko: pitkä syö leveyttä jokaiselta riviltä, ja yksikkö
    # selviää muutenkin osion kuvauksesta.
    y = alt.Y("mean_points:Q", title="Pisteet",
              scale=alt.Scale(zero=False, nice=True))

    context = (alt.Chart()
               .mark_line(strokeWidth=1, color=CONTEXT, interpolate="monotone")
               .encode(x=x, y=y, detail="team:N"))
    focus = (alt.Chart()
             .mark_line(strokeWidth=2, interpolate="monotone")
             .transform_filter("datum.team === datum.panel")
             .encode(x=x, y=y,
                     color=alt.Color("vari:N", scale=None, legend=None),
                     tooltip=[alt.Tooltip("team:N", title="Joukkue"),
                              alt.Tooltip("snapshot_date:T", title="Päivä",
                                          format="%-d.%-m.%Y"),
                              alt.Tooltip("mean_points:Q", title="Pisteet",
                                          format=".1f"),
                              alt.Tooltip("games_played:Q",
                                          title="Otteluita")]))

    # Paneelin leveys on kiinteä, koska Altairin facet ei osaa
    # width="container":ia. 5 x 170 px plus akseli ja välit mahtuu siihen
    # ~1040 px:iin jonka Streamlit antaa; 230 px levitti sivua 130 px yli.
    chart = (alt.layer(context, focus, data=big)
             .properties(width=170, height=105)
             .facet(facet=alt.Facet("panel:N", title=None, sort=panels,
                                    header=alt.Header(labelFontSize=11,
                                                      labelFontWeight="bold")),
                    columns=5, spacing=8))
    full_width(st.altair_chart, dark(chart))


def _result_text(r) -> str:
    """Final score, with the Finnish suffix for how it was decided."""
    if not bool(r["ended"]) or pd.isna(r["home_goals"]):
        return ""
    suffix = {"overtime": " ja", "shootout": " vl"}.get(
        str(r["result_category"]), "")
    return f"{int(r['home_goals'])}–{int(r['away_goals'])}{suffix}"


def _model_said(r) -> float:
    """Probability the model gave to the side that actually won.

    This is the honest score for a single game: being "wrong" on a 55/45 is
    not a failure, giving 20% to the winner is. Blank until the game is
    played, and blank if no forecast was captured before it.
    """
    if not bool(r["ended"]) or pd.isna(r["p_home_win"]) or pd.isna(r["home_goals"]):
        return float("nan")
    p = float(r["p_home_win"]) * 100
    return p if r["home_goals"] > r["away_goals"] else 100 - p


def render_fixtures(games: pd.DataFrame, highlight: set[str]) -> None:
    """Fixtures with probability bars, and the outcome once played.

    The tick/cross carries the hit or miss on its own -- colour alone would
    fail anyone who cannot separate the gold from the red.
    """
    rows, classes = [], []
    for _, g in games.iterrows():
        p_home = (float(g["p_home_win"]) * 100
                  if pd.notna(g["p_home_win"]) else float("nan"))
        said = _model_said(g)
        if pd.isna(said):
            verdict = ""
        else:
            hit = said >= 50
            tint = ("rgba(235,202,104,0.16)" if hit
                    else "rgba(224,87,75,0.16)")
            verdict = (f'<span class="lp-tag" style="background:{tint};'
                       f'color:{HIT if hit else MISS}">'
                       f'{"✓" if hit else "✗"} {said:.0f} %</span>')
        rows.append([
            pd.to_datetime(g["start_ts"]).strftime("%-d.%-m."),
            f'<span class="lp-team">{_esc(g["home_team"])} – '
            f'{_esc(g["away_team"])}</span>',
            _prob_bar(p_home), _prob_bar(100 - p_home if p_home == p_home
                                         else float("nan")),
            "–" if pd.isna(g["p_overtime"])
            else f'{float(g["p_overtime"]) * 100:.0f} %',
            _result_text(g),
            verdict,
        ])
        involved = {g["home_team"], g["away_team"]}
        classes.append("" if not highlight
                       else ("lp-on" if involved & highlight else "lp-off"))

    cols = [("Päivä", "70px", "lp-num lp-dim"),
            ("Ottelu", "minmax(0,1fr)", ""),
            ("Koti voittaa", "132px", ""), ("Vieras voittaa", "132px", ""),
            ("Jatkoaika", "100px", "lp-num lp-dim"),
            ("Tulos", "92px", "lp-num"),
            ("Malli antoi voittajalle", "196px", "lp-num")]
    render_grid(cols, rows, classes)


def _prob_bar(pct: float) -> str:
    """A probability as a bar with the number inside it.

    Pinned to 0-100 rather than to the column's own range, so the bars are
    comparable between rows instead of only within one.
    """
    if pct != pct:                       # NaN: no forecast was captured
        return '<span class="lp-num lp-dim">–</span>'
    return (f'<div class="lp-bar"><i style="background:{ACCENT_LIGHT};'
            f'width:{pct:.1f}%"></i><span>{pct:.0f} %</span></div>')


def render_title_race(standings: pd.DataFrame, banked: pd.DataFrame,
                      highlight: set[str]) -> None:
    """Who wins the regular season -- and how much of it is already decided.

    Bar length is projected final points, split by colour into points a team
    has actually earned and points the simulation expects it to add. Early in
    the season the earned segment is a sliver, which is the honest message:
    almost all of this is still simulation. It grows as the season does.

    Drawn as the same CSS grid as the form table rather than as an Altair
    chart, so one visual language covers the page and the sidebar's team
    highlight reaches this section too.
    """
    cur = (standings[["team", "p_title", "mean_points"]].copy()
           .assign(p_title=lambda d: d["p_title"].astype(float) * 100,
                   mean_points=lambda d: d["mean_points"].astype(float))
           .merge(banked[["team", "banked"]] if not banked.empty
                  else pd.DataFrame({"team": [], "banked": []}),
                  on="team", how="left"))
    cur["banked"] = cur["banked"].fillna(0.0).astype(float)
    # Clip so a team whose banked points already exceed the projection (a hot
    # start) cannot produce a negative segment.
    cur["simuloitu"] = (cur["mean_points"] - cur["banked"]).clip(lower=0.0)
    cur = cur.sort_values("p_title", ascending=False)
    widest = max(float(cur["mean_points"].max()), 1.0)

    cols = [("Sija", "56px", ""), ("Joukkue", "minmax(0,1fr)", ""),
            ("Kerätyt", "76px", "lp-num"),
            ("Ennustetut pisteet", "minmax(240px,2fr)", ""),
            ("Voittaa sarjan", "150px", "lp-num")]
    rows, classes = [], []
    for rank, (_, r) in enumerate(cur.iterrows(), start=1):
        got = 100 * r["banked"] / widest
        sim = 100 * r["simuloitu"] / widest
        rows.append([
            f'<div class="lp-rank">{_qbar(rank)}'
            f'<span class="lp-num lp-dim">{rank}</span></div>',
            f'<span class="lp-team">{_esc(r["team"])}</span>',
            f'{int(r["banked"])}',
            f'<div class="lp-split">'
            f'<i style="background:{BRAND};width:{got:.1f}%"></i>'
            f'<i style="background:{ACCENT_LIGHT};width:{sim:.1f}%"></i>'
            f'</div>',
            f'<span class="lp-tag" style="background:{GOLD_DIM};'
            f'color:{BRAND_DARK}">{_fi(r["p_title"], 1)} %</span>'
            if r["p_title"] >= 1 else
            f'<span class="lp-num lp-dim">{_fi(r["p_title"], 1)} %</span>',
        ])
        classes.append(dim_class(r["team"], highlight))
    render_grid(cols, rows, classes)
    html('<div class="lp-legend">'
         f'<span><span style="width:14px;height:10px;border-radius:2px;'
         f'background:{BRAND};display:inline-block"></span>Kerätyt pisteet</span>'
         f'<span><span style="width:14px;height:10px;border-radius:2px;'
         f'background:{ACCENT_LIGHT};display:inline-block"></span>'
         'Simuloitu loppukausi</span></div>')
    zone_legend()


def render_title_history(history: pd.DataFrame, top: list[str],
                         highlight: set[str]) -> None:
    """Title probability over time for the contenders, plus any highlighted team.

    Six lines still read, but only if they can be told apart. The design is a
    mono-gold system taken from the Liiga logo, so the six get a
    bright-to-dark gold ramp ordered by rank -- the ordering is itself
    information, which a categorical palette would throw away.
    """
    if history.empty or history["snapshot_date"].nunique() < 2:
        return
    shown = list(dict.fromkeys(top + sorted(highlight)))
    h = history[history["team"].isin(shown)].copy()
    if h.empty:
        return
    h["snapshot_date"] = pd.to_datetime(h["snapshot_date"])
    h["p_title"] = h["p_title"].astype(float) * 100

    ramp = ["#EBCA68", "#CCA752", "#B08F3F", "#9A7C33", "#7A6228", "#5C4A1E"]
    colours = {t: ramp[min(i, len(ramp) - 1)] for i, t in enumerate(shown)}
    if highlight:
        colours = {t: (colours[t] if t in highlight else "#3a3226")
                   for t in shown}
    h["paksuus"] = h["team"].map(
        lambda t: 2.6 if (not highlight or t in highlight) else 1.2)

    # Ylärajaan väljyyttä, jotta viivan päähän kirjoitettu nimi mahtuu.
    ymax = min(100.0, max(float(h["p_title"].max()) * 1.25, 10.0))

    st.caption("Miten mestaruussuosikki on vaihtunut — kuusi kärkijoukkuetta"
               + (" ja korostetut." if highlight else "."))
    line = (
        alt.Chart(h)
        .mark_line(interpolate="monotone")
        .encode(
            x=alt.X("snapshot_date:T", title=None,
                    axis=alt.Axis(format="%-d.%-m.", grid=False)),
            # Kiinteä alue, ei domainMin: kerrostettuna toisen tason skaala
            # yhdistyy tähän ja venytti akselin -150 %:iin asti. Prosentti ei
            # voi olla negatiivinen eikä yli sadan.
            y=alt.Y("p_title:Q", title="Todennäköisyys (%)",
                    scale=alt.Scale(domain=[0, ymax], clamp=True)),
            color=alt.Color(
                "team:N", title="Joukkue",
                sort=shown,
                scale=alt.Scale(domain=shown,
                                range=[colours[t] for t in shown]),
                legend=alt.Legend(orient="right")),
            strokeWidth=alt.StrokeWidth("paksuus:Q", scale=None, legend=None),
            tooltip=[alt.Tooltip("team:N", title="Joukkue"),
                     alt.Tooltip("snapshot_date:T", title="Päivä",
                                 format="%-d.%-m.%Y"),
                     alt.Tooltip("p_title:Q", title="%", format=".1f"),
                     alt.Tooltip("games_played:Q", title="Otteluita")],
        )
        .properties(height=320)
    )
    # Selite, ei nimeä viivan päähän: neljä kärkijoukkuetta on tällä
    # hetkellä 10 %:n tuntumassa, ja päätylaput kirjoittuisivat päällekkäin.
    full_width(st.altair_chart, dark(line))


# --------------------------------------------------------------------------
# Muototaulukko -- Liigapörssi-designin suunta 1b
#
# Designin taulukossa on rivikohtainen sparkline ja V/J/H-ruudut, joita
# st.dataframe ei osaa piirtää: se antaa solulle vain tekstin ja tyylin.
# Siksi tämä osa on HTML-taulukko (CSS grid + inline-SVG) yhtenä
# st.markdown-lohkona -- sama ratkaisu toimii kummallakin backendillä, kun
# taas st.column_config ei ole Snowflaken buildissa olemassakaan.
# --------------------------------------------------------------------------
BRAND = "#CCA752"        # logon kulta
BRAND_DARK = "#EBCA68"   # kirkkain korostus -- mustalla tämä on se lukukelpoinen
GOLD_MID = "#9A7C33"     # karsintavyöhyke
GOLD_DIM = "#4a3a18"     # täytöt ja tummat pinnat
GRID = "#2a2620"
MUTED = "#A69B85"
DANGER = "#E0574B"
DANGER_SOFT = "#6b2b25"  # putoamisvyöhykkeen täyttö mustalla

# Yksi <style>, ei per-solu-tyyliä: 17 riviä x 8 saraketta olisi 136
# style-attribuuttia, ja luokat pitävät tuotetun HTML:n luettavana.
_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;600;700;800&family=Roboto+Mono:wght@400;600&display=swap');
:root{
  /* Liigan logon paletti, poimittu pikseleistä. */
  --lp-brand:#CCA752; --lp-brand-dark:#EBCA68; --lp-gold-mid:#9A7C33;
  --lp-gold-dim:#4a3a18; --lp-brown:#36270D;
  /* Tausta on musta; pinnat nousevat siitä lämpimin askelin, jotta rivit
     erottuvat ilman että mikään muuttuu harmaaksi. */
  --lp-bg:#000000; --lp-gray-25:#0d0b07; --lp-gray-50:#15110a;
  --lp-gray-100:#221c12; --lp-gray-200:#2f2718; --lp-gray-300:#463a24;
  --lp-gray-400:#7A7060;
  --lp-ink:#F2EDE2; --lp-body:#D8D0BF; --lp-muted:#A69B85;
  --lp-danger:#E0574B;
  /* Fontit tulevat Google Fontsista. Snowflaken Streamlit voi estää
     ulkoisen pyynnön, joten fallback on oikea pino eikä koriste. */
  --lp-sans:'Hanken Grotesk',system-ui,-apple-system,'Segoe UI',sans-serif;
  --lp-mono:'Roboto Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
}
.lp-kicker{font:700 11px/1 var(--lp-sans);letter-spacing:.12em;
  text-transform:uppercase;color:var(--lp-brand-dark);margin-bottom:8px}
.lp-h1{font:800 34px/1.1 var(--lp-sans);letter-spacing:-.025em;
  color:var(--lp-ink);margin:0 0 6px}
.lp-sub{font:400 14.5px/1.45 var(--lp-sans);color:var(--lp-muted);margin:0}
.lp-tbl{border:1px solid var(--lp-gray-200);border-radius:8px;
  overflow:hidden;font-family:var(--lp-sans)}
.lp-row{display:grid;align-items:center;font-size:13.5px;
  background:var(--lp-gray-25);border-bottom:1px solid var(--lp-gray-100)}
.lp-row:last-child{border-bottom:none}
.lp-row:hover{background:var(--lp-gray-100)}
.lp-head{background:var(--lp-gray-50);border-bottom:1px solid var(--lp-gray-200);
  font:700 11.5px/1 var(--lp-sans);letter-spacing:.04em;text-transform:uppercase;
  color:var(--lp-muted)}
.lp-head > div{padding:9px 12px;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis}
.lp-row > div{padding:8px 12px;min-width:0}
.lp-num{font-family:var(--lp-mono);text-align:right;white-space:nowrap}
.lp-dim{color:var(--lp-muted)}
.lp-team{font-weight:600;color:var(--lp-ink);white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.lp-team-on{color:var(--lp-brand-dark);font-weight:700}
.lp-rank{display:flex;align-items:center;gap:7px}
.lp-q{width:4px;height:16px;border-radius:2px;flex:none}
.lp-mv{font:600 11.5px var(--lp-mono)}
.lp-chip{display:inline-flex;align-items:center;justify-content:center;
  width:20px;height:20px;border-radius:5px;font:700 11px/1 var(--lp-sans)}
.lp-forms{display:flex;gap:4px}
.lp-bar{position:relative;height:22px;border-radius:4px;
  background:var(--lp-gray-100);overflow:hidden}
.lp-bar > i{position:absolute;left:0;top:0;bottom:0;border-radius:4px}
.lp-bar > span{position:absolute;left:8px;top:0;bottom:0;display:flex;
  align-items:center;font:600 12.5px var(--lp-mono);color:var(--lp-ink);
  text-shadow:0 1px 2px rgba(0,0,0,.9)}
.lp-legend{display:flex;gap:20px;flex-wrap:wrap;margin-top:10px;
  font:12px var(--lp-sans);color:var(--lp-muted)}
.lp-legend span{display:flex;align-items:center;gap:6px}
/* Korostus: valittu rivi jää täyteen voimaan, muut haalistuvat. Pelkkä
   korostusväri ei riitä 17 rivin taulukossa -- silmä löytää valitun vasta
   kun ympäriltä otetaan kontrastia pois. */
.lp-off{opacity:.30}
.lp-on{background:var(--lp-gray-100);box-shadow:inset 3px 0 0 var(--lp-brand)}
.lp-on .lp-team{color:var(--lp-brand-dark);font-weight:700}
/* Sijaintijakauma: 17 x 17 ruutua, väri tulee solukohtaisesti. */
.lp-heat > div{padding:6px 2px;text-align:center;font:12px var(--lp-mono)}
.lp-heat .lp-hteam{padding:6px 10px;text-align:left;font:600 13px var(--lp-sans);
  color:var(--lp-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* Kaksiosainen palkki: kerätty + simuloitu, samassa mitassa. */
.lp-split{position:relative;height:22px;border-radius:4px;
  background:var(--lp-gray-100);overflow:hidden;display:flex}
.lp-split > i{display:block;height:100%}
.lp-tag{display:inline-flex;align-items:center;gap:5px;padding:2px 7px;
  border-radius:5px;font:600 12px var(--lp-mono)}
.lp-side-h{font:800 20px/1.2 var(--lp-sans);letter-spacing:-.02em;
  color:var(--lp-ink)}
.lp-side-s{font:12.5px var(--lp-sans);color:var(--lp-muted);margin-top:2px}
.lp-side-f{font:11.5px/1.5 var(--lp-sans);color:var(--lp-gray-400);
  margin-top:6px}
/* Streamlitin oma runko: taustan mustaus ei kulje tokeneiden kautta. */
.stApp, [data-testid="stAppViewContainer"], [data-testid="stHeader"],
[data-testid="stSidebar"]{background:var(--lp-bg)}
[data-testid="stSidebar"]{border-right:1px solid var(--lp-gray-200)}
.stApp, .stMarkdown, .stCaption, p, label{color:var(--lp-body)}
h1,h2,h3,h4{color:var(--lp-ink)}
hr{border-color:var(--lp-gray-200)}
</style>
"""


def html(markup: str) -> None:
    st.markdown(markup, unsafe_allow_html=True)


def _esc(s) -> str:
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
                  .replace(">", "&gt;").replace('"', "&quot;"))


def _fi(x, decimals: int = 2) -> str:
    """Finnish decimal comma. Every number in this view is read, not parsed."""
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return "–"
    return f"{x:.{decimals}f}".replace(".", ",")


def season_table(log: pd.DataFrame,
                 teams: list[str] | None = None) -> pd.DataFrame:
    """One row per team: record, points, goals, xG and special teams.

    Liiga awards 3/2/1/0, so `points` alone separates a regulation win from
    an overtime one and an overtime loss from a plain loss. Deriving the
    record from it rather than from `result_category` keeps the two columns
    from ever disagreeing.

    `teams` is the full league. A club that has not played yet is absent from
    `team_game_log` entirely, and a standings table that quietly drops it
    would be wrong -- early in the season the fixture list is uneven, so this
    is the normal case, not an edge one.
    """
    if log.empty:
        if not teams:
            return pd.DataFrame()
        log = log.reindex(columns=[
            "team", "points", "goals_for", "goals_against", "xg_for",
            "xg_against", "pp_goals", "pp_instances", "sh_instances",
            "pp_goals_against"])
    d = log.copy()
    d["points"] = d["points"].astype(float)
    for c in ("goals_for", "goals_against", "xg_for", "xg_against",
              "pp_goals", "pp_instances", "sh_instances", "pp_goals_against"):
        d[c] = pd.to_numeric(d[c], errors="coerce")

    g = d.groupby("team")
    t = pd.DataFrame({
        "gp": g.size(),
        "pts": g["points"].sum(),
        "w": g["points"].apply(lambda s: int((s == 3).sum())),
        "otw": g["points"].apply(lambda s: int((s == 2).sum())),
        "otl": g["points"].apply(lambda s: int((s == 1).sum())),
        "l": g["points"].apply(lambda s: int((s == 0).sum())),
        "gf": g["goals_for"].sum(),
        "ga": g["goals_against"].sum(),
        "xgf": g["xg_for"].sum(),
        "xga": g["xg_against"].sum(),
        "ppg_goals": g["pp_goals"].sum(),
        "pp_inst": g["pp_instances"].sum(),
        "sh_inst": g["sh_instances"].sum(),
        "pp_against": g["pp_goals_against"].sum(),
    })
    if teams:
        t = t.reindex(sorted(set(teams) | set(t.index))).fillna(0)
        t.index.name = "team"
    t["ppg"] = t["pts"] / t["gp"].clip(lower=1)
    t["gf_pg"] = t["gf"] / t["gp"].clip(lower=1)
    t["ga_pg"] = t["ga"] / t["gp"].clip(lower=1)
    # Denominators can legitimately be zero this early: a team that has never
    # been a man up has no power-play percentage, and 0/0 must read as "–"
    # rather than 0 %.
    t["pp_pct"] = 100 * t["ppg_goals"] / t["pp_inst"].replace(0, pd.NA)
    t["pk_pct"] = 100 * (1 - t["pp_against"] / t["sh_inst"].replace(0, pd.NA))
    t["xg_share"] = 100 * t["xgf"] / (t["xgf"] + t["xga"]).replace(0, pd.NA)
    return t.sort_values(["pts", "gf"], ascending=False)


def _rank_series(t: pd.DataFrame) -> pd.Series:
    return pd.Series(range(1, len(t) + 1), index=t.index)


def rank_movement(log: pd.DataFrame, window: int,
                  teams: list[str] | None = None) -> pd.Series:
    """Places gained since `window` games ago, per team.

    Each team's own last `window` games are removed and the table recomputed,
    so the comparison is "where would this team be without its recent run".
    A team that has not played more than `window` games yet has no earlier
    table to compare against and gets NaN, which renders as a dash.
    """
    if log.empty:
        return pd.Series(dtype=float)
    now = _rank_series(season_table(log, teams))
    # Drop each team's last `window` games by position. groupby().apply() was
    # the obvious way and is wrong here: it drops the grouping column when a
    # group comes back empty, which it does whenever a team has played fewer
    # games than the window -- the normal case in September.
    d = log.sort_values(["team", "start_ts"]).copy()
    d["_n"] = d.groupby("team").cumcount()
    earlier = d[d["_n"] < d.groupby("team")["_n"].transform("size") - window]
    if earlier.empty:
        return pd.Series(pd.NA, index=now.index, dtype="Float64")
    then = _rank_series(season_table(earlier.drop(columns="_n"), teams))
    played = log.groupby("team").size()
    move = then.reindex(now.index) - now          # positive = moved up
    return move.where(played.reindex(now.index).fillna(0) > window)


def _spark(vals: list[float], w: int = 88, h: int = 24) -> str:
    """Rolling points-per-game as an inline SVG, one per row.

    Returns "" for fewer than two points -- a single dot is not a trend, and
    drawing one would imply a shape the data does not have.
    """
    if len(vals) < 2:
        return ""
    lo, hi = 0.0, 3.0                    # Liiga's points-per-game range
    px = lambda k: 2 + (k / (len(vals) - 1)) * (w - 4)
    py = lambda v: h - 3 - ((v - lo) / (hi - lo)) * (h - 6)
    pts = " ".join(("L" if k else "M") + f"{px(k):.1f} {py(v):.1f}"
                   for k, v in enumerate(vals))
    half = max(len(vals) // 2, 1)
    rising = sum(vals[-half:]) / half >= sum(vals[:half]) / half
    colour, fill = ((BRAND_DARK, "rgba(0,145,59,.10)") if rising
                    else (MUTED, "rgba(139,149,143,.10)"))
    area = f"{pts} L{px(len(vals) - 1):.1f} {h - 3} L2 {h - 3} Z"
    return (
        f'<svg viewBox="0 0 {w} {h}" style="display:block;width:{w - 8}px;'
        f'height:{h}px">'
        f'<line x1="0" y1="{h / 2:.0f}" x2="{w}" y2="{h / 2:.0f}" '
        f'stroke="{GRID}" stroke-width="1"/>'
        f'<path d="{area}" fill="{fill}" stroke="none"/>'
        f'<path d="{pts}" fill="none" stroke="{colour}" stroke-width="1.6" '
        f'stroke-linejoin="round" stroke-linecap="round"/>'
        f'<circle cx="{px(len(vals) - 1):.1f}" cy="{py(vals[-1]):.1f}" '
        f'r="2.2" fill="{colour}"/></svg>')


def form_cells(points: list[float]) -> str:
    """The last five results as V / J / H chips.

    Overtime is its own chip rather than a shade of win or loss: in Liiga it
    is worth two points and one, and collapsing it into either would hide
    exactly the games that decide a tight table.
    """
    out = []
    for p in points[-5:]:
        if p == 3:
            style = f"background:{BRAND};color:#1a1206"
            label = "V"
        elif p == 2:
            style = f"background:{GOLD_MID};color:#0d0b07"
            label = "J"
        elif p == 1:
            style = f"background:{GOLD_DIM};color:{BRAND_DARK}"
            label = "H"
        else:
            style = "background:#2a2620;color:#8b8375"
            label = "H"
        out.append(f'<span class="lp-chip" style="{style}">{label}</span>')
    return f'<div class="lp-forms">{"".join(out)}</div>'


def _qbar(rank: int) -> str:
    """The zone stripe next to a rank: playoff, qualification, relegation.

    Colour never carries this alone -- the rank number sits beside it and
    the legend under every table names the zones.
    """
    if rank <= PLAYOFF_CUT:
        colour = BRAND
    elif rank <= QUALI_CUT:
        colour = GOLD_MID
    elif rank > RELEGATION_CUT:
        colour = DANGER
    else:
        colour = "transparent"
    return f'<span class="lp-q" style="background:{colour}"></span>'


def zone_legend() -> None:
    """What the stripes mean. Repeated under every table that ranks teams."""
    html('<div class="lp-legend">'
         f'<span><span class="lp-q" style="background:{BRAND}"></span>'
         'Puolivälierät suoraan (1.–6.)</span>'
         f'<span><span class="lp-q" style="background:{GOLD_MID}"></span>'
         f'Karsinta (7.–{QUALI_CUT}.)</span>'
         f'<span><span class="lp-q" style="background:{DANGER}"></span>'
         f'Putoaa B-sarjaan ({RELEGATION_CUT + 1}.–{TEAMS}.)</span>'
         '</div>')


def _move(mv) -> str:
    if mv is None or pd.isna(mv):
        return '<span class="lp-mv" style="color:#b6bfbb">–</span>'
    mv = int(mv)
    if mv == 0:
        return '<span class="lp-mv" style="color:#b6bfbb">–</span>'
    arrow, colour = ("▲", BRAND_DARK) if mv > 0 else ("▼", DANGER)
    return f'<span class="lp-mv" style="color:{colour}">{arrow} {abs(mv)}</span>'


def dim_class(team: str, highlight: set[str]) -> str:
    """Row class for the sidebar's team highlight.

    With nothing selected every row renders at full strength -- fading
    seventeen rows to emphasise none of them would only make the page
    harder to read. Once a team is picked the others drop to a third
    opacity, which is what makes the selection findable in a
    seventeen-row table or a 289-cell heatmap.
    """
    if not highlight:
        return ""
    return "lp-on" if team in highlight else "lp-off"


def render_grid(cols: list[tuple[str, str, str]], rows: list[list[str]],
                row_classes: list[str] | None = None) -> None:
    """A CSS-grid table. `cols` is (label, css width, alignment class)."""
    template = " ".join(c[1] for c in cols)
    head = "".join(
        f'<div style="text-align:{"right" if c[2] else "left"}">{_esc(c[0])}</div>'
        for c in cols)
    classes = row_classes or [""] * len(rows)
    body = []
    for r, extra in zip(rows, classes):
        cells = "".join(
            f'<div class="{c[2]}">{v}</div>' for c, v in zip(cols, r))
        body.append(
            f'<div class="lp-row {extra}" '
            f'style="grid-template-columns:{template}">{cells}</div>')
    html(f'<div class="lp-tbl">'
         f'<div class="lp-row lp-head" style="grid-template-columns:{template}">'
         f'{head}</div>{"".join(body)}</div>')


def render_form_table(log: pd.DataFrame, window: int, *,
                      show_spark: bool, show_xg: bool,
                      highlight: set[str], teams: list[str]) -> None:
    """The design's headline table: standing, recent form, trend, points."""
    t = season_table(log, teams)
    if t.empty:
        st.info("Kausi ei ole vielä alkanut — ei pelattuja otteluita.")
        return
    moves = rank_movement(log, window, teams)
    by_team = {k: v.sort_values("start_ts") for k, v in log.groupby("team")}
    max_pts = max(float(t["pts"].max()), 1.0)

    cols = [("Sija", "56px", ""), ("Joukkue", "minmax(0,1fr)", ""),
            ("O", "46px", "lp-num lp-dim")]
    if show_xg:
        cols.append(("xG-osuus", "94px", "lp-num"))
    cols.append(("Muoto (viim. 5)", "128px", ""))
    if show_spark:
        cols.append((f"Vire ({window})", "104px", ""))
    cols += [("TM–PM", "92px", "lp-num lp-dim"), ("P", "168px", "")]

    rows, classes = [], []
    for rank, (team, r) in enumerate(t.iterrows(), start=1):
        pts_list = (by_team[team]["points"].astype(float).tolist()
                    if team in by_team else [])
        recent = pts_list[-window:]
        # Rolling mean, not raw points: three games of 3-0-3 is a flat run at
        # 2.0, and the raw series would draw it as a zigzag.
        rolling = [sum(recent[:k + 1]) / (k + 1) for k in range(len(recent))]
        name = f'<span class="lp-team">{_esc(team)}</span>'
        row = [
            f'<div class="lp-rank">{_qbar(rank)}'
            f'<span class="lp-num lp-dim">{rank}</span></div>',
            f'<div style="display:flex;align-items:center;gap:10px;min-width:0">'
            f'{name}{_move(moves.get(team))}</div>',
            str(int(r["gp"])),
        ]
        if show_xg:
            row.append(_fi(r["xg_share"], 1) + " %")
        row.append(form_cells(pts_list))
        if show_spark:
            row.append(_spark(rolling))
        row.append(f'{int(r["gf"])}–{int(r["ga"])}')
        width = 100 * float(r["pts"]) / max_pts
        fill = GOLD_MID if rank <= PLAYOFF_CUT else GRID
        row.append(f'<div class="lp-bar"><i style="background:{fill};'
                   f'width:{width:.1f}%"></i>'
                   f'<span>{int(r["pts"])}</span></div>')
        rows.append(row)
        classes.append(dim_class(team, highlight))

    render_grid(cols, rows, classes)
    html(
        '<div class="lp-legend">'
        f'<span><span class="lp-chip" style="background:{BRAND};color:#1a1206">V'
        '</span>Voitto</span>'
        f'<span><span class="lp-chip" style="background:{GOLD_MID};'
        'color:#0d0b07">J</span>Voitto jatkoajalla</span>'
        f'<span><span class="lp-chip" style="background:{GOLD_DIM};'
        f'color:{BRAND_DARK}">H</span>Häviö jatkoajalla</span>'
        '<span><span class="lp-chip" style="background:#2a2620;color:#8b8375">'
        'H</span>Häviö</span>'
        + ('<span>Vire = pisteet per ottelu, liukuva keskiarvo</span>'
           if show_spark else '')
        + '</div>')
    zone_legend()


def render_split_table(log: pd.DataFrame, highlight: set[str],
                       teams: list[str]) -> None:
    """Home and away records side by side."""
    if log.empty:
        st.info("Ei vielä pelattuja otteluita.")
        return
    order = season_table(log, teams).index.tolist()
    d = log.copy()
    d["points"] = d["points"].astype(float)
    d["is_home"] = d["is_home"].astype(bool)

    def side(home: bool) -> pd.DataFrame:
        s = d[d["is_home"] == home].groupby("team")
        return pd.DataFrame({"gp": s.size(), "pts": s["points"].sum(),
                             "gf": s["goals_for"].sum(),
                             "ga": s["goals_against"].sum()})

    h, a = side(True), side(False)
    cols = [("Sija", "56px", ""), ("Joukkue", "minmax(0,1fr)", ""),
            ("Koti O", "72px", "lp-num lp-dim"), ("Koti P", "72px", "lp-num"),
            ("Koti TM–PM", "108px", "lp-num lp-dim"),
            ("Vieras O", "88px", "lp-num lp-dim"),
            ("Vieras P", "88px", "lp-num"),
            ("Vieras TM–PM", "124px", "lp-num lp-dim")]
    rows, classes = [], []
    for rank, team in enumerate(order, start=1):
        classes.append(dim_class(team, highlight))
        cells = [f'<div class="lp-rank">{_qbar(rank)}'
                 f'<span class="lp-num lp-dim">{rank}</span></div>',
                 f'<span class="lp-team">{_esc(team)}</span>']
        for frame in (h, a):
            if team in frame.index:
                r = frame.loc[team]
                cells += [str(int(r["gp"])), str(int(r["pts"])),
                          f'{int(r["gf"])}–{int(r["ga"])}']
            else:
                cells += ["0", "0", "–"]
        rows.append(cells)
    render_grid(cols, rows, classes)
    zone_legend()


def render_goals_table(log: pd.DataFrame, highlight: set[str],
                       teams: list[str]) -> None:
    """Scoring and conceding, with the xG version of the same two numbers."""
    t = season_table(log, teams)
    if t.empty:
        st.info("Ei vielä pelattuja otteluita.")
        return
    cols = [("Sija", "56px", ""), ("Joukkue", "minmax(0,1fr)", ""),
            ("O", "46px", "lp-num lp-dim"), ("TM", "56px", "lp-num"),
            ("PM", "56px", "lp-num"), ("TM/ottelu", "92px", "lp-num"),
            ("PM/ottelu", "92px", "lp-num"), ("xG puolesta", "104px", "lp-num"),
            ("xG vastaan", "104px", "lp-num"), ("xG-osuus", "92px", "lp-num")]
    rows, classes = [], []
    for rank, (team, r) in enumerate(t.iterrows(), start=1):
        classes.append(dim_class(team, highlight))
        rows.append([
            f'<div class="lp-rank">{_qbar(rank)}'
            f'<span class="lp-num lp-dim">{rank}</span></div>',
            f'<span class="lp-team">{_esc(team)}</span>',
            str(int(r["gp"])), str(int(r["gf"])), str(int(r["ga"])),
            _fi(r["gf_pg"]), _fi(r["ga_pg"]),
            _fi(r["xgf"], 1), _fi(r["xga"], 1),
            _fi(r["xg_share"], 1) + " %"])
    render_grid(cols, rows, classes)
    zone_legend()
    st.caption(
        "xG-osuus on oman xG:n osuus ottelun kokonais-xG:stä. Se mittaa "
        "paikkojen laatua, **ei** kiekonhallintaa — liiga.fi ei julkaise "
        "laukauksia, aloituksia eikä hallinta-aikaa.")


def render_special_table(log: pd.DataFrame, highlight: set[str],
                         teams: list[str]) -> None:
    """Power play and penalty kill."""
    t = season_table(log, teams)
    if t.empty:
        st.info("Ei vielä pelattuja otteluita.")
        return
    cols = [("Sija", "56px", ""), ("Joukkue", "minmax(0,1fr)", ""),
            ("O", "46px", "lp-num lp-dim"), ("YV-maalit", "96px", "lp-num"),
            ("YV-kerrat", "96px", "lp-num"), ("YV-%", "84px", "lp-num"),
            ("AV-kerrat", "96px", "lp-num"),
            ("Päästetyt", "96px", "lp-num"), ("AV-%", "84px", "lp-num")]
    rows, classes = [], []
    for rank, (team, r) in enumerate(t.iterrows(), start=1):
        classes.append(dim_class(team, highlight))
        rows.append([
            f'<div class="lp-rank">{_qbar(rank)}'
            f'<span class="lp-num lp-dim">{rank}</span></div>',
            f'<span class="lp-team">{_esc(team)}</span>',
            str(int(r["gp"])), str(int(r["ppg_goals"])), str(int(r["pp_inst"])),
            _fi(r["pp_pct"], 1) + " %", str(int(r["sh_inst"])),
            str(int(r["pp_against"])), _fi(r["pk_pct"], 1) + " %"])
    render_grid(cols, rows, classes)
    zone_legend()
    st.caption(
        "YV = ylivoima, AV = alivoima. **Päästetyt** on alivoimalla päästetyt "
        "maalit, ja AV-% on niiden osuus torjutuista alivoimista. Ilman "
        "yhtään ylivoimaa YV-% on “–”, ei nolla.")


def sidebar_controls(log: pd.DataFrame, stamp: str,
                     teams: list[str]) -> dict:
    """The design's left rail: form window, team highlight, toggles."""
    with st.sidebar:
        html('<div class="lp-side-h">Liigapörssi</div>'
             '<div class="lp-side-s">Kausi 2026–27, runkosarja</div>')
        st.divider()
        window = st.select_slider("Muotoikkuna", options=[5, 10, 20], value=10,
                                  help="Kuinka monta viimeisintä ottelua vire "
                                       "ja sijoitusmuutos kattavat.")
        highlight = st.multiselect("Korosta joukkueet", teams, default=[],
                                   help="Korostetut joukkueet erottuvat "
                                        "taulukoissa.")
        show_spark = st.checkbox("Näytä muotokäyrä", value=True)
        show_xg = st.checkbox("Näytä xG-luvut", value=False)
        st.divider()
        html('<div class="lp-side-f">Lähde: Liiga.fi<br>'
             f'Päivitetty {_esc(stamp)}<br>'
             + ("Snowflake (LIIGA.MODEL)" if backend() == "snowflake"
                else "Paikallinen DuckDB")
             + '</div>')
    return {"window": window, "highlight": set(highlight),
            "show_spark": show_spark, "show_xg": show_xg}


# --------------------------------------------------------------------------
# Instagram- / LinkedIn-diat
#
# Diat rakentaa scripts/build_instagram.py, ei tämä tiedosto. Sama koodi
# tuottaa myös levylle kirjoitettavan yhdeksän dian karusellin, joten ilme ei
# voi karata erilleen -- kaksi rinnakkaista toteutusta samasta ulkoasusta
# eroaisi ensimmäisellä muutoksella.
#
# Hinta: rasterointi on headless Chrome, joka on läppärillä eikä
# Snowflakessa. Osio kertoo sen ääneen sen sijaan että katoaisi hiljaa.
# --------------------------------------------------------------------------
def _slide_builder():
    """scripts/build_instagram, tai None jos sitä ei voi ladata täältä."""
    import importlib.util
    from pathlib import Path
    path = Path(__file__).resolve().parent.parent / "scripts" / "build_instagram.py"
    if not path.exists():
        return None
    spec = importlib.util.spec_from_file_location("liiga_instagram", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@st.cache_data(show_spinner="Renderöidään dioja…")
def build_slides(updated_at: str) -> tuple[list, bytes, str]:
    """Diat ja niistä koottu PDF. Avaimena ennusteen aikaleima.

    Rasterointi kestää sekunteja per dia, joten tätä ei ajeta jokaisella
    uudelleenpiirrolla -- vain kun ennuste on oikeasti muuttunut.
    """
    try:
        builder = _slide_builder()
        if builder is None:
            return [], b"", "scripts/build_instagram.py ei ole käytettävissä."
        slides = builder.live_slides()
        if not slides:
            return [], b"", "standings_2026_27 on tyhjä."
        # Yhden dian PDF kootaan tässä eikä nappia piirrettäessä: muuten
        # build_instagram ladattaisiin uudelleen kerran per nappi joka
        # uudelleenpiirrolla.
        out = [(name, png, builder.slides_to_pdf([(name, png)]))
               for name, png in slides]
        return out, builder.slides_to_pdf(slides), ""
    except Exception as exc:              # noqa: BLE001 -- kerro syy, älä katoa
        return [], b"", str(exc).strip().splitlines()[0][:300]


def render_slide_section(updated_at: str) -> None:
    st.subheader("Diat jakoon")
    st.caption(
        "Kolme 1080×1350 (4:5) diaa tästä hetkestä: sijat 1–6, 7–12 ja 13–17. "
        "Jokaisella rivillä nuoli ja **ed.** kertovat sijan edellisessä "
        "ennusteessa ja **alkup.** sijan ensimmäisessä. **Lataa kaikki** antaa "
        "yhden PDF:n, jonka voi viedä LinkedIn-karuselliksi sellaisenaan.")

    slides, pdf, problem = build_slides(updated_at)
    if problem:
        st.warning(
            "Dioja ei voitu renderöidä: " + problem
            + "  \nRasterointi vaatii headless Chromen, joka on paikallisella "
              "koneella mutta ei Snowflakessa.")
        return

    st.download_button(
        f"⬇ Lataa kaikki ({len(slides)} diaa, PDF)", data=pdf,
        file_name=f"liiga-ennuste-{updated_at[:10]}.pdf",
        mime="application/pdf", type="primary")

    for row_start in range(0, len(slides), 4):
        for col, (name, png, one_pdf) in zip(st.columns(4),
                                             slides[row_start:row_start + 4]):
            with col:
                full_width(st.image, png)
                # Yksittäinenkin lataus PDF:nä: LinkedIn ottaa karusellin
                # PDF:nä, ja PNG olisi eri tiedostomuoto samasta napista.
                st.download_button(
                    "⬇ PDF", key=f"dl_{name}", data=one_pdf,
                    file_name=name.replace(".png", ".pdf"),
                    mime="application/pdf")


# --------------------------------------------------------------------------
def main() -> None:
    updated_at = load_updated_at()
    data = load_data(updated_at)
    standings, meta = data["standings"], data["meta"]

    html(_CSS)

    played = int(meta.iloc[0]["games_played"]) if not meta.empty else 0
    total = int(meta.iloc[0]["games_total"]) if not meta.empty else 0
    try:
        stamp = (dt.datetime.fromisoformat(updated_at)
                 .strftime("%-d.%-m.%Y klo %H.%M"))
    except (ValueError, TypeError):
        stamp = updated_at or "ei tiedossa"

    log = data["team_log"]
    all_teams = sorted(standings["team"].tolist())
    opts = sidebar_controls(log, stamp, all_teams)

    html(f'<div class="lp-kicker">Runkosarja {played}/{total} pelattu</div>'
         '<div class="lp-h1">Kuka on kuumana?</div>'
         '<p class="lp-sub">Sarjataulukko ja viimeisten otteluiden vire '
         'samassa näkymässä. Toteutuneet tulokset — mallin ennuste on '
         'alempana.</p>')
    st.write("")

    if opts["highlight"]:
        st.caption("Korostettu: **" + "**, **".join(sorted(opts["highlight"]))
                   + "** — muut on haalennettu koko sivulla.")
    tabs = st.tabs(["Sarjataulukko", "Koti / vieras", "Maalinteko",
                    "Erikoistilanteet"])
    with tabs[0]:
        render_form_table(log, opts["window"], show_spark=opts["show_spark"],
                          show_xg=opts["show_xg"],
                          highlight=opts["highlight"], teams=all_teams)
    with tabs[1]:
        render_split_table(log, opts["highlight"], all_teams)
    with tabs[2]:
        render_goals_table(log, opts["highlight"], all_teams)
    with tabs[3]:
        render_special_table(log, opts["highlight"], all_teams)

    st.divider()
    st.subheader("Kuka voittaa runkosarjan?")
    st.caption(
        f"Palkin pituus on ennustetut loppupisteet: tumma osa on jo kerätty "
        f"({played}/{total} ottelua pelattu), vaalea on {N_SIMS} simuloidun "
        "kauden keskiarvo lopuista. Luku palkin perässä on todennäköisyys "
        "prosentteina, että joukkue on runkosarjan ykkönen.")
    render_title_race(standings, data["banked"], opts["highlight"])
    render_title_history(
        data["history"],
        standings.sort_values("p_title", ascending=False)["team"]
                 .head(6).tolist(), opts["highlight"])

    m = position_matrix(data["position"], standings)

    st.subheader("Mihin kukin joukkue päätyy")
    st.caption(
        f"Todennäköisyys prosentteina, {TEAMS} sijaa. Kirkas viiva on "
        f"playoff-raja ({PLAYOFF_CUT}.), katkoviiva karsintaraja "
        f"({QUALI_CUT}.) ja punainen viiva putoamisraja "
        f"({RELEGATION_CUT}.). Rivit ennustetussa järjestyksessä."
    )
    render_position_table(m, opts["highlight"])

    sd = rank_stdev(m).sort_values(ascending=False)
    wild = ", ".join(f"{t} (σ {v:.1f})" for t, v in sd.head(2).items())
    tight = ", ".join(f"{t} (σ {v:.1f})" for t, v in sd.tail(2)[::-1].items())
    st.caption(f"**Villit kortit:** {wild} voivat päätyä lähes minne tahansa. "
               f"**Varmimmat:** {tight} — simulaatiot ovat pitkälti samaa "
               "mieltä niiden sijoituksesta.")

    upcoming = data["upcoming"]
    if data["upcoming_error"]:
        # Silence here once hid a real bug: the query used unqualified table
        # names and failed in Snowflake, so the section simply vanished.
        st.subheader("Seuraavat ottelut")
        st.warning("Otteluennusteita ei saatu haettua: "
                   + data["upcoming_error"])
    elif not upcoming.empty:
        st.subheader("Ottelut")
        st.caption("Kotivoiton todennäköisyys sisältää jatkoajalla ratkenneet. "
                   "”Malli antoi voittajalle” on se todennäköisyys, jonka "
                   "malli antoi ennen ottelua sille joukkueelle, joka lopulta "
                   "voitti — mitä pienempi, sitä enemmän ennuste meni pieleen.")

        month_keys = sorted(upcoming["start_ts"].str[:7].unique())
        this_month = dt.date.today().strftime("%Y-%m")
        # Default to the running month; before the season opens that month has
        # no games at all, so fall back to the first month that does.
        default = month_keys.index(this_month) if this_month in month_keys else 0
        chosen = st.selectbox(
            "Kuukausi",
            month_keys, index=default,
            format_func=lambda k: (f"{MONTHS_FI[int(k[5:7]) - 1]} {k[:4]}"
                                   .capitalize()))
        render_fixtures(upcoming[upcoming["start_ts"].str[:7] == chosen],
                        opts["highlight"])

    st.subheader("Miten ennuste on liikkunut")
    st.caption("Ennustetut lopputilanteen pisteet, yksi piste per päivitysajo. "
               "Oma paneeli per joukkue — harmaana kaikki muut vertailukohdaksi.")
    render_history(data["history"],
                   standings.sort_values("proj_rank")["team"].tolist(),
                   opts["highlight"])

    st.divider()
    render_slide_section(updated_at)


if __name__ == "__main__":
    main()
