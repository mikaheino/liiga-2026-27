"""Pelipäivän kokoonpanot: agentin työkalu `liiga_kokoonpanot` (2026-10-16).

Hakee liiga.fi:stä annetun päivän otteluiden julkaistut kokoonpanot (sama
ottelukohtainen rajapinta, jonka sivu näyttää: /api/v2/games/<kausi>/<id>) ja
laskee kokoonpanokorjatun ennusteen mallin omilla kaavoilla:

  * hyökkäys: joukkueen 18 parhaan PUKEUTUNEEN kenttäpelaajan maalitahti
    (team_strength.team_offense_from_players), muut kuin pukeutuneet pois
  * puolustus: ALOITTAVAN maalivahdin (rivi 1) torjuntaennuste painotetun
    keskiarvon sijaan (goalies.build_team_goaltending)
  * muutos ensemblen Poisson-osaan painolla 0,4 (Elo 0,6 ei tiedä kokoonpanoa)

Tulos 1X2-muodossa (varsinainen peliaika, kuten Pitkäveto) ennen ja jälkeen
korjauksen, maaliodottamat, reilut kertoimet (1 / todennäköisyys), aloittavat
maalivahdit ja ennusteen kannalta merkittävimmät poissaolot.

Pukeutunut = `line` on asetettu; maalivahti rivillä 1 = aloittaja. Täsmäytys
player_id:llä, sitten SUKUNIMELLÄ: liiga.fi käyttää eri etunimimuotoja kuin
sopimuslistat (Matthew/Matt Caito, Jakob/Jacob Crespin -- CLAUDE.md).

Puhdas Python: sama tiedosto ajetaan Snowflaken proseduurina (handler `run`,
external access LIIGA_FI_ACCESS) ja paikallisesti (scripts/kokoonpanot.py).
"""
from __future__ import annotations

import json

import simulate_scenario as sim

API = "https://www.liiga.fi/api/v2/games"
SEASON = 2027


def parse_detail(detail: dict) -> dict:
    """liiga.fi:n ottelu -> {joukkue: {"ids", "lasts", "starter", "published"}}."""
    game = detail.get("game") or {}
    out = {}
    for pk, tk in (("homeTeamPlayers", "homeTeam"), ("awayTeamPlayers", "awayTeam")):
        team = (game.get(tk) or {}).get("teamName")
        dressed = [p for p in detail.get(pk) or [] if p.get("id") is not None and p.get("line") is not None]
        starter = next((p for p in dressed if (p.get("role") or "").upper() == "GOALIE" and p.get("line") == 1), None)
        out[team] = {"ids": {int(p["id"]) for p in dressed},
                     "lasts": {(p.get("lastName") or "").lower() for p in dressed},
                     "starter": f"{starter.get('firstName')} {starter.get('lastName')}" if starter else None,
                     "starter_last": (starter.get("lastName") or "").lower() if starter else None,
                     "published": len(dressed) >= 15}
    return out


def adjust(game: dict, lineup: dict, model: dict) -> dict:
    """Yhden ottelun kokoonpanokorjaus. game: home_team, away_team, p_home_reg,
    p_overtime, p_home_ot_win (uusin ennuste)."""
    players, goalies, strength = model["players"], model["goalies"], model["strength"]
    raw_all = sim._team_offense(players, set())
    scale = sim.LEAGUE_AVG / (sum(raw_all.values()) / len(raw_all))
    d, notes = {}, {}
    for team in (game["home_team"], game["away_team"]):
        lu = lineup.get(team)
        if not lu or not lu["published"]:
            d[team] = (0.0, 0.0)
            notes[team] = {"starter": None, "absent": [], "published": False}
            continue
        roster = [p for p in players if p["team"] == team and p["position_group"] != "G"]
        out = {p["name"] for p in roster
               if not ((p.get("player_id") is not None and p["player_id"] == p["player_id"]
                        and int(p["player_id"]) in lu["ids"])
                       or p["name"].split()[-1].lower() in lu["lasts"])}
        raw_out = sim._team_offense(players, out)
        d_off = (1 - sim.TEAM_WEIGHT) * (raw_out[team] - raw_all[team]) * scale / sim.LEAGUE_AVG
        sname = next((g["name"] for g in goalies
                      if g["team"] == team and g["name"].split()[-1].lower() == lu["starter_last"]), None)
        others = {g["name"] for g in goalies if g["team"] == team and g["name"] != sname}
        d_def = (sim.GOALIE_WEIGHT * (sim._goalie_mult(goalies, team, others)
                                      - sim._goalie_mult(goalies, team, set())) if sname else 0.0)
        absent = sorted((p for p in roster if p["name"] in out), key=lambda p: -p["projected_goals_per_game"])[:3]
        d[team] = (d_off, d_def)
        notes[team] = {"starter": lu["starter"], "published": True,
                       "absent": [(p["name"], p["projected_goals_per_game"]) for p in absent if p["projected_goals_per_game"] >= 0.08],
                       "d_gf": d_off * sim.LEAGUE_AVG, "d_ga": d_def * sim.LEAGUE_AVG}
    h, a = game["home_team"], game["away_team"]
    h0, a0 = strength[h], strength[a]
    lh0 = sim.LEAGUE_AVG * h0["off_rating"] * a0["def_rating"] * sim.HOME_ICE
    la0 = sim.LEAGUE_AVG * a0["off_rating"] * h0["def_rating"]
    lh1 = sim.LEAGUE_AVG * (h0["off_rating"] + d[h][0]) * (a0["def_rating"] + d[a][1]) * sim.HOME_ICE
    la1 = sim.LEAGUE_AVG * (a0["off_rating"] + d[a][0]) * (h0["def_rating"] + d[h][1])
    o, n, w = sim._poisson(lh0, la0), sim._poisson(lh1, la1), sim.POISSON_WEIGHT
    p1_0, px_0 = game["p_home_reg"], game["p_overtime"]
    p2_0 = 1 - p1_0 - px_0
    p1, px, p2 = p1_0 + w * (n[0] - o[0]), px_0 + w * (n[2] - o[2]), p2_0 + w * (n[1] - o[1])
    t = p1 + px + p2
    return {"game": f"{h}–{a}", "time": game.get("time", ""), "before": (p1_0, px_0, p2_0),
            "after": (p1 / t, px / t, p2 / t), "xg": (lh1, la1), "notes": notes,
            "published": all(notes[x]["published"] for x in (h, a))}


def _p(x: float) -> str:
    return f"{x * 100:.1f}".replace(".", ",")


def _o(x: float) -> str:
    return f"{1 / x:.2f}".replace(".", ",") if x > 0 else "–"


def render(rows: list[dict], day: str) -> str:
    if not rows:
        return f"KOKOONPANOT {day}: ei otteluita tälle päivälle."
    L = [f"KOKOONPANOT {day} (liiga.fi) ja kokoonpanokorjattu ennuste, 1X2 = varsinainen peliaika 60 min",
         "Ottelu | 1 % ennen -> nyt | X % ennen -> nyt | 2 % ennen -> nyt | maaliodottama | reilut kertoimet 1 / X / 2"]
    for r in rows:
        b, a = r["before"], r["after"]
        L.append(f"{r['time']} {r['game']} | {_p(b[0])} -> {_p(a[0])} | {_p(b[1])} -> {_p(a[1])} | "
                 f"{_p(b[2])} -> {_p(a[2])} | {r['xg'][0]:.2f}–{r['xg'][1]:.2f}".replace(".", ",")
                 + f" | {_o(a[0])} / {_o(a[1])} / {_o(a[2])}")
    L.append("Kokoonpanot:")
    for r in rows:
        for team, nt in r["notes"].items():
            if not nt["published"]:
                L.append(f"- {team}: kokoonpanoa ei ole vielä julkaistu -- ennuste ilman korjausta")
                continue
            ab = ", ".join(f"{n} ({g:.2f} maalia/ottelu)".replace(".", ",") for n, g in nt["absent"]) or "ei merkittäviä"
            L.append(f"- {team}: maalissa {nt['starter'] or '?'}; poissa ennusteen kannalta: {ab}; "
                     f"odotetut tehdyt {sim._signed(nt['d_gf'], 2)}, päästetyt {sim._signed(nt['d_ga'], 2)}")
    L.append("Reilu kerroin = 1 / todennäköisyys. Korjaus liikuttaa vain mallin pelaajapohjaista 40 %:n osaa.")
    return "\n".join(L)


def games_for_day(session, day: str) -> list[dict]:
    return [r.as_dict() for r in session.sql(f"""
        SELECT game_id AS "game_id", start_time_fi AS "time", home_team AS "home_team", away_team AS "away_team",
               p_home_regulation_win AS "p_home_reg", p_overtime AS "p_overtime"
        FROM LIIGA.MODEL.V_UPCOMING_PREDICTIONS WHERE game_date = {day}
        ORDER BY start_time_fi, home_team""").collect()]


def run(session, day: str) -> str:
    """Proseduuri. day: 'TODAY', 'TOMORROW' tai YYYY-MM-DD."""
    import requests
    d = (day or "TODAY").strip().upper()
    today = "TO_DATE(CONVERT_TIMEZONE('Europe/Helsinki', CURRENT_TIMESTAMP()))"
    expr = {"TODAY": today, "TOMORROW": f"DATEADD(day, 1, {today})"}.get(d, f"'{d[:10]}'::DATE")
    label = session.sql(f"SELECT TO_CHAR({expr}, 'DD.MM.YYYY')").collect()[0][0]
    games = games_for_day(session, expr)
    if not games:
        return render([], label)
    model = sim_load_model(session)
    rows = []
    for g in games:
        try:
            detail = requests.get(f"{API}/{SEASON}/{int(g['game_id'])}", timeout=20,
                                  headers={"User-Agent": "liiga-ennustaja", "Accept": "application/json"}).json()
            lineup = parse_detail(detail)
        except Exception:                                   # noqa: BLE001
            lineup = {}
        rows.append(adjust(g, lineup, model))
    return render(rows, label)


def sim_load_model(session) -> dict:
    m = sim.load_model(session)
    ids = {r[0]: r[1] for r in session.sql("SELECT name, player_id FROM LIIGA.MODEL.PLAYER_RATES").collect()}
    for p in m["players"]:
        p["player_id"] = ids.get(p["name"])
    return m


if __name__ == "__main__":
    print(json.dumps(parse_detail({}), indent=1))
