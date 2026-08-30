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


def load_updated_at() -> str:
    """Ennusteen aikaleima. Tätä EI kacheta -- se on välimuistin avain."""
    meta = read_sql("prediction_meta")
    if meta.empty:
        return ""
    return str(meta.iloc[0]["updated_at"])


@st.cache_data(show_spinner=False)
def load_data(updated_at: str) -> dict[str, pd.DataFrame]:
    """Kaikki näytettävä data. Avaimena aikaleima: uusi ennuste -> uusi haku."""
    return {
        "standings": read_sql("standings_2026_27"),
        "position": read_sql("position_distribution_2026_27"),
        "history": read_sql("prediction_history"),
        "meta": read_sql("prediction_meta"),
    }


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
    st.dataframe(styler, width="stretch", height=(TEAMS + 1) * 35 + 3)


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
    st.altair_chart(chart, width="stretch")


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

    st.subheader("Miten ennuste on liikkunut")
    st.caption("Ennustetut lopputilanteen pisteet, yksi piste per päivitysajo. "
               "Kauden alettua esikauden mielipide väistyy tulosten tieltä.")
    render_history(data["history"], standings.sort_values("proj_rank")["team"].tolist())


if __name__ == "__main__":
    main()
