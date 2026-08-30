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
ACCENT = (51, 102, 153)  # #336699, sama teräksensininen kuin sivustolla

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
        upcoming, upcoming_error = run_query(fixtures_sql()), ""
    except Exception as exc:              # noqa: BLE001 -- degrade, but say so
        upcoming = pd.DataFrame(columns=[
            "start_ts", "home_team", "away_team", "ended", "home_goals",
            "away_goals", "result_category", "p_home_win", "p_overtime"])
        upcoming_error = str(exc).strip().splitlines()[0][:200]
    return {
        "standings": read_sql("standings_2026_27"),
        "position": read_sql("position_distribution_2026_27"),
        "history": read_sql("prediction_history"),
        "meta": read_sql("prediction_meta"),
        "upcoming": upcoming,
        "upcoming_error": upcoming_error,
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


def _cell_style(p: float) -> str:
    """Solun väri. Sama potenssiramppi kuin sivustolla (build_site.py).

    Suora lineaarinen alpha hukuttaisi tasaiset keskikastin rivit, joiden
    huippu on ~9 %, samalla kun kärjen 43 % veisi kaiken kontrastin.
    """
    if pd.isna(p) or p < 0.002:
        return "background-color:rgba(0,0,0,0); color:#BBBBBB"
    alpha = min(0.92, (p / 0.35) ** 0.6 * 0.92)
    ink = "#FFFFFF" if alpha > 0.45 else ("#1A1A1A" if p >= 0.08 else "#666666")
    return f"background-color:rgba{(*ACCENT, round(alpha, 3))}; color:{ink}"


def _cell_label(p: float) -> str:
    """Prosenttiluku. Alle 1 % näytetään '<1', alle 0,05 % jätetään tyhjäksi."""
    if pd.isna(p) or p < 0.0005:
        return ""
    if p < 0.005:
        return "<1"
    return f"{round(p * 100):.0f}"


def render_position_table(m: pd.DataFrame) -> None:
    styler = (m.style
               .format(_cell_label)
               .map(_cell_style)
               .set_properties(**{"text-align": "center"}))
    # Pystyviivat playoff- ja karsintarajalle, kuten sivuston taulukossa
    for col, border in ((PLAYOFF_CUT + 1, "2px solid #336699"),
                        (QUALI_CUT + 1, "1px dashed #667788")):
        styler = styler.set_properties(subset=[col],
                                       **{"border-left": border})
    full_width(st.dataframe, styler, height=(TEAMS + 1) * 35 + 3)


# --------------------------------------------------------------------------
# Ennusteen liike
# --------------------------------------------------------------------------
def render_history(history: pd.DataFrame, order: list[str]) -> None:
    h = history.copy()
    h["snapshot_date"] = pd.to_datetime(h["snapshot_date"])
    h["mean_points"] = h["mean_points"].astype(float)

    chart = (
        alt.Chart(h)
        .mark_line(strokeWidth=2, interpolate="monotone")
        .encode(
            x=alt.X("snapshot_date:T", title=None,
                    axis=alt.Axis(format="%-d.%-m.", grid=False)),
            y=alt.Y("mean_points:Q", title="Ennustetut pisteet",
                    scale=alt.Scale(zero=False, nice=True)),
            color=alt.Color("team:N", title="Joukkue",
                            sort=order,
                            scale=alt.Scale(scheme="tableau20")),
            tooltip=[alt.Tooltip("team:N", title="Joukkue"),
                     alt.Tooltip("snapshot_date:T", title="Päivä",
                                 format="%-d.%-m.%Y"),
                     alt.Tooltip("mean_points:Q", title="Pisteet",
                                 format=".1f"),
                     alt.Tooltip("games_played:Q", title="Otteluita")],
        )
        .properties(height=430)
        .interactive()
    )
    full_width(st.altair_chart, chart)


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


def render_fixtures(games: pd.DataFrame) -> None:
    """Fixtures with in-cell probability bars, and the outcome once played.

    Drawn with a pandas Styler rather than st.column_config: Streamlit in
    Snowflake ships a build with no `column_config` attribute at all, and the
    heatmap above already proves Styler renders the same on both.
    """
    df = games.copy()
    out = pd.DataFrame({
        "Päivä": pd.to_datetime(df["start_ts"]).dt.strftime("%-d.%-m."),
        "Ottelu": df["home_team"] + " – " + df["away_team"],
        "Koti voittaa": df["p_home_win"].astype(float) * 100,
        "Vieras voittaa": 100 - df["p_home_win"].astype(float) * 100,
        "Jatkoaika": df["p_overtime"].astype(float) * 100,
        "Tulos": df.apply(_result_text, axis=1),
        "Malli antoi voittajalle": df.apply(_model_said, axis=1),
    })

    bars = ["Koti voittaa", "Vieras voittaa"]
    nums = bars + ["Jatkoaika", "Malli antoi voittajalle"]
    styler = (out.style
                 .format({c: "{:.0f} %" for c in nums}, na_rep="")
                 # A bar reads faster than a number when the question is
                 # "who is favoured, and by how much". vmin/vmax pinned to
                 # 0-100 so bars are comparable between rows.
                 .bar(subset=bars, color=f"rgba{(*ACCENT, 0.35)}",
                      vmin=0, vmax=100)
                 .set_properties(subset=nums, **{"text-align": "right"}))
    full_width(st.dataframe, styler, hide_index=True,
               height=min(len(out) + 1, 26) * 35 + 3)


# --------------------------------------------------------------------------
def main() -> None:
    updated_at = load_updated_at()
    data = load_data(updated_at)
    standings, meta = data["standings"], data["meta"]

    st.title("Liiga 2026-27 — ennuste")

    played = int(meta.iloc[0]["games_played"]) if not meta.empty else 0
    total = int(meta.iloc[0]["games_total"]) if not meta.empty else 0
    try:
        stamp = (dt.datetime.fromisoformat(updated_at)
                 .strftime("%-d.%-m.%Y %H:%M"))
    except (ValueError, TypeError):
        stamp = updated_at or "ei tiedossa"

    c1, c2, c3 = st.columns(3)
    c1.metric("Ennuste päivitetty (UTC)", stamp)
    c2.metric("Otteluita pelattu", f"{played} / {total}")
    c3.metric("Datalähde",
              "Snowflake (LIIGA.MODEL)" if backend() == "snowflake"
              else "Paikallinen DuckDB")

    m = position_matrix(data["position"], standings)

    st.subheader("Mihin kukin joukkue päätyy")
    st.caption(
        f"Todennäköisyys prosentteina, {TEAMS} sijaa. Yhtenäinen viiva on "
        f"playoff-raja (6.) ja katkoviiva karsintaraja (10.). "
        "Rivit ennustetussa järjestyksessä."
    )
    render_position_table(m)

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
        render_fixtures(upcoming[upcoming["start_ts"].str[:7] == chosen])

    st.subheader("Miten ennuste on liikkunut")
    st.caption("Ennustetut lopputilanteen pisteet, yksi piste per päivitysajo. "
               "Kauden alettua esikauden mielipide väistyy tulosten tieltä.")
    render_history(data["history"], standings.sort_values("proj_rank")["team"].tolist())


if __name__ == "__main__":
    main()
