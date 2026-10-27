"""news-data-haaran CSV:t sovelluksen DuckDB-tauluiksi Pages-käännöstä varten
(27.10.2026; docs/uutismalli_suunnitelma.md, vaihe 3).

    python scripts/news/load_news.py NEWSDIR

Taulut (korvataan joka kerta; Pagesin runnerin kanta on kertakäyttöinen):
  news_items             uutiset (otsikko, linkki, joukkue, liput)
  news_candidates        uutisen otsikosta tunnistetut rosterin pelaajat
                         (vain loukkaantuminen/paluu/pelikielto-liputetut)
  news_absences          hyväksytyt poissaolot (OK-nappi, absence.yml)
  news_lineups           päivän kokoonpanojen valmius ja aloittavat maalivahdit
  prediction_games_news  haastajan ennusteet (challenger.py)

Puuttuva tiedosto = tyhjä taulu, jotta sovelluksen kyselyt toimivat aina.
"""
from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path

import duckdb
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DB = ROOT / "data" / "liiga.duckdb"
SUGGEST = ("loukkaantuminen", "paluu", "pelikielto")

FILES = {
    "news_items": ("news_items.csv", ["fetched_at", "published", "source", "team", "flags", "title", "url"]),
    "news_absences": ("absences.csv", ["approved_at", "url", "player", "team", "kind", "games", "start", "until"]),
    "news_lineups": ("lineup_games.csv", ["fetched_at", "date", "game_id", "start", "home", "away",
                                           "lineup_ready", "home_starter", "away_starter"]),
    "prediction_games_news": ("prediction_games_news.csv", ["snapshot_date", "game_id", "home_team", "away_team",
                                                            "base_p_home_win", "p_home_reg", "p_away_reg",
                                                            "p_overtime", "p_home_win", "notes"]),
}


def _fold(s: str) -> str:
    return unicodedata.normalize("NFKC", s).lower()


def _stems(name: str) -> list[str]:
    """Sukunimen tunnistusmuodot: perusmuoto ja taivutusvartalo (Huuhtanen ->
    Huuhtase-, Wernblom -> Wernblomi-). Lyhyet nimet vain kokonaisina."""
    last = _fold(name.split()[-1])
    if len(last) < 5:
        return [last]
    stems = {last}
    if last.endswith("nen"):
        stems.add(last[:-3] + "s")                  # Huuhtanen -> Huuhtasen, Huuhtaselle
    else:
        stems.add(last)                              # Wernblom -> Wernblomin (alkaa samoin)
    return sorted(stems)


def candidates(items: pd.DataFrame, roster: pd.DataFrame) -> pd.DataFrame:
    """Pelaajat, joiden sukunimi esiintyy liputetun uutisen otsikossa. Joukkue
    rajaa, kun uutisella on joukkue; muuten koko liiga."""
    rows = []
    sug = items[items["flags"].fillna("").str.contains("|".join(SUGGEST))]
    for it in sug.itertuples(index=False):
        title = " " + _fold(it.title) + " "
        teams = [t for t in str(it.team or "").split(",") if t]
        pool = roster[roster["team"].isin(teams)] if teams else roster
        for p in pool.itertuples(index=False):
            if any(re.search(r"[\s\-–(\"'”]" + re.escape(s), title) for s in _stems(p.name)):
                rows.append({"url": it.url, "player": p.name, "team": p.team, "position": p.position_group})
    return pd.DataFrame(rows, columns=["url", "player", "team", "position"]).drop_duplicates()


def main(folder: Path) -> None:
    con = duckdb.connect(str(DB))
    try:
        frames = {}
        for table, (fname, cols) in FILES.items():
            path = folder / fname
            df = pd.read_csv(path, dtype=str) if path.exists() else pd.DataFrame(columns=cols)
            frames[table] = df.reindex(columns=cols)
        roster = con.execute("""
            SELECT name, team, position_group FROM player_rates
            UNION ALL SELECT name, team, 'G' FROM team_goalie_weights""").df()
        frames["news_candidates"] = candidates(frames["news_items"], roster)
        for table, df in frames.items():
            con.register("_df", df)
            con.execute(f"CREATE OR REPLACE TABLE {table} AS SELECT * FROM _df")
            con.unregister("_df")
            print(f"{table}: {len(df)} riviä")
    finally:
        con.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(Path(sys.argv[1]))
