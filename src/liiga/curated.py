"""Kuratoidut lähdetaulut ja pelaajamalli Snowflakessa (22.11.2026, ennen Macin aamusynkka).

LIIGA_DAILY_RUN (daily.py) lataa taulut koodibundlen data/-tiedostoista (gitistä, deploy_bundle.py).
Omistaja on sama kuin muulla putkella (LIIGA_ADMIN). Tila: LIIGA.CODE.PIPELINE_STATE.

Kirjoitus (23.11.2026, katselmointi M1/M2): olemassa olevaan tauluun tilapäistaulun kautta yhdessä
transaktiossa DELETE + INSERT ja tilarivin MERGE, joten oikeudet, kommentit ja NOT NULL -rajoitteet säilyvät
eikä kesken jäänyt ajo jätä taulua ja tilaa ristiriitaan. Pelaajamallin neljä taulua vaihtuvat samassa
transaktiossa (compute_rates laskee ensin kaikki muistiin).

Milloin kirjoitetaan (sormenjälki = sha256 tiedostosta):
  - CSV- ja jäsennystaulut: tiedoston sormenjälki muuttui tai tila on 'force' -> lataus.
  - Tilarivi puuttuu: ennen ensimmäistä alustusta (__initialized__-rivi puuttuu) taulun SISÄLTÖ verrataan
    tiedostoon: sama -> 'adopted', eri -> poikkeama PIPELINE_CHECKSiin ja lataus. Alustuksen jälkeen
    puuttuva rivi tarkoittaa aina latausta, ei koskaan omaksumista.
  - Alustuksen yhteydessä myös jo omaksutut taulut tarkistetaan sisällöltä kerran (22.11. omaksuminen
    jäädytti vanhentuneet league_factors, raw_external_player_seasons ja raw_goalie_seasons).
  - Pelaajamalli (roster_2026_27, player_rates, player_rates_unified, player_rates_liiga): VAIN kun rosterin
    syötteet muuttuvat (RATE_FILES + config players). Sisältötarkistus ei koske sitä: pelaajamallin ero
    (hyväksytty kertaluonteinen siirtymä, docs/claude/snowflake.md) tulee käyttöön seuraavassa rosteri-PR:ssä.
Ennusteen laskenta lukee league_factors-, external_players- ja goalies-tiedostot suoraan, ei näitä tauluja,
joten taulujen lataus gitistä ei muuta ennusteen lukuja.
player_bio: puuttuvat pelaajat ja puuttuvat kentät täydennetään game_lineupsista (MAX_BY uusimman ottelun
arvosta, jossa kenttä on annettu), vanhoja arvoja ei muuteta. 0 lisäkutsua liiga.fi:hin.
"""
from __future__ import annotations

import contextlib
import hashlib
import json
from datetime import datetime, timezone

import pandas as pd

from .config import load_config, resolve_path
from .db import ActiveSession, execute, query_df, register_df

# taulu -> tiedosto (data/). Luetaan sellaisenaan.
CSV_TABLES = {
    "league_factors": "data/league_factors.csv",
    "raw_external_player_seasons": "data/external_players.csv",
    "preseason_player_rates": "data/preseason_player_rates.csv",
    "roster_impact": "data/roster_impact.csv",     # rosterityö (scripts/local/roster_impact.py) commitoi
}
# Omat lukijat (validointi tai jäsennys).
LOADER_FILES = {"coaching_changes": "data/coaching_changes.csv", "raw_goalie_seasons": "data/goalies_raw.txt"}
# Rosterin syötteet = tiedostot, jotka build_rosters_from_article + compute_liiga_rates + build_player_rates
# lukevat. Mitattu 23.11.2026 (open/read_csv-jäljitys): täsmälleen nämä kolme. Ei mukana: rosters_2026_27.csv
# (vain rosters.build_rosters, jota putki ei aja), goalies_raw.txt (maalivahdit, ei pelaajamalli; oma taulu).
RATE_FILES = ["data/transfers_2026_27.txt", "data/external_players.csv", "data/league_factors.csv"]
RATES = "player_rates"           # tilarivin nimi pelaajamallille
RATE_TABLES = ["roster_2026_27", "player_rates_liiga", "player_rates_unified", "player_rates"]
SENTINEL = "__initialized__"


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


def content_digest(df: pd.DataFrame) -> str:
    """Sisällön tiiviste riippumatta rivijärjestyksestä, sarakkeiden kirjainkoosta ja numerotyypistä."""
    d = df.copy()
    d.columns = [c.lower() for c in d.columns]
    d = d[sorted(d.columns)]
    rows = []
    for r in d.itertuples(index=False):
        vals = []
        for v in r:
            if v is None or (isinstance(v, float) and pd.isna(v)):
                vals.append("")
            elif isinstance(v, bool):
                vals.append(str(v))
            elif isinstance(v, (int, float)) or hasattr(v, "item"):
                try:
                    vals.append(f"{float(v):.9g}")
                except (TypeError, ValueError):
                    vals.append(str(v))
            else:
                vals.append(str(v))
        rows.append(tuple(vals))
    return hashlib.sha256(repr(sorted(rows)).encode()).hexdigest()[:16]


def _fq(con, name: str) -> str:
    """Snowflakessa täysi nimi (DML ei luota hakupolkuun), DuckDB:ssä paljas."""
    if not isinstance(con, ActiveSession):
        return name
    from .snowflake_sync import RAW_TABLES, _cfg
    c = _cfg()
    return f"{c['database']}.{c['raw_schema'] if name in RAW_TABLES else c['model_schema']}.{name.upper()}"


def _state_table(con) -> str:
    return "LIIGA.CODE.PIPELINE_STATE" if isinstance(con, ActiveSession) else "pipeline_state"


def _checks_table(con) -> str:
    return "LIIGA.CODE.PIPELINE_CHECKS" if isinstance(con, ActiveSession) else "pipeline_checks"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _ensure_state(con) -> str:
    t = _state_table(con)
    execute(con, f"CREATE TABLE IF NOT EXISTS {t} (name VARCHAR, fingerprint VARCHAR, updated_at VARCHAR, note VARCHAR)")
    return t


def read_state(con) -> dict[str, str]:
    t = _ensure_state(con)
    df = query_df(con, f"SELECT name, fingerprint FROM {t}")
    return dict(zip(df["name"], df["fingerprint"]))


def _state_sql(con, name: str, fp: str, note: str) -> str:
    # Arvot ovat tämän moduulin vakioita, heksaa ja json.dumpsin lukuja, eivät ulkoista syötettä.
    note = note.replace("'", "")
    return (f"MERGE INTO {_state_table(con)} t USING (SELECT '{name}' AS name, '{fp}' AS fingerprint, "
            f"'{_now()}' AS updated_at, '{note}' AS note) s ON t.name = s.name "
            "WHEN MATCHED THEN UPDATE SET fingerprint = s.fingerprint, updated_at = s.updated_at, note = s.note "
            "WHEN NOT MATCHED THEN INSERT (name, fingerprint, updated_at, note) "
            "VALUES (s.name, s.fingerprint, s.updated_at, s.note)")


def write_state(con, name: str, fp: str, note: str) -> None:
    _ensure_state(con)
    execute(con, _state_sql(con, name, fp, note))


def log_check(con, table: str, rows_new: int, digest: str, rows_current: int, status: str, detail: str,
              check_name: str = "curated_drift") -> None:
    t = _checks_table(con)
    ts = "TIMESTAMP_LTZ" if isinstance(con, ActiveSession) else "TIMESTAMPTZ"
    execute(con, f"""CREATE TABLE IF NOT EXISTS {t} (checked_at {ts}, check_name VARCHAR, table_name VARCHAR,
        rows_new BIGINT, digest VARCHAR, rows_current BIGINT, status VARCHAR, detail VARCHAR)""")
    detail = detail.replace("'", "")[:2000]
    execute(con, f"INSERT INTO {t} SELECT CURRENT_TIMESTAMP, '{check_name}', '{table}', {int(rows_new)}, "
                 f"'{digest}', {int(rows_current)}, '{status}', '{detail}'")


def _table_exists(con, name: str) -> bool:
    try:
        query_df(con, f"SELECT 1 AS x FROM {_fq(con, name)} LIMIT 0")
        return True
    except Exception:                                    # noqa: BLE001 -- ei taulua
        return False


def _stage(con, name: str, df: pd.DataFrame) -> str:
    """DataFrame tilapäistauluksi samaan skeemaan; palauttaa nimen. Ei koske kohdetauluun."""
    out = df.copy()
    out.columns = [c.upper() for c in out.columns]
    tmp = f"TMP_CURATED_{name.upper()}"
    if isinstance(con, ActiveSession):
        fq = _fq(con, name)
        db, schema = fq.split(".")[0], fq.split(".")[1]
        con.session.write_pandas(out, tmp, auto_create_table=True, overwrite=True, table_type="temporary",
                                 database=db, schema=schema)
        return f"{db}.{schema}.{tmp}"
    con.register(f"_df_{tmp}", out)
    con.execute(f'CREATE OR REPLACE TEMP TABLE "{tmp}" AS SELECT * FROM "_df_{tmp}"')
    con.unregister(f"_df_{tmp}")
    return f'"{tmp}"'


def replace_tables(con, frames: dict[str, pd.DataFrame], state: list[tuple[str, str, str]]) -> None:
    """Taulujen sisältö ja tilarivit yhdessä transaktiossa (DELETE + INSERT, ei DDL:ää kohteisiin).
    Puuttuva taulu luodaan ennen transaktiota register_dfillä (ensimmäinen kerta)."""
    staged: dict[str, str] = {}
    for name, df in frames.items():
        if not _table_exists(con, name):
            register_df(con, name, df.iloc[0:0])
        staged[name] = _stage(con, name, df)
    execute(con, "BEGIN")
    try:
        for name, df in frames.items():
            cols = ", ".join(f'"{c.upper()}"' for c in df.columns)
            target = _fq(con, name)
            execute(con, f"DELETE FROM {target}")
            execute(con, f"INSERT INTO {target} ({cols}) SELECT {cols} FROM {staged[name]}")
        for name, fp, note in state:
            execute(con, _state_sql(con, name, fp, note))
        execute(con, "COMMIT")
    except Exception:
        execute(con, "ROLLBACK")
        raise


def frame(con, table: str) -> pd.DataFrame:
    """Taulun sisältö tiedostosta (ei kirjoitusta)."""
    if table == "coaching_changes":
        from .coaching import read_coaching_changes
        return read_coaching_changes(con)
    if table == "raw_goalie_seasons":
        from .goalies import parse_goalie_seasons
        return parse_goalie_seasons()
    return pd.read_csv(resolve_path(CSV_TABLES[table]), comment="#")


@contextlib.contextmanager
def captured():
    """Kaappaa transfers- ja players-moduulien register_df-kirjoitukset muistiin (ei tauluihin). Roster luetaan
    kaapatusta, kuten oikeassa ajossa uusi roster olisi jo taulussa (build_player_rates lukee sen taulusta)."""
    from . import players, transfers
    out: dict[str, pd.DataFrame] = {}
    saved = (transfers.register_df, players.register_df, players.query_df)
    orig_query = players.query_df

    def _query(con, sql, *a, **k):
        if sql.strip() == "SELECT * FROM roster_2026_27" and "roster_2026_27" in out:
            df = out["roster_2026_27"].copy()
            df.columns = [c.lower() for c in df.columns]
            return df
        return orig_query(con, sql, *a, **k)

    def _cap(con, name, df):
        out[name] = df.copy()

    transfers.register_df = players.register_df = _cap
    players.query_df = _query
    try:
        yield out
    finally:
        transfers.register_df, players.register_df, players.query_df = saved


def compute_rates(con) -> dict[str, pd.DataFrame]:
    """Sama laskenta kuin rosterityössä (build_rosters_from_article; compute_liiga_rates; build_player_rates),
    tulokset muistiin. Kirjoitus vasta replace_tablesissa, kaikki neljä samassa transaktiossa."""
    from .players import build_player_rates, compute_liiga_rates
    from .transfers import build_rosters_from_article
    with captured() as out:
        build_rosters_from_article()
        compute_liiga_rates(con)
        build_player_rates()
    missing = [t for t in RATE_TABLES if t not in out]
    if missing:
        raise RuntimeError(f"pelaajamallin laskenta ei tuottanut tauluja: {missing}")
    return {t: out[t] for t in RATE_TABLES}


def append_missing_bios(con) -> int:
    """Puuttuvat pelaajat player_bioon ja puuttuvat kentät täydennetään game_lineupsista: kunkin kentän arvo
    uusimmasta ottelusta, jossa se on annettu (MAX_BY ohittaa NULLin). Olemassa olevia arvoja ei muuteta."""
    bio, lineups = _fq(con, "player_bio"), _fq(con, "game_lineups")
    cols = ["first_name", "last_name", "date_of_birth", "position_group", "role", "nationality"]
    latest = ", ".join(f"MAX_BY({c}, CASE WHEN {c} IS NOT NULL THEN season * 100000000 + game_id END) AS {c}" for c in cols)
    src = f"SELECT player_id, MAX(season) AS season, {latest} FROM {lineups} WHERE player_id IS NOT NULL GROUP BY player_id"
    before = int(query_df(con, f"SELECT COUNT(*) AS n FROM {bio}")["n"].iloc[0])
    execute(con, f"""
        INSERT INTO {bio} (player_id, season, {', '.join(cols)})
        SELECT player_id, season, {', '.join(cols)} FROM ({src}) x
        WHERE player_id NOT IN (SELECT player_id FROM {bio} WHERE player_id IS NOT NULL)""")
    added = int(query_df(con, f"SELECT COUNT(*) AS n FROM {bio}")["n"].iloc[0]) - before
    fill = " OR ".join(f"b.{c} IS NULL" for c in cols)
    sets = ", ".join(f"{c} = COALESCE(b.{c}, x.{c})" for c in cols)
    if isinstance(con, ActiveSession):
        execute(con, f"UPDATE {bio} b SET {sets} FROM ({src}) x WHERE b.player_id = x.player_id AND ({fill})")
    else:
        sets_dk = ", ".join(f"{c} = COALESCE({bio}.{c}, x.{c})" for c in cols)
        fill_dk = " OR ".join(f"{bio}.{c} IS NULL" for c in cols)
        execute(con, f"UPDATE {bio} SET {sets_dk} FROM ({src}) x WHERE {bio}.player_id = x.player_id AND ({fill_dk})")
    return added


def _live_digest(con, table: str) -> tuple[str, int]:
    try:
        df = query_df(con, f"SELECT * FROM {_fq(con, table)}")
    except Exception:                                    # noqa: BLE001 -- ei taulua
        return "", 0
    return content_digest(df), len(df)


def _table_action(con, table: str, fp: str, cur: str | None, initialized: bool) -> tuple[str, pd.DataFrame | None]:
    """Mitä taululle tehdään: ('', None) = ei mitään, ('adopted', None) = tilarivi kirjataan, muuten syy + data."""
    if cur is not None and cur == fp and initialized:
        return "", None
    df = frame(con, table)
    if cur is not None and cur not in (fp, "force"):
        return "file changed", df
    if cur == "force":
        return "forced", df
    if initialized:
        return "state row missing", df             # alustuksen jälkeen puuttuva rivi = lataus
    live, n_live = _live_digest(con, table)
    new = content_digest(df)
    if live == new:
        return ("adopted", None) if cur is None else ("", None)
    log_check(con, table, len(df), new, n_live, "DRIFT", f"live {live} != git {new}; loading from git")
    return "drift", df


def inputs_loaded(out: dict[str, str]) -> list[str]:
    """sync()-tuloksesta taulut, joiden sisältö kirjoitettiin tällä ajolla (lataus tai pelaajamallin uudelleenlaskenta)."""
    return sorted(t for t, v in out.items() if str(v).startswith(("loaded", "rebuilt")))


def forecast_diff(before: pd.DataFrame | None, after: pd.DataFrame) -> pd.DataFrame:
    """Joukkueittainen ennusteen muutos (katselmointi M4): pisteet ja pudotuspelitodennäköisyys ennen ja jälkeen."""
    cols = ["team", "mean_points", "p_top_playoff", "proj_rank"]
    a = after[cols].copy()
    if before is None or before.empty:
        b = a.assign(mean_points=float("nan"), p_top_playoff=float("nan"), proj_rank=float("nan"))
    else:
        b = before[[c for c in cols if c in before.columns]].copy()
    x = b.merge(a, on="team", how="outer", suffixes=("_before", "_after"))
    x["d_points"] = (x["mean_points_after"] - x["mean_points_before"]).round(3)
    x["d_playoff_pp"] = ((x["p_top_playoff_after"] - x["p_top_playoff_before"]) * 100).round(2)
    return x.sort_values("team").reset_index(drop=True)


def log_forecast_diff(con, loaded: list[str], diff: pd.DataFrame, games_before: int, games_after: int) -> None:
    """Syötteen latauksen jälkeen joka joukkueen ennen/jälkeen PIPELINE_CHECKSiin (check_name forecast_input_diff).
    games_* kertoo, tuliko välissä myös uusia otteluita (silloin muutos ei ole pelkästään syötteistä)."""
    tag = ",".join(loaded)[:200]
    for r in diff.itertuples():
        detail = (f"pisteet {r.mean_points_before:.2f} -> {r.mean_points_after:.2f} ({r.d_points:+.2f}), "
                  f"pudotuspelit {r.p_top_playoff_before:.4f} -> {r.p_top_playoff_after:.4f} ({r.d_playoff_pp:+.2f} pp), "
                  f"syötteet: {tag}, ottelut {games_before} -> {games_after}")
        status = "UNCHANGED" if (abs(r.d_points) < 0.005 and abs(r.d_playoff_pp) < 0.005) else "CHANGED"
        log_check(con, str(r.team), int(games_after), tag, int(games_before), status, detail,
                  check_name="forecast_input_diff")


def sync(con) -> dict[str, str]:
    """Päivän ajo: lataa muuttuneet, täydentää bion, laskee pelaajamallin vain rosterin muuttuessa."""
    state = read_state(con)
    initialized = SENTINEL in state
    out: dict[str, str] = {}
    for table, f in {**CSV_TABLES, **LOADER_FILES}.items():
        fp = fingerprint([f])
        reason, df = _table_action(con, table, fp, state.get(table), initialized)
        if reason == "adopted":
            write_state(con, table, fp, "adopted (content equal)")
            out[table] = "adopted"
        elif df is not None:
            replace_tables(con, {table: df}, [(table, fp, f"loaded {len(df)} ({reason})")])
            out[table] = f"loaded {len(df)} ({reason})"
    out["player_bio"] = f"+{append_missing_bios(con)}"
    fp = _rate_fingerprint()
    cur = state.get(RATES)
    if cur is None and not initialized:
        write_state(con, RATES, fp, "adopted")
        out[RATES] = "adopted"
    elif cur != fp:
        frames = compute_rates(con)
        note = json.dumps({t: len(d) for t, d in frames.items()})
        replace_tables(con, frames, [(RATES, fp, note)])
        out[RATES] = f"rebuilt {note}"
    if not initialized:
        write_state(con, SENTINEL, "1", "curated.sync alustettu")
    return out


def fingerprints(con) -> dict[str, str]:
    """Syötteiden sormenjäljet (PREDICTION_META.input_fingerprints): mitkä tiedostoversiot ennuste näki."""
    return {k: v[:16] for k, v in read_state(con).items() if k != SENTINEL}
