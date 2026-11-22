"""Kuratoidut lähdetaulut ja pelaajamalli Snowflakessa (22.11.2026, ennen Macin aamusynkka).

Ennen nämä taulut tulivat Macilta (liiga.snowflake_sync, käyttäjä LIIGA_SYNC, rooli LIIGA_LOADER).
Nyt LIIGA_DAILY_RUN (daily.py) lataa ne koodibundlen data/-tiedostoista, jotka ovat gitistä
(deploy_bundle.py), ja omistaja on sama kuin muulla putkella (LIIGA_ADMIN).

Sormenjälki (sha256) ratkaisee, kirjoitetaanko mitään. Tila: PIPELINE_STATE (LIIGA.CODE).
  - CSV-taulut: tiedosto muuttui -> taulu ladataan uudelleen, muuten ei kosketa.
  - pelaajamalli (roster_2026_27, player_rates*, player_rates_liiga): lasketaan uudelleen VAIN, kun
    rosterin syötteet muuttuvat (transfers, external_players, league_factors, config players).
    Muuten ennusteen luvut pysyvät täsmälleen samoina (ei mallin viritystä kesken kauden).
  - ensimmäisellä kerralla (ei tilariviä) sormenjälki vain kirjataan ("adopted"): taulut ovat jo
    samoista git-tiedostoista Macin viimeisestä synkasta.
player_bio: puuttuvat pelaajat lisätään game_lineupsista (sama liiga.fi:n otteluvastaus, jonka putki
on jo hakenut), vanhoja rivejä ei muuteta. 0 lisäkutsua liiga.fi:hin.
"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

import pandas as pd

from .config import load_config, resolve_path
from .db import ActiveSession, execute, query_df, register_df

# taulu -> tiedosto (data/). Luetaan sellaisenaan kuten Macin synkka teki.
CSV_TABLES = {
    "league_factors": "data/league_factors.csv",
    "raw_external_player_seasons": "data/external_players.csv",
    "preseason_player_rates": "data/preseason_player_rates.csv",
    "roster_impact": "data/roster_impact.csv",     # rosterityö (scripts/local/roster_impact.py) commitoi
}
# Omat lataajat (validointi tai jäsennys): coaching_changes.csv, goalies_raw.txt.
LOADER_FILES = {"coaching_changes": "data/coaching_changes.csv", "raw_goalie_seasons": "data/goalies_raw.txt"}
# Rosterin syötteet = mitä build_rosters_from_article + build_player_rates lukevat tiedostoista.
RATE_FILES = ["data/transfers_2026_27.txt", "data/external_players.csv", "data/league_factors.csv"]
RATES = "player_rates"     # tilarivin nimi pelaajamallille


def fingerprint(files: list[str], extra: object = None) -> str:
    h = hashlib.sha256()
    for f in files:
        h.update(f.encode())
        h.update(resolve_path(f).read_bytes())
    if extra is not None:
        h.update(json.dumps(extra, sort_keys=True, default=str).encode())
    return h.hexdigest()


def _rate_fingerprint() -> str:
    cfg = load_config()
    return fingerprint(RATE_FILES, {"players": cfg["players"], "target_season": cfg["ingestion"]["target_season"]})


def _fq(con, name: str) -> str:
    """Snowflakessa täysi nimi (DML ei luota hakupolkuun), DuckDB:ssä paljas."""
    if not isinstance(con, ActiveSession):
        return name
    from .snowflake_sync import RAW_TABLES, _cfg
    c = _cfg()
    return f"{c['database']}.{c['raw_schema'] if name in RAW_TABLES else c['model_schema']}.{name.upper()}"


def _state_table(con) -> str:
    return "LIIGA.CODE.PIPELINE_STATE" if isinstance(con, ActiveSession) else "pipeline_state"


def read_state(con) -> dict[str, str]:
    t = _state_table(con)
    execute(con, f"CREATE TABLE IF NOT EXISTS {t} (name VARCHAR, fingerprint VARCHAR, updated_at VARCHAR, note VARCHAR)")
    df = query_df(con, f"SELECT name, fingerprint FROM {t}")
    return dict(zip(df["name"], df["fingerprint"]))


def write_state(con, name: str, fp: str, note: str) -> None:
    # Arvot ovat tämän moduulin vakioita ja heksaa, eivät syötettä.
    t = _state_table(con)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    execute(con, f"DELETE FROM {t} WHERE name = '{name}'")
    execute(con, f"INSERT INTO {t} VALUES ('{name}', '{fp}', '{now}', '{note}')")


def _load(con, table: str) -> int:
    if table == "coaching_changes":
        from .coaching import load_coaching_changes
        return len(load_coaching_changes(con))
    if table == "raw_goalie_seasons":
        from .goalies import load_goalie_seasons
        return len(load_goalie_seasons(con))
    df = pd.read_csv(resolve_path(CSV_TABLES[table]), comment="#")
    register_df(con, table, df)
    return len(df)


def rebuild_rates(con) -> dict[str, int]:
    """Sama kuin rosterityössä (roster_queue.py: build_rosters_from_article(); build_player_rates())."""
    from .players import build_player_rates, compute_liiga_rates
    from .transfers import build_rosters_from_article
    roster = build_rosters_from_article()
    liiga = compute_liiga_rates(con)                 # con annettu -> kirjoittaa player_rates_liiga
    rates = build_player_rates()
    return {"roster_2026_27": len(roster), "player_rates_liiga": len(liiga), "player_rates": len(rates)}


def append_missing_bios(con) -> int:
    """Puuttuvat pelaajat player_bioon game_lineupsin viimeisimmästä ottelusta (ei uusia API-kutsuja)."""
    bio, lineups = _fq(con, "player_bio"), _fq(con, "game_lineups")
    before = int(query_df(con, f"SELECT COUNT(*) AS n FROM {bio}")["n"].iloc[0])
    execute(con, f"""
        INSERT INTO {bio} (player_id, season, first_name, last_name, date_of_birth, position_group, role, nationality)
        SELECT player_id, season, first_name, last_name, date_of_birth, position_group, role, nationality FROM (
            SELECT player_id, season, first_name, last_name, date_of_birth, position_group, role, nationality,
                   ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY season DESC, game_id DESC) AS rn
            FROM {lineups} WHERE player_id IS NOT NULL) x
        WHERE rn = 1 AND player_id NOT IN (SELECT player_id FROM {bio} WHERE player_id IS NOT NULL)""")
    return int(query_df(con, f"SELECT COUNT(*) AS n FROM {bio}")["n"].iloc[0]) - before


def sync(con) -> dict[str, str]:
    """Päivän ajo: lataa muuttuneet, täydentää bion, laskee pelaajamallin vain rosterin muuttuessa."""
    state = read_state(con)
    out: dict[str, str] = {}
    for table, f in {**CSV_TABLES, **LOADER_FILES}.items():
        fp = fingerprint([f])
        if table not in state:
            write_state(con, table, fp, "adopted")
            out[table] = "adopted"
        elif state[table] != fp:
            n = _load(con, table)
            write_state(con, table, fp, f"loaded {n}")
            out[table] = f"loaded {n}"
    out["player_bio"] = f"+{append_missing_bios(con)}"
    fp = _rate_fingerprint()
    if RATES not in state:
        write_state(con, RATES, fp, "adopted")
        out[RATES] = "adopted"
    elif state[RATES] != fp:
        n = rebuild_rates(con)
        write_state(con, RATES, fp, json.dumps(n))
        out[RATES] = f"rebuilt {n}"
    return out
