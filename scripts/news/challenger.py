"""Uutishaastaja: päivän otteluiden ennuste, kun tiedetään poissaolot ja aloittava
maalivahti (27.10.2026; docs/uutismalli_suunnitelma.md, vaihe 3).

Ajetaan klo 14 -ajon lopussa (news.yml) ja jokaisen OK-painalluksen jälkeen
(absence.yml). Lukittu malli ei muutu (AGENTS.md §10): haastaja kirjataan
erikseen prediction_games_news.csv:hen ennen ottelua, ja sovellus vertaa niitä
lukittuun malliin pelattujen otteluiden log-lossilla.

Perusta = Pagesin aamun ennuste (pages-data/prediction_games.csv). Muutokset:
- Poissaolot: hyväksytyt (absences/, OK-nappi) + liiga.fi:n pelikiellot
  (kokoonpanon `suspended`). Pelaaja, joka on päivän kokoonpanossa, ei ole
  poissa. Vaikutus skenaariotyökalun apply_injuries-funktiolla (sama kuin
  agentin liiga_skenaario): Poisson-osan muutos painolla 0,4.
- Aloittava maalivahti: taso (pelastetut maalit yli odotetun / ottelu, vain
  aiemmilta kausilta) - joukkueen kauden aiempien aloittajien keskitaso ->
  vastustajan maaliodottama. Menetelmä ja paino scripts/experiments/
  starting_goalie.py:n historiatestistä (GOALIE_WEIGHT alla).

    python scripts/news/challenger.py NEWSDIR PAGESDIR [YYYY-MM-DD]
"""
from __future__ import annotations

import csv
import datetime as dt
import importlib.util
import sys
from pathlib import Path
from zoneinfo import ZoneInfo

import duckdb

sys.path.insert(0, str(Path(__file__).resolve().parent))
import absences  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
LEVELS = ROOT / "data" / "goalie_levels_2027.csv"
FIELDS = ["snapshot_date", "game_id", "home_team", "away_team", "base_p_home_win",
          "p_home_reg", "p_away_reg", "p_overtime", "p_home_win", "notes"]

_spec = importlib.util.spec_from_file_location(
    "simulate_scenario", ROOT / "snowflake/LIIGA/MODEL/procedures/SIMULATE_SCENARIO/simulate_scenario.py")
sim = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sim)

# Maalivahtimuutoksen paino ensembleen: vain Poisson-osa (0,4), kuten poissaoloissa.
# Historiatesti 27.10. (starting_goalie.py, esikauden taso, n0 = 20, 1 999 ottelua
# 2023-2027): Poisson-osa log-loss -0,0006 ± 0,0003 (t = -2,15); koko ensembleen
# -0,0012 ± 0,0007 (t = -1,66). Pienempi mutta erottuva valittiin.
GOALIE_WEIGHT = sim.POISSON_WEIGHT


def _read(path: Path) -> list[dict]:
    return list(csv.DictReader(path.open(encoding="utf-8"))) if path.exists() else []


def _model(con) -> dict:
    players = con.execute("SELECT name, team, position_group, projected_goals_per_game FROM player_rates").df()
    goalies = con.execute("SELECT team, name, proj_save_pct, wt FROM team_goalie_weights").df()
    goalies["proj_save_pct"] = goalies["proj_save_pct"].astype(object).where(goalies["proj_save_pct"].notna(), None)
    strength = {t: {"off_rating": o, "def_rating": d}
                for t, o, d in con.execute("SELECT team, off_rating, def_rating FROM team_strength").fetchall()}
    return {"players": players.to_dict("records"), "goalies": goalies.to_dict("records"), "strength": strength}


def _base(pages: Path, day: str, ids: set[str]) -> dict[str, dict]:
    rows = [r for r in _read(pages / "prediction_games.csv") if r["game_id"] in ids and r["snapshot_date"] <= day]
    snap = max((r["snapshot_date"] for r in rows), default=None)
    return {r["game_id"]: r for r in rows if r["snapshot_date"] == snap}


REGULAR_LAST, REGULAR_MIN = 10, 7          # vakiopelaaja: kokoonpanossa 7 joukkueen 10 edellisestä


def _missing_regulars(con, news: Path, day: str, lineup: list[dict]) -> list[str]:
    """Kenttäpelaajat, jotka ovat pelanneet vakituisesti mutta puuttuvat päivän
    valmiista kokoonpanosta (käyttäjä 27.10.: automaattisesti, ilman uutista).
    Vain tämän päivän otteluun: kestoa ei tiedetä, ja seuraava kokoonpano kertoo taas."""
    ready = {r["team"] for r in lineup if r["line"] not in ("", None)}
    if not ready:
        return []
    games = _recent_lineups(con, news, day)
    playing = {f"{r['first_name']} {r['last_name']}" for r in lineup if r["line"] not in ("", None)}
    missing = []
    for team in ready:
        last = [games[team][k] for k in sorted(games.get(team, {}))[-REGULAR_LAST:]]
        counts: dict[str, int] = {}
        for g in last:
            for n in g:
                counts[n] = counts.get(n, 0) + 1
        missing += [n for n, c in counts.items() if c >= REGULAR_MIN and n not in playing]
    return sorted(missing)


def _recent_lineups(con, news: Path, day: str) -> dict[str, dict[str, set[str]]]:
    """Joukkue -> ottelu (päivä|id) -> kokoonpanon kenttäpelaajat ennen päivää `day`."""
    games: dict[str, dict[str, set[str]]] = {}
    for team, gid, d, name in con.execute("""
            SELECT l.team, CAST(l.game_id AS VARCHAR), SUBSTR(g.start_ts, 1, 10), l.first_name || ' ' || l.last_name
            FROM game_lineups l JOIN stg_games g ON g.season = l.season AND g.game_id = l.game_id
            WHERE l.season = (SELECT MAX(season) FROM stg_games) AND l.line IS NOT NULL AND l.position_group <> 'G'
              AND SUBSTR(g.start_ts, 1, 10) < ?""", [day]).fetchall():
        games.setdefault(team, {}).setdefault(f"{d}|{gid}", set()).add(name)
    dates = {r["game_id"]: r["date"] for r in _read(news / "lineup_games.csv")}
    for r in _read(news / "lineup_players.csv"):
        d = dates.get(r["game_id"], "")
        if d and d < day and r["line"] and r["role"] != "MV":
            games.setdefault(r["team"], {}).setdefault(f"{d}|{r['game_id']}", set()).add(f"{r['first_name']} {r['last_name']}")
    return games


def _absent(news: Path, day: str, game_ids: set[str], con=None) -> tuple[list[str], list[str], list[str]]:
    """(kirjatut poissaolijat, pelikiellossa olevat, puuttuvat vakiopelaajat) päivän otteluista.

    Todellisuus voittaa arvion (käyttäjä 27.10.): jos poissaolevaksi kirjattu
    pelaaja on päivän kokoonpanossa, kirjataan paluu itse (url "kokoonpano"),
    jolloin myös kausiennuste lopettaa poissaolon."""
    lineup = [r for r in _read(news / "lineup_players.csv") if r["game_id"] in game_ids]
    latest = max((r["fetched_at"] for r in lineup), default="")
    lineup = [r for r in lineup if r["fetched_at"] == latest]
    playing = {f"{r['first_name']} {r['last_name']}" for r in lineup if r["line"] not in ("", None)}
    now = dt.datetime.now(dt.UTC).isoformat(timespec="seconds")
    approved = []
    for r in absences.active(news, day):
        if r["player"] in playing:
            absences.write(news, {"approved_at": now, "url": "kokoonpano", "player": r["player"], "team": r["team"],
                                  "kind": "back", "games": "", "start": day, "until": day})
            print(f"{r['player']} on kokoonpanossa: poissaolo päättyi ({r['games']} kirjattu {r['start']})")
        else:
            approved.append(r["player"])
    suspended = [f"{r['first_name']} {r['last_name']}" for r in lineup if r["suspended"] == "1"]
    missing = _missing_regulars(con, news, day, lineup) if con is not None else []
    known = set(approved) | set(suspended)
    return sorted(set(approved)), sorted(set(suspended) - set(approved)), [m for m in missing if m not in known]


def _is_starter(r: dict) -> bool:
    return r["role"] == "MV" and r["line"] == "1"


def _previous_starters(con, news: Path, day: str) -> dict[str, list[str]]:
    """Joukkueen kauden aiemmat aloittajat: game_goalies (repon kanta) + kokoonpanot
    ennen tätä päivää (news-data), sama aloitus kerran."""
    prev: dict[str, list[str]] = {}
    for team, pid in con.execute("""SELECT team, CAST(player_id AS VARCHAR) FROM game_goalies
                                    WHERE season = 2027 AND started""").fetchall():
        prev.setdefault(team, []).append(pid)
    seen = {(t, p) for t, ps in prev.items() for p in ps}
    games = {r["game_id"]: r for r in _read(news / "lineup_games.csv")}
    for r in _read(news / "lineup_players.csv"):
        g = games.get(r["game_id"])
        if g and g["date"] < day and _is_starter(r) and (r["team"], r["player_id"]) not in seen:
            prev.setdefault(r["team"], []).append(r["player_id"])
    return prev


def _goalie_diffs(con, news: Path, day: str, game_ids: set[str]) -> tuple[dict[tuple[str, str], float], dict]:
    """(game_id, joukkue) -> aloittajan taso - joukkueen kauden aiempien aloittajien keskitaso."""
    levels = {r["player_id"]: float(r["level"]) for r in _read(LEVELS)}
    if not levels:
        return {}, {}
    prev = _previous_starters(con, news, day)
    lineup = [r for r in _read(news / "lineup_players.csv") if r["game_id"] in game_ids]
    latest = max((r["fetched_at"] for r in lineup), default="")
    diffs, names = {}, {}
    for r in (r for r in lineup if r["fetched_at"] == latest and _is_starter(r)):
        own = levels.get(r["player_id"], 0.0)
        team_prev = [levels.get(p, 0.0) for p in prev.get(r["team"], [])]
        d = own - (sum(team_prev) / len(team_prev) if team_prev else own)
        diffs[(r["game_id"], r["team"])] = d
        names[(r["game_id"], r["team"])] = f"{r['last_name']} {d:+.2f}"
    return diffs, names


def _apply_goalies(g: dict, strength: dict, d_home: float, d_away: float) -> dict:
    """Aloittajien ero -> vastustajien maaliodottamat -> todennäköisyysmuutos."""
    h, a = strength[g["home_team"]], strength[g["away_team"]]
    lh = sim.LEAGUE_AVG * h["off_rating"] * a["def_rating"] * sim.HOME_ICE
    la = sim.LEAGUE_AVG * a["off_rating"] * h["def_rating"]
    o = sim._poisson(lh, la)
    n = sim._poisson(max(0.2, lh - d_away), max(0.2, la - d_home))
    w = GOALIE_WEIGHT
    hreg = max(0.0, g["p_home_reg"] + w * (n[0] - o[0]))
    ot = max(0.0, g["p_overtime"] + w * (n[2] - o[2]))
    areg = max(0.0, 1 - g["p_home_reg"] - g["p_overtime"] + w * (n[1] - o[1]))
    tot = hreg + ot + areg
    return {**g, "p_home_reg": hreg / tot, "p_overtime": ot / tot,
            "p_home_ot_win": min(1.0, max(0.0, g["p_home_ot_win"] + w * (n[3] - o[3])))}


def _todays_base(news: Path, pages: Path, day: str, now: dt.datetime) -> dict[str, dict]:
    """Päivän alkamattomat ottelut aamun ennusteineen. Ennuste ottelun jo alettua
    vääristäisi A/B-vertailun (OK-nappia voi painaa illalla otteluiden aikana)."""
    todays = {r["game_id"] for r in _read(news / "lineup_games.csv")
              if r["date"] == day and dt.datetime.fromisoformat(r["start"].replace("Z", "+00:00")) > now}
    return _base(pages, day, todays)


# Huomion syy kerran, sitten pelaajat, ja joukkue näkyviin (käyttäjä 31.10.):
# "Axel Skinnari puuttuu kokoonpanosta; Balazs Sebok puuttuu kokoonpanosta; ..."
# toisti syyn turhaan eikä kertonut kummalta joukkueelta pelaajat puuttuvat.
# Syy kerran, sitten joukkueittain: "Puuttuu kokoonpanosta: Ilves – A, B · KalPa – C".
# Koti ensin. "·" erottaa joukkueet, "; " huomiot (sovellus jakaa rivit sillä).
# Järjestys on sama kuin ennen: kirjatut poissaolot, pelikiellot, puuttuvat vakiopelaajat.
TAGS = ("poissa", "pelikielto", "puuttuu kokoonpanosta")
LABELS = {"poissa": "Poissa", "pelikielto": "Pelikielto", "puuttuu kokoonpanosta": "Puuttuu kokoonpanosta"}


def _absence_items(names: list[str], suspended: list[str], model: dict, games: list[dict],
                   missing: list[str] = ()) -> tuple[list[dict], dict]:
    """Poissaolijat skenaariotyökalun muotoon + huomiot otteluittain (syy -> pelaajat)."""
    items, notes = [], {}
    for name in names:
        try:
            p = sim.find_player(name, model["players"], model["goalies"])
        except sim.ScenarioError as e:
            print(f"ohitettu: {e}")
            continue
        items.append({"injury": p["name"]})
        tag = "pelikielto" if name in suspended else "puuttuu kokoonpanosta" if name in missing else "poissa"
        for g in games:
            if p["team"] in (g["home_team"], g["away_team"]):
                notes.setdefault(g["game_id"], {}).setdefault(tag, {}).setdefault(p["team"], []).append(p["name"])
    return items, notes


def _absence_notes(by_tag: dict[str, dict[str, list[str]]], home: str, away: str) -> list[str]:
    """{"puuttuu kokoonpanosta": {"Ilves": ["A", "B"], "KalPa": ["C"]}} ->
    ["Puuttuu kokoonpanosta: Ilves – A, B · KalPa – C"]."""
    out = []
    for t in TAGS:
        teams = [f"{team} – {', '.join(by_tag[t][team])}"
                 for team in (home, away) if by_tag.get(t, {}).get(team)]
        if teams:
            out.append(f"{LABELS[t]}: {' · '.join(teams)}")
    return out


def _row(day: str, g0: dict, g: dict, base: dict, notes: list[str]) -> dict:
    ph = g["p_home_reg"] + g["p_overtime"] * g["p_home_ot_win"]
    return {"snapshot_date": day, "game_id": g0["game_id"], "home_team": g0["home_team"], "away_team": g0["away_team"],
            "base_p_home_win": round(float(base["p_home_win"]), 6), "p_home_reg": round(g["p_home_reg"], 6),
            "p_away_reg": round(1 - g["p_home_reg"] - g["p_overtime"], 6), "p_overtime": round(g["p_overtime"], 6),
            "p_home_win": round(ph, 6), "notes": "; ".join(notes)}


def _write(path: Path, day: str, out: list[dict]) -> None:
    """Päivän uusi ajo korvaa saman päivän aiemman ennusteen vain näille otteluille."""
    redo = {r["game_id"] for r in out}
    keep = [r for r in _read(path) if not (r["snapshot_date"] == day and r["game_id"] in redo)]
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(keep + out)


def main(news: Path, pages: Path, day: str | None = None) -> int:
    now = dt.datetime.now(dt.UTC)
    day = day or now.astimezone(ZoneInfo("Europe/Helsinki")).date().isoformat()
    base = _todays_base(news, pages, day, now)
    if not base:
        print(f"{day}: ei alkamattomia otteluita tai aamun ennustetta")
        return 0
    con = duckdb.connect(str(ROOT / "data" / "liiga.duckdb"), read_only=True)
    try:
        model = _model(con)
        approved, suspended, missing = _absent(news, day, set(base), con)
        diffs, gnames = _goalie_diffs(con, news, day, set(base))
    finally:
        con.close()

    games = [{"game_id": gid, "date": day, "iso": day, "home_team": b["home_team"], "away_team": b["away_team"],
              "p_home_reg": float(b["p_home_reg"]), "p_overtime": float(b["p_overtime"]),
              "p_home_ot_win": float(b["p_home_ot_win"])} for gid, b in sorted(base.items())]
    items, notes = _absence_items(approved + suspended + missing, suspended, model, games, missing)
    changed, _ = sim.apply_injuries(items, games, model, day) if items else (games, [])

    out = []
    for g0, g in zip(games, changed):
        keys = [(g0["game_id"], g0[side]) for side in ("home_team", "away_team")]
        if any(diffs.get(k) for k in keys):
            g = _apply_goalies(g, model["strength"], diffs.get(keys[0], 0.0), diffs.get(keys[1], 0.0))
        extra = [f"MV {gnames[k]}" for k in keys if k in gnames]
        absences_ = _absence_notes(notes.get(g0["game_id"], {}), g0["home_team"], g0["away_team"])
        out.append(_row(day, g0, g, base[g0["game_id"]], absences_ + extra))
    _write(news / "prediction_games_news.csv", day, out)
    for r in out:
        print(f"{r['home_team']} – {r['away_team']}: {float(r['base_p_home_win']):.1%} -> {r['p_home_win']:.1%}"
              f"{'  (' + r['notes'] + ')' if r['notes'] else ''}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        sys.exit(__doc__)
    sys.exit(main(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3] if len(sys.argv) == 4 else None))
