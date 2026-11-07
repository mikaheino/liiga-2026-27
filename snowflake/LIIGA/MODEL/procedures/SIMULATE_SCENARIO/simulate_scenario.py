"""Mitä jos? -simulaattori: agentin työkalu `liiga_skenaario` (2026-10-16).

Lukitsee käyttäjän kuvaamat ottelutulokset ja pelaa kauden loppuun samalla
Monte Carlolla kuin malli (src/liiga/simulate.py): samat ottelukohtaiset
todennäköisyydet (uusin PREDICTION_GAMES-snapshot), samat pankitetut pisteet,
10 000 kierrosta, siemen 42.

Perustaso ja skenaario ajetaan SAMOILLA satunnaisluvuilla (common random
numbers): ainoa ero on lukitut ottelut, joten ero kertoo skenaarion vaikutuksen
eikä Monte Carlo -kohinaa. Tulos ilmoitetaan julkaistun ennusteen päälle:
skenaario = julkaistu + (simuloitu skenaario - simuloitu perustaso). Ilman
skenaariota tulos on siis täsmälleen julkaistu ennuste, ja yleisöpaino (joka
vaikuttaa vain pisteisiin) kulkee mukana: pisteiden ero kerrotaan (1 - w):llä.

Skenaario on JSON-lista:
  [{"team": "Ilves", "result": "win"},
   {"team": "Tappara", "result": "loss", "opponent": "Lukko"},
   {"team": "KooKoo", "result": "win", "games": 3}]
Tavoite (mitä vaaditaan?) samaan listaan, yksin tai lukitusten kanssa:
  [{"team": "KooKoo", "goal": "avoid_relegation"}]   # myös top6, top10, win
  [{"team": "KooKoo", "goal": "avoid_relegation", "rivals": ["Jokerit", "Sport"]}]
-> todennäköisyys, tarvittavat loppupisteet 50/80/95 % varmuudella, niiden
vaatima p/ottelu loppukaudelle, sijan raja simulaatioissa ja kilpakumppanit --
sekä miten kilpakumppanien pitää pelata: niiden loppupisteet niissä kausissa,
joissa tavoite toteutui, verrattuna mallin odotukseen.
Luetaan niistä 10 000 kaudesta, joissa tavoite toteutui -- ei uusia oletuksia.

result: win | loss (malli arpoo varsinaisen peliajan vs. jatkoajan omilla
todennäköisyyksillään) tai reg_win | ot_win | ot_loss | reg_loss.
games: montako seuraavaa ottelua (oletus 1). opponent: vain ottelut tätä
vastaan.

Loukkaantuminen samaan listaan: {"injury": "Maxime Fortier", "games": 10} tai
{"injury": "Patrik Bartosak", "days": 61, "ramp_games": 3, "ramp_effect": 0.5}
(kesto otteluina "games", päivinä "days" tai paluupäivänä "until": "2026-12-24";
puuttuu = koko loppukausi; paluun hidas alku:
ramp_games ottelua, joissa vaikutuksesta on jäljellä ramp_effect).
Vastaus listaa joukkueen ottelut jaksolla: voitto-% ja odotetut pisteet ennen/nyt. Pelaaja poistetaan joukkueen 18 parhaan
kenttäpelaajan summasta (tai maalivahtien painotetusta torjunnasta) mallin omilla
kaavoilla (team_strength.py, goalies.py, model.matchup_probs); muutos viedään
ensemblen Poisson-osaan painolla 0,4 -- Elo-osa ei riipu pelaajista. Tasapelien
kalibrointi (model.calibrate_ties) jätetään pois muutoksesta: se on koko
otteluohjelman kerroin eikä juuri liiku yhden joukkueen muutoksesta.

Ottelu tunnisteella (sovelluksen napautus) ja jakso (6.11.2026):
  {"game_id": 2701370, "result": "home_win"}       # home_win|away_win|home_reg|home_ot|away_ot|away_reg
  {"game_id": 2701370, "team": "HPK", "result": "loss"}
  {"team": "HPK", "result": "loss", "from": "2026-12-20", "until": "2027-01-06"}   # until mukaan lukien
Poissaolo myös pelaajan tunnisteella: {"injury": 12345} tai {"player_id": 12345}.
Panokset: {"stakes": {"days": 7}} (seuraavan viikon ottelut) tai
{"stakes": {"team": "Jokerit", "top": 5}} (joukkueen ratkaisevimmat ottelut): tavoitteen
todennäköisyys ehdolla kunkin ottelun tulos, samoista simuloiduista kausista.

Kaikki todennäköisyydet ankkuroidaan julkaistuun ennusteeseen (julkaistu + skenaario -
perustaso), myös "mitä vaaditaan" ja panokset. JSON-tila (MODE 'json') palauttaa
rakenteisen tuloksen ja kanonisen skenaarion (vain ratkaistut tunnisteet) sekä sen
sha:n: sama skenaario eri sanoin = sama sha. Tyhjä skenaario sallitaan vain JSON-tilassa.

Puhdas Python + numpy: sama tiedosto ajetaan paikallisesti
(scripts/tools/skenaario.py, DuckDB) ja Snowflaken proseduurina (handler `run`).
"""
from __future__ import annotations

import json
import math

import numpy as np

N_SIMS = 10_000
SEED = 42
PTS = {"reg_win": 3, "ot_win": 2, "ot_loss": 1, "reg_loss": 0}
CANON = ("home_reg", "home_ot", "away_ot", "away_reg")     # tuloskoodit 0..3 (k-matriisi)
GAME_RESULTS = {"home_win": ("home_reg", "home_ot"), "away_win": ("away_ot", "away_reg"),
                "home_reg": ("home_reg",), "home_ot": ("home_ot",), "away_ot": ("away_ot",),
                "away_reg": ("away_reg",),
                # Jatkoaika ja pisteet (7.11.2026, käyttäjä: "tuki jatkoaika"): menee jatkoajalle
                # (kumpi tahansa voittaa), ratkeaa varsinaisella ajalla, joukkue saa vähintään pisteen.
                "overtime": ("home_ot", "away_ot"), "regulation": ("home_reg", "away_reg"),
                "home_point": ("home_reg", "home_ot", "away_ot"), "away_point": ("home_ot", "away_ot", "away_reg")}
# Tavoite -> julkaistun ennusteen kenttä (ja onko se komplementti).
GOAL_PUB = {"win": ("p_title", False), "top6": ("p_top6", False), "top10": ("p_top10", False),
            "avoid_relegation": ("p_relegation", True)}
RESULTS = {
    "win": ("home_reg", "home_ot"), "reg_win": ("home_reg",), "ot_win": ("home_ot",),
    "loss": ("away_reg", "away_ot"), "reg_loss": ("away_reg",), "ot_loss": ("away_ot",),
    "ot": ("home_ot", "away_ot"), "regulation": ("home_reg", "away_reg"), "point": ("home_reg", "home_ot", "away_ot"),
}
FLIP = {"home_reg": "away_reg", "home_ot": "away_ot", "away_reg": "home_reg", "away_ot": "home_ot"}
ALIASES = {"voitto": "win", "tappio": "loss", "häviö": "loss", "jatkoaikavoitto": "ot_win",
           "jatkoaikatappio": "ot_loss", "regulation_win": "reg_win", "regulation_loss": "reg_loss",
           "jatkoaika": "ot", "jatkoajalle": "ot", "overtime": "ot", "piste": "point", "pisteet": "point",
           "vähintään piste": "point", "varsinainen": "regulation", "varsinaisella": "regulation"}


# Mallin vakiot (config.yaml, src/liiga/pipeline.py). tests/test_simulate_scenario.py
# tarkistaa, että ne ovat samat kuin config.yaml:ssa.
TEAM_WEIGHT = 0.15          # team_strength.team_weight
GOALIE_WEIGHT = 0.70        # team_strength.goalie_weight
LEAGUE_AVG = 2.9            # team_strength.league_avg_goals_per_game
TOP_SKATERS = 18            # team_strength.top_skaters
HOME_ICE = 1.08             # match_model.home_ice
OT_LEAN = 0.52              # match_model.ot_favourite_lean
LEAGUE_SV = 0.908           # goaltending.league_avg_save_pct
POISSON_WEIGHT = 0.4        # pipeline.POISSON_WEIGHT (Elo 0,6 ei riipu pelaajista)
MAX_GOALS = 12


class ScenarioError(ValueError):
    """Skenaariota ei voi tulkita; viesti kerrotaan käyttäjälle."""


def _team_of(lower: dict[str, str], name, what: str = "joukkue") -> str:
    t = lower.get(str(name or "").strip().lower())
    if not t:
        raise ScenarioError(f"tuntematon {what} {name!r}; joukkueet: {', '.join(sorted(lower.values()))}")
    return t


def _result_of(item: dict) -> str:
    res = str(item.get("result", "win")).strip().lower()
    res = ALIASES.get(res, res)
    if res not in RESULTS:
        raise ScenarioError(f"tuntematon tulos {item.get('result')!r}; käytä {', '.join(RESULTS)}")
    return res


def _matching(games: list[dict], team: str, opp: str | None, lo: str, hi: str) -> list[int]:
    both = (team, opp) if opp else (team,)
    hits = [i for i, g in enumerate(games) if all(t in (g["home_team"], g["away_team"]) for t in both)]
    if lo or hi:
        hits = [i for i in hits if (lo or "0000") <= games[i]["iso"] <= (hi or "9999")]
    return hits


def _team_games(item: dict, games: list[dict], team: str, opp: str | None) -> list[int]:
    """Joukkueen lukittavat ottelut: seuraavat N tai jakson from-until (until mukaan lukien)."""
    lo, hi = str(item.get("from") or "")[:10], str(item.get("until") or "")[:10]
    hits = _matching(games, team, opp, lo, hi)
    if (lo or hi) and not item.get("games"):
        if not hits:
            raise ScenarioError(f"{team}: ei pelaamattomia otteluita jaksolla {lo or '…'}–{hi or '…'}")
        return hits
    n = int(item.get("games") or 1)
    if len(hits) < n:
        raise ScenarioError(f"{team}: pelaamattomia otteluita löytyi {len(hits)}, pyydettiin {n}")
    return hits[:n]


def _game_lock(item: dict, games: list[dict], lower: dict[str, str]) -> tuple[int, tuple[str, ...]]:
    """{"game_id": .., "result": home_win|..} tai joukkueen näkökulmasta {"team": .., "result": win|..}."""
    gid = int(item["game_id"])
    i = next((i for i, g in enumerate(games) if int(g.get("game_id") or -1) == gid), None)
    if i is None:
        raise ScenarioError(f"ottelua {gid} ei löydy pelaamattomista")
    g = games[i]
    if item.get("team"):
        team = _team_of(lower, item["team"])
        if team not in (g["home_team"], g["away_team"]):
            raise ScenarioError(f"{team} ei pelaa ottelussa {g['home_team']}–{g['away_team']}")
        res = _result_of(item)
        return i, RESULTS[res] if g["home_team"] == team else tuple(FLIP[o] for o in RESULTS[res])
    res = str(item.get("result", "")).strip().lower()
    if res not in GAME_RESULTS:
        raise ScenarioError(f"tuntematon tulos {item.get('result')!r}; käytä {', '.join(GAME_RESULTS)}")
    return i, GAME_RESULTS[res]


def resolve(scenario: list[dict], games: list[dict], teams: set[str]) -> dict[int, tuple[str, ...]]:
    """Skenaarion rivit -> {pelaamattoman ottelun indeksi: sallitut tulokset kotijoukkueen
    näkökulmasta}. `games` on aikajärjestyksessä."""
    fixed: dict[int, tuple[str, ...]] = {}
    lower = {t.lower(): t for t in teams}
    for item in scenario:
        if item.get("game_id") is not None:
            pairs = [_game_lock(item, games, lower)]
        else:
            team = _team_of(lower, item.get("team"))
            res = _result_of(item)
            opp = _team_of(lower, item["opponent"], "vastustaja") if item.get("opponent") else None
            pairs = [(i, RESULTS[res] if games[i]["home_team"] == team else tuple(FLIP[o] for o in RESULTS[res]))
                     for i in _team_games(item, games, team, opp)]
        for i, allowed in pairs:
            if i in fixed and set(fixed[i]) != set(allowed):
                g = games[i]
                raise ScenarioError(f"ristiriita: {g['home_team']}–{g['away_team']} lukittu kahdesti eri tavoin")
            fixed[i] = tuple(o for o in CANON if o in allowed)
    return fixed


# ---------------------------------------------------------------- loukkaantuminen
def _poisson(lh: float, la: float) -> tuple[float, float, float, float]:
    """src/liiga/model.matchup_probs ilman scipyä: (koti, vieras, tasan, kodin OT-osuus)."""
    gh = [math.exp(-lh) * lh ** k / math.factorial(k) for k in range(MAX_GOALS + 1)]
    ga = [math.exp(-la) * la ** k / math.factorial(k) for k in range(MAX_GOALS + 1)]
    tot = sum(gh) * sum(ga)
    hw = sum(gh[i] * ga[j] for i in range(MAX_GOALS + 1) for j in range(i)) / tot
    aw = sum(gh[i] * ga[j] for j in range(MAX_GOALS + 1) for i in range(j)) / tot
    return hw, aw, 1 - hw - aw, OT_LEAN if lh >= la else 1 - OT_LEAN


def _team_offense(players: list[dict], out: set[str]) -> dict[str, float]:
    """team_strength.team_offense_from_players: 18 parhaan kenttäpelaajan maalitahti,
    vajaa joukkue täydennetään replacement-tasolla (15. persentiili)."""
    sk = sorted([p for p in players if p["position_group"] != "G"],
                key=lambda p: -p["projected_goals_per_game"])
    rates = sorted(p["projected_goals_per_game"] for p in sk)
    repl = float(np.quantile(rates, 0.15)) if rates else 0.0
    raw: dict[str, list[float]] = {}
    for p in sk:
        if p["name"] in out:
            continue
        raw.setdefault(p["team"], [])
        if len(raw[p["team"]]) < TOP_SKATERS:
            raw[p["team"]].append(p["projected_goals_per_game"])
    return {t: sum(v) + (TOP_SKATERS - len(v)) * repl for t, v in raw.items()}


def _goalie_mult(goalies: list[dict], team: str, out: set[str]) -> float:
    d = [g for g in goalies if g["team"] == team and g["name"] not in out and g["proj_save_pct"] is not None]
    sv = sum(g["proj_save_pct"] * g["wt"] for g in d) / sum(g["wt"] for g in d) if d else LEAGUE_SV
    return (1 - sv) / (1 - LEAGUE_SV)


def _pid(x) -> int | None:
    try:
        return int(x) if x is not None and x == x else None       # NaN -> None
    except (TypeError, ValueError):
        return None


def _by_id(pid: int, pool: list[dict]) -> dict:
    hit = next((p for p in pool if p["player_id"] == pid), None)
    if not hit:
        raise ScenarioError(f"pelaajaa {pid} ei löydy nykyisistä kokoonpanoista")
    return hit


def find_player(name, players: list[dict], goalies: list[dict]) -> dict:
    """Nimi tai tunniste (player_id) -> pelaaja. Monitulkintainen nimi on virhe:
    agentti kysyy tarkennuksen eikä arvaa."""
    pool = [{"name": p["name"], "team": p["team"], "position_group": p["position_group"],
             "rate": p["projected_goals_per_game"], "player_id": _pid(p.get("player_id"))}
            for p in players if p["position_group"] != "G"]
    pid = name if isinstance(name, int) else (int(name) if str(name).strip().isdigit() else None)
    if pid is not None:
        return _by_id(pid, pool)
    pool += [{"name": g["name"], "team": g["team"], "position_group": "G", "rate": g["proj_save_pct"],
              "player_id": None} for g in goalies]
    return _by_name(str(name), pool)


def _by_name(name: str, pool: list[dict]) -> dict:
    q = name.strip().lower()
    hits = [p for p in pool if p["name"].lower() == q] or \
           [p for p in pool if q in p["name"].lower() or p["name"].lower().split()[-1] == q.split()[-1]]
    if not hits:
        raise ScenarioError(f"pelaajaa {name!r} ei löydy nykyisistä kokoonpanoista")
    if len({(h["name"], h["team"]) for h in hits}) > 1:
        raise ScenarioError(f"{name!r} on monitulkintainen: " + ", ".join(f"{h['name']} ({h['team']})" for h in hits[:6]))
    return hits[0]


def _player_delta(p: dict, players: list[dict], goalies: list[dict],
                  raw_all: dict[str, float], scale: float) -> tuple[float, float]:
    """Yhden pelaajan poissaolon vaikutus joukkueen off_ratingiin ja def_ratingiin."""
    out = {p["name"]}
    raw_out = _team_offense(players, out)
    d_off = (1 - TEAM_WEIGHT) * (raw_out[p["team"]] - raw_all[p["team"]]) * scale / LEAGUE_AVG
    d_def = GOALIE_WEIGHT * (_goalie_mult(goalies, p["team"], out) - _goalie_mult(goalies, p["team"], set()))
    return d_off, d_def


def _exp_points(x: dict, team: str) -> float:
    """Odotetut sarjapisteet ottelusta (3/2/1/0) joukkueen näkökulmasta."""
    hr, ot, how = x["p_home_reg"], x["p_overtime"], x["p_home_ot_win"]
    ar = 1 - hr - ot
    if team == x["home_team"]:
        return 3 * hr + 2 * ot * how + ot * (1 - how)
    return 3 * ar + 2 * ot * (1 - how) + ot * how


def _iso_add(iso: str, days: int) -> str:
    import datetime as dt
    return (dt.date.fromisoformat(iso) + dt.timedelta(days=days)).isoformat()


def _who(it: dict):
    return it["player_id"] if it.get("player_id") is not None else it["injury"]


def apply_injuries(items: list[dict], games: list[dict], model: dict,
                   today: str | None = None) -> tuple[list[dict], list[dict]]:
    """Poissa olevat pelaajat -> joukkueen hyökkäys- ja puolustusvoima mallin omilla
    kaavoilla -> Poisson-osan muutos niissä otteluissa, joista pelaaja puuttuu ->
    ensemblen todennäköisyyksiin painolla POISSON_WEIGHT. Elo-osa (0,6) ei
    riipu pelaajista, joten sitä ei muuteta.

    Poissaolo: "games" (seuraavat N ottelua) tai "days" (ottelut ennen päivää
    tänään + N), muuten koko loppukausi. Paluu: "ramp_games" ottelua, joissa
    vaikutuksesta on jäljellä "ramp_effect" (oletus 0,5) -- hidas alku."""
    players, goalies, strength = model["players"], model["goalies"], model["strength"]
    raw_all = _team_offense(players, set())
    scale = LEAGUE_AVG / (sum(raw_all.values()) / len(raw_all))
    info = []
    for it in items:
        p = find_player(_who(it), players, goalies)
        d_off, d_def = _player_delta(p, players, goalies, raw_all, scale)
        tg = [i for i, g in enumerate(games) if p["team"] in (g["home_team"], g["away_team"])]
        if it.get("until"):
            end = str(it["until"])[:10]          # paluupäivä: sinä päivänä jo pelaa
            n_out = sum(1 for i in tg if games[i]["iso"] < end)
        elif it.get("days"):
            end = _iso_add(today or games[0]["iso"], int(it["days"]))
            n_out = sum(1 for i in tg if games[i]["iso"] < end)
        elif it.get("games"):
            n_out = min(int(it["games"]), len(tg))
        else:
            n_out = len(tg)
        ramp = int(it.get("ramp_games") or 0)
        ramp_eff = float(it.get("ramp_effect", 0.5))
        weight = {i: 1.0 for i in tg[:n_out]}
        weight.update({i: ramp_eff for i in tg[n_out:n_out + ramp]})
        info.append({**p, "games": it.get("games"), "days": it.get("days"), "until": it.get("until"),
                     "ramp_games": ramp,
                     "ramp_effect": ramp_eff, "n_games": n_out, "n_ramp": len(tg[n_out:n_out + ramp]),
                     "d_goals_for": d_off * LEAGUE_AVG, "d_goals_against": d_def * LEAGUE_AVG,
                     "_d": (d_off, d_def), "_w": weight,
                     "return_date": games[tg[n_out]]["date"] if n_out < len(tg) else None})
    changed = []
    for i, gm in enumerate(games):
        dh = [0.0, 0.0]
        da = [0.0, 0.0]
        for x in info:
            f = x["_w"].get(i, 0.0)
            if not f:
                continue
            tgt = dh if x["team"] == gm["home_team"] else da
            tgt[0] += f * x["_d"][0]
            tgt[1] += f * x["_d"][1]
        if dh == [0.0, 0.0] and da == [0.0, 0.0]:
            changed.append(gm)
            continue
        h0, a0 = strength[gm["home_team"]], strength[gm["away_team"]]
        o = _poisson(LEAGUE_AVG * h0["off_rating"] * a0["def_rating"] * HOME_ICE,
                     LEAGUE_AVG * a0["off_rating"] * h0["def_rating"])
        n = _poisson(LEAGUE_AVG * (h0["off_rating"] + dh[0]) * (a0["def_rating"] + da[1]) * HOME_ICE,
                     LEAGUE_AVG * (a0["off_rating"] + da[0]) * (h0["def_rating"] + dh[1]))
        changed.append(_reprice(gm, o, n, POISSON_WEIGHT))
    for x in info:
        t = x["team"]
        rows = []
        for i, f in sorted(x["_w"].items()):
            g0, g1 = games[i], changed[i]
            home = g0["home_team"] == t

            def win(g, home=home):
                ph = g["p_home_reg"] + g["p_overtime"] * g["p_home_ot_win"]
                return ph if home else 1 - ph
            rows.append({"date": g0["date"], "opponent": g0["away_team"] if home else g0["home_team"],
                         "home": home, "phase": "poissa" if f == 1.0 else "paluu",
                         "win_before": win(g0), "win_after": win(g1),
                         "xp_before": _exp_points(g0, t), "xp_after": _exp_points(g1, t)})
        x["game_rows"] = rows
        absent = [r for r in rows if r["phase"] == "poissa"]
        x["win_before"] = float(np.mean([r["win_before"] for r in absent])) if absent else None
        x["win_after"] = float(np.mean([r["win_after"] for r in absent])) if absent else None
        x["xp_window_before"] = sum(r["xp_before"] for r in rows)
        x["xp_window_after"] = sum(r["xp_after"] for r in rows)
        del x["_d"], x["_w"]
    return changed, info


def _reprice(gm: dict, o: tuple, n: tuple, w: float) -> dict:
    """Poisson-mallin muutos (o -> n) ensemblen todennäköisyyksiin painolla w."""
    hreg = max(0.0, gm["p_home_reg"] + w * (n[0] - o[0]))
    ot = max(0.0, gm["p_overtime"] + w * (n[2] - o[2]))
    areg = max(0.0, (1 - gm["p_home_reg"] - gm["p_overtime"]) + w * (n[1] - o[1]))
    tot = hreg + ot + areg
    return {**gm, "p_home_reg": hreg / tot, "p_overtime": ot / tot,
            "p_home_ot_win": min(1.0, max(0.0, gm["p_home_ot_win"] + w * (n[3] - o[3])))}


# --------------------------------------------- joukkueen tason muutos (7.11.2026)
# Käyttäjä: "Kärpät vaihtavat valmentajaa" -> malli ei tunne valmentajia, joten muutos
# annetaan joukkueen maaliodottamien osuuden (xG-osuus) siirtona: {"team", "xg_share": +0.06,
# "from"?, "until"?, "games"?}. Osuus s0 = hyökkäys / (hyökkäys + puolustus) mallin omista
# vahvuuksista; s0 + d jaetaan hyökkäykseen (tehdyt) ja puolustukseen (päästetyt) niin, että
# maalien kokonaismäärä pysyy. Toisin kuin pelaajan poissaolo (vain Poisson-osa, paino 0,4),
# joukkueen vahvuuden muutos koskee koko ennustetta, joten paino on 1.
MAX_SHIFT = 0.15


def apply_strength(items: list[dict], games: list[dict], model: dict,
                   today: str | None = None) -> tuple[list[dict], list[dict]]:
    strength = model["strength"]
    lower = {t.lower(): t for t in strength}
    per_game: dict[int, dict[str, tuple[float, float]]] = {}
    info = []
    for it in items:
        team = _team_of(lower, it.get("team"))
        d = float(it["xg_share"])
        if not -MAX_SHIFT <= d <= MAX_SHIFT:
            raise ScenarioError(f"xG-osuuden muutos {d:+.2f} on liian suuri (enintään ±{MAX_SHIFT})")
        st = strength[team]
        s0 = st["off_rating"] / (st["off_rating"] + st["def_rating"])
        f_off, f_def = (s0 + d) / s0, (1 - s0 - d) / (1 - s0)
        lo = str(it.get("from") or today or games[0]["iso"])[:10]
        hi = str(it.get("until") or "9999-12-31")[:10]
        tg = [i for i, g in enumerate(games) if team in (g["home_team"], g["away_team"]) and lo <= g["iso"] <= hi]
        if it.get("games"):
            tg = tg[:int(it["games"])]
        for i in tg:
            per_game.setdefault(i, {})[team] = (f_off, f_def)
        info.append({"team": team, "xg_share": d, "from": it.get("from"), "until": it.get("until"), "games": it.get("games"),
                     "n_games": len(tg), "share_before": s0, "share_after": s0 + d,
                     "first": games[tg[0]]["date"] if tg else None, "last": games[tg[-1]]["date"] if tg else None})
    out = []
    for i, gm in enumerate(games):
        adj = per_game.get(i)
        if not adj:
            out.append(gm)
            continue
        h0, a0 = strength[gm["home_team"]], strength[gm["away_team"]]
        fh, fa = adj.get(gm["home_team"], (1.0, 1.0)), adj.get(gm["away_team"], (1.0, 1.0))
        o = _poisson(LEAGUE_AVG * h0["off_rating"] * a0["def_rating"] * HOME_ICE,
                     LEAGUE_AVG * a0["off_rating"] * h0["def_rating"])
        n = _poisson(LEAGUE_AVG * h0["off_rating"] * fh[0] * a0["def_rating"] * fa[1] * HOME_ICE,
                     LEAGUE_AVG * a0["off_rating"] * fa[0] * h0["def_rating"] * fh[1])
        out.append(_reprice(gm, o, n, 1.0))
    return out, info


def _outcome_probs(gm: dict) -> dict[str, float]:
    hreg, ot, how = gm["p_home_reg"], gm["p_overtime"], gm["p_home_ot_win"]
    return {"home_reg": hreg, "home_ot": ot * how, "away_ot": ot * (1 - how),
            "away_reg": max(0.0, 1.0 - hreg - ot)}


def simulate(games: list[dict], banked: dict[str, float], teams: list[str],
             fixed: dict[int, tuple[str, ...]] | None = None) -> dict[str, np.ndarray]:
    """Monte Carlo kuten src/liiga/simulate.py. Satunnaisluvut arvotaan ennen
    lukitusta, joten kahdella kutsulla (fixed=None ja fixed=...) on samat luvut.
    `_k` (kausi x ottelu, int8) = kunkin ottelun tulos koodina CANON-järjestyksessä:
    panokset ehdollistetaan sillä samoista kausista."""
    fixed = fixed or {}
    rng = np.random.default_rng(SEED)
    idx = {t: i for i, t in enumerate(teams)}
    G = len(games)
    u = rng.random((N_SIMS, G))
    jitter = rng.random((N_SIMS, len(teams))) * 1e-6
    points = np.zeros((N_SIMS, len(teams)))
    K = np.zeros((N_SIMS, G), dtype=np.int8)
    for t, b in banked.items():
        if t in idx:
            points[:, idx[t]] += b
    for g, gm in enumerate(games):
        p = _outcome_probs(gm)
        allowed = fixed.get(g, ("home_reg", "home_ot", "away_ot", "away_reg"))
        order = [o for o in ("home_reg", "home_ot", "away_ot", "away_reg") if o in allowed]
        w = np.array([p[o] for o in order])
        w = w / w.sum() if w.sum() > 0 else np.full(len(order), 1 / len(order))
        # Sama u valitsee tuloksen sallittujen joukosta: lukittu ottelu käyttää
        # samaa satunnaislukua kuin perustasossa (common random numbers).
        cut = np.cumsum(w)
        k = np.minimum(np.searchsorted(cut, u[:, g], side="right"), len(order) - 1)
        K[:, g] = np.array([CANON.index(o) for o in order], dtype=np.int8)[k]
        h, a = idx[gm["home_team"]], idx[gm["away_team"]]
        for j, o in enumerate(order):
            m = k == j
            hp = {"home_reg": 3, "home_ot": 2, "away_ot": 1, "away_reg": 0}[o]
            points[m, h] += hp
            points[m, a] += {3: 0, 2: 1, 1: 2, 0: 3}[hp]
    order_ = np.argsort(-(points + jitter), axis=1)
    ranks = np.empty_like(order_)
    ranks[np.arange(N_SIMS)[:, None], order_] = np.arange(1, len(teams) + 1)
    n = len(teams)
    return {"points": points.mean(axis=0), "p_title": (ranks == 1).mean(axis=0),
            "p_top6": (ranks <= 6).mean(axis=0), "p_top10": (ranks <= 10).mean(axis=0),
            "p_relegation": (ranks >= n - 2).mean(axis=0),
            "_points": points, "_ranks": ranks, "_k": K}


# Tavoite -> paras sallittu sija (n = joukkueiden määrä). Putoaminen on 15.-17.
# eli kolme viimeistä, joten säilyminen = sija n - 3 tai parempi.
GOALS = {"avoid_relegation": ("pysyy sarjassa", lambda n: n - 3),
         "top6": ("suoraan puolivälieriin (top 6)", lambda n: 6),
         "top10": ("pudotuspeleihin (top 10)", lambda n: 10),
         "win": ("voittaa runkosarjan", lambda n: 1)}
GOAL_ALIASES = {"säilyminen": "avoid_relegation", "pysyy liigassa": "avoid_relegation",
                "stay_up": "avoid_relegation", "playoffs": "top10", "pudotuspelit": "top10",
                "runkosarjan voitto": "win", "title": "win"}


def requirement(team: str, goal: str, sim: dict, games: list[dict], banked: dict[str, float],
                teams: list[str], played: dict[str, int] | None = None,
                named_rivals: list[str] | None = None) -> dict:
    """Mitä vaaditaan: niistä simuloiduista kausista, joissa tavoite toteutui,
    luetaan millä loppupisteillä se toteutui. Ei uusia oletuksia: samat 10 000
    kautta kuin ennusteessa (ja mahdolliset lukitut tulokset mukana)."""
    goal = GOAL_ALIASES.get(goal, goal)
    if goal not in GOALS:
        raise ScenarioError(f"tuntematon tavoite {goal!r}; käytä {', '.join(GOALS)}")
    label, lim = GOALS[goal]
    n = len(teams)
    limit = lim(n)
    i = teams.index(team)
    pts, ranks = sim["_points"][:, i], sim["_ranks"]
    ok = ranks[:, i] <= limit
    remaining = sum(team in (g["home_team"], g["away_team"]) for g in games)
    b = banked.get(team, 0.0)
    xs = np.unique(pts)
    prob = []
    for x in xs:
        m = pts == x
        prob.append(ok[m].mean() if m.sum() >= 40 else np.nan)
    prob = np.array(prob)
    valid = ~np.isnan(prob)
    curve = np.full_like(prob, np.nan)
    curve[valid] = np.maximum.accumulate(prob[valid])     # monotoninen: enemmän pisteitä ei huononna
    need = {}
    for thr in (0.5, 0.8, 0.95):
        hit = xs[valid][curve[valid] >= thr]
        need[thr] = float(hit.min()) if len(hit) else None
    line = np.sort(sim["_points"], axis=1)[:, n - limit]   # sijan `limit` joukkueen pisteet
    near = ((ranks >= max(1, limit - 2)) & (ranks <= min(n, limit + 3)))
    near[:, i] = False
    rivals = named_rivals or [teams[j] for j in np.argsort(-near.mean(axis=0))[:4]]
    # Miten kilpakumppanien pitää pelata: niiden loppupisteet kausissa, joissa
    # tavoite toteutui, verrattuna kaikkiin kausiin (= mallin odotus).
    rival_rows = []
    if 0 < ok.sum() < len(ok):
        for t in rivals:
            j = teams.index(t)
            pj = sim["_points"][:, j]
            rem_j = sum(t in (g["home_team"], g["away_team"]) for g in games)
            b_j = banked.get(t, 0.0)
            rival_rows.append({"team": t, "expected": float(pj.mean()), "when_goal": float(pj[ok].mean()),
                               "ppg_expected": (float(pj.mean()) - b_j) / rem_j if rem_j else 0.0,
                               "ppg_when_goal": (float(pj[ok].mean()) - b_j) / rem_j if rem_j else 0.0,
                               "p_goal_if_below": float(ok[pj < np.median(pj)].mean())})
    return {"team": team, "goal": label, "limit": limit, "p": float(ok.mean()),
            "banked": b, "played": (played or {}).get(team), "remaining": remaining,
            "expected_final": float(pts.mean()), "need": need,
            "line_mean": float(line.mean()), "line_p05": float(np.percentile(line, 5)),
            "line_p95": float(np.percentile(line, 95)), "rivals": rivals, "rival_rows": rival_rows}


def _goal_ok(sim: dict, teams: list[str], goal: str) -> np.ndarray:
    """kausi x joukkue: toteutuiko tavoite."""
    return sim["_ranks"] <= GOALS[goal][1](len(teams))


def _pub_goal(published: dict, team: str, goal: str) -> float | None:
    key, inv = GOAL_PUB[goal]
    v = published[team].get(key)
    return None if v is None else (1 - v if inv else v)


def _anchor(pub: float | None, p_scn: float, p_base: float) -> float:
    """Yksi luku per asia: julkaistu + (skenaario - perustaso), rajattu 0..1."""
    return p_scn if pub is None else min(1.0, max(0.0, pub + p_scn - p_base))


def _stake_games(games: list[dict], team: str | None, opts: dict, today: str | None) -> list[int]:
    if team:
        return [i for i, g in enumerate(games) if team in (g["home_team"], g["away_team"])]
    lo = today or games[0]["iso"]
    hi = _iso_add(lo, int(opts.get("days") or 7))
    return [i for i, g in enumerate(games) if lo <= g["iso"] < hi]


def _stake(g: dict, rows: list[dict], team: str | None) -> dict | None:
    playing = (g["home_team"], g["away_team"])
    mine = [r for r in rows if r["team"] in ((team,) if team else playing)]
    if not mine:
        return None
    others = sorted((r for r in rows if r["team"] not in playing and abs(r["delta"]) > max(0.01, 2 * r["se"])),
                    key=lambda r: -abs(r["delta"]))
    return {"game_id": g.get("game_id"), "date": g["date"], "iso": g["iso"], "home": g["home_team"],
            "away": g["away_team"], "p_outcome": _outcome_probs(g),
            "top": max(mine, key=lambda r: abs(r["delta"])), "others": others[:3]}


def stakes(scn: dict, base: dict, games: list[dict], teams: list[str], published: dict,
           opts: dict, today: str | None = None) -> list[dict]:
    """Panokset: tavoitteen todennäköisyys ehdolla ottelun tulos, samoista kausista
    (k-matriisi). Ottelulle valitaan sen joukkueiden elävin tavoite (suurin ero
    koti- ja vierasvoiton välillä); sivulliset = muut joukkueet, joiden luku liikkuu
    yli kaksi keskivirhettä. opts: {"days": 7} tai {"team": "Jokerit", "top": 5}."""
    team = _team_of({t.lower(): t for t in teams}, opts["team"]) if opts.get("team") else None
    ok = {gl: _goal_ok(scn, teams, gl) for gl in GOAL_PUB}
    base_p = {gl: _goal_ok(base, teams, gl).mean(axis=0) for gl in GOAL_PUB}
    out = [x for i in _stake_games(games, team, opts, today)
           if (x := _stake(games[i], _stake_rows(scn["_k"][:, i], ok, base_p, teams, published), team))]
    if team:
        out = sorted(out, key=lambda x: -abs(x["top"]["delta"]))[:int(opts.get("top") or 5)]
    return out


def _stake_rows(k: np.ndarray, ok: dict, base_p: dict, teams: list[str], published: dict) -> list[dict]:
    """Kaikki (joukkue, tavoite) -parit, jotka ovat vielä auki: ehdolliset luvut koodeittain."""
    masks = {"home_win": k <= 1, "away_win": k >= 2, "home_reg": k == 0, "ot": (k == 1) | (k == 2),
             "away_reg": k == 3}
    n = {m: int(v.sum()) for m, v in masks.items()}
    rows = []
    for gl, mat in ok.items():
        p_all = mat.mean(axis=0)
        cond = {m: (mat[v].mean(axis=0) if n[m] else p_all) for m, v in masks.items()}
        for j, t in enumerate(teams):
            if not 0.005 < p_all[j] < 0.995:
                continue
            ph, pa = cond["home_win"][j], cond["away_win"][j]
            se = math.sqrt(ph * (1 - ph) / max(n["home_win"], 1) + pa * (1 - pa) / max(n["away_win"], 1))
            pub, b = _pub_goal(published, t, gl), float(base_p[gl][j])
            rows.append({"team": t, "goal": gl, "p_now": _anchor(pub, float(p_all[j]), b),
                         **{f"p_{m}": _anchor(pub, float(cond[m][j]), b) for m in masks},
                         "delta": float(ph - pa), "se": se})
    return rows


def _lock_label(gm: dict, allowed: tuple[str, ...]) -> str:
    key = tuple(o for o in CANON if o in allowed)
    return {("home_reg", "home_ot"): f"{gm['home_team']} voittaa",
            ("away_ot", "away_reg"): f"{gm['away_team']} voittaa",
            ("home_reg",): f"{gm['home_team']} voittaa varsinaisella peliajalla",
            ("home_ot",): f"{gm['home_team']} voittaa jatkoajalla",
            ("away_ot",): f"{gm['away_team']} voittaa jatkoajalla",
            ("away_reg",): f"{gm['away_team']} voittaa varsinaisella peliajalla",
            ("home_ot", "away_ot"): "menee jatkoajalle",
            ("home_reg", "away_reg"): "ratkeaa varsinaisella peliajalla",
            ("home_reg", "home_ot", "away_ot"): f"{gm['home_team']} saa vähintään pisteen",
            ("home_ot", "away_ot", "away_reg"): f"{gm['away_team']} saa vähintään pisteen"}.get(key, "/".join(key))


def canonical(fixed: dict, games: list[dict], injury_info: list[dict], goals: list[dict],
              shift_info: list[dict] = ()) -> list[dict]:
    """Ratkaistu skenaario: vain tunnisteet ja enumit, ei käyttäjän sanoja. Kelpaa
    sellaisenaan syötteeksi (sovelluksen sirut), ja sama skenaario eri sanoin
    tuottaa saman listan."""
    rev = {v: k for k, v in GAME_RESULTS.items()}
    items: list[dict] = []
    for i, allowed in sorted(fixed.items()):
        gm = games[i]
        items.append({"game_id": gm.get("game_id"), "result": rev[tuple(o for o in CANON if o in allowed)],
                      "label": f"{gm['date']} {gm['home_team']}–{gm['away_team']}: {_lock_label(gm, allowed)}"})
    for x in injury_info:
        it = {"injury": x["player_id"] if x.get("player_id") is not None else x["name"], "games": x["n_games"]}
        if x["ramp_games"]:
            it.update(ramp_games=x["ramp_games"], ramp_effect=x["ramp_effect"])
        items.append({**it, "label": f"{x['name']} ({x['team']}) poissa {x['n_games']} ottelua"})
    for g in goals:
        it = {"team": g["team"], "goal": g["goal"]}
        if g.get("rivals"):
            it["rivals"] = sorted(g["rivals"])
        items.append({**it, "label": f"{g['team']}: {GOALS[g['goal']][0]}"})
    for x in shift_info:
        it = {"team": x["team"], "xg_share": round(x["xg_share"], 3)}
        it.update({k: x[k] for k in ("from", "until", "games") if x.get(k)})
        span = f"{x['first']}–{x['last']}, {x['n_games']} ottelua" if x["n_games"] else "ei otteluita"
        items.append({**it, "label": f"{x['team']}: xG-osuus {100 * x['xg_share']:+.0f} %-yks. ({span})"})
    return items


def scenario_sha(items: list[dict]) -> str:
    import hashlib
    core = [{k: v for k, v in it.items() if k != "label"} for it in items]
    return hashlib.sha256(json.dumps(core, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]


def _goal_items(goals: list[dict], teams: list[str]) -> list[dict]:
    lower = {t.lower(): t for t in teams}
    out = []
    for g in goals:
        gl = GOAL_ALIASES.get(str(g["goal"]).strip().lower(), str(g["goal"]).strip().lower())
        if gl not in GOALS:
            raise ScenarioError(f"tuntematon tavoite {g['goal']!r}; käytä {', '.join(GOALS)}")
        out.append({"team": _team_of(lower, g.get("team")), "goal": gl,
                    "rivals": [_team_of(lower, rv, "kilpakumppani") for rv in g.get("rivals") or []]})
    return out


def _requirements(goals: list[dict], scn: dict, base: dict, games, banked, teams, played, published,
                  injuries: bool) -> list[dict]:
    reqs = []
    for g in goals:
        r = requirement(g["team"], g["goal"], scn, games, banked, teams, played, g["rivals"] or None)
        pub = _pub_goal(published, g["team"], g["goal"])
        p_base = float(_goal_ok(base, teams, g["goal"])[:, teams.index(g["team"])].mean())
        r["p_sim"] = r["p"]
        r["p"] = _anchor(pub, r["p_sim"], p_base)
        if injuries:     # mitä vaaditaan -vastaus ilman poissaoloa vertailuksi
            r["p_without_injury"] = _anchor(pub, p_base, p_base)
        reqs.append(r)
    return reqs


def _team_rows(teams, published, scn, base, crowd_weight) -> list[dict]:
    keys = [k for k in ("p_title", "p_top6", "p_top10", "p_relegation") if k in published[teams[0]]]
    rows = []
    for i, t in enumerate(teams):
        pub = published[t]
        rows.append({
            "team": t,
            "points_now": pub["points"],
            "points_scenario": pub["points"] + (1 - crowd_weight) * (scn["points"][i] - base["points"][i]),
            **{f"{k}_now": pub[k] for k in keys},
            **{f"{k}_scenario": min(1.0, max(0.0, pub[k] + scn[k][i] - base[k][i])) for k in keys},
        })
    for key in ("now", "scenario"):
        for r, row in enumerate(sorted(rows, key=lambda x: -x[f"points_{key}"]), start=1):
            row[f"rank_{key}"] = r
    return rows


def compute(scenario: list[dict], games: list[dict], banked: dict[str, float],
            published: dict[str, dict], crowd_weight: float,
            played: dict[str, int] | None = None, model: dict | None = None,
            base: dict | None = None, today: str | None = None) -> dict:
    """base = valmiiksi simuloitu perustaso (sama kaikille skenaarioille, --batch)."""
    teams = sorted(published)
    today = today or (model or {}).get("today")
    goals = _goal_items([it for it in scenario if it.get("goal")], teams)
    injuries = [it for it in scenario if it.get("injury") is not None or it.get("player_id") is not None]
    stake_opts = [it["stakes"] for it in scenario if it.get("stakes")]
    shifts = [it for it in scenario if it.get("xg_share") is not None]
    locks = [it for it in scenario if not it.get("goal") and it not in injuries and it not in shifts and not it.get("stakes")]
    fixed = resolve(locks, games, set(teams))
    injury_info: list[dict] = []
    games_scn = games
    if injuries:
        if not model:
            raise ScenarioError("loukkaantumisskenaario tarvitsee pelaaja- ja joukkuedatan")
        games_scn, injury_info = apply_injuries(injuries, games, model, today)
    shift_info: list[dict] = []
    if shifts:
        if not model:
            raise ScenarioError("joukkueen muutos tarvitsee joukkuedatan")
        games_scn, shift_info = apply_strength(shifts, games_scn, model, today)
    base = base or simulate(games, banked, teams)
    scn = simulate(games_scn, banked, teams, fixed) if (fixed or injuries or shifts) else base
    reqs = _requirements(goals, scn, base, games, banked, teams, played, published, bool(injuries))
    locked, plaus = [], 1.0
    for g, allowed in sorted(fixed.items()):
        gm = games[g]
        p = sum(_outcome_probs(gm)[o] for o in allowed)
        plaus *= p
        locked.append({"date": gm["date"], "game": f"{gm['home_team']}–{gm['away_team']}",
                       "game_id": gm.get("game_id"), "result": _lock_label(gm, allowed), "p_model": p})
    canon = canonical(fixed, games, injury_info, goals, shift_info)
    st = [x for o in stake_opts for x in stakes(scn, base, games, teams, published,
                                                o if isinstance(o, dict) else {"days": int(o)}, today)]
    return {"locked_games": locked, "teams": sorted(_team_rows(teams, published, scn, base, crowd_weight),
                                                    key=lambda x: x["rank_scenario"]),
            "requirements": reqs, "injuries": injury_info, "shifts": shift_info, "plausibility": plaus if fixed else None,
            "scenario_canonical": canon, "scenario_sha": scenario_sha(canon), "stakes": st,
            "charts": charts(scn, base, games, teams, banked, fixed, published, crowd_weight) if (fixed or injuries or shifts) else None}


# ------------------------------------------------------- kuvaajat (sovellus, json-tila)
# 7.11.2026, käyttäjä: "agentti vois piirtää myös automaattisesti odotetua pelimallia" ->
# agentti valitsee kuvaajan. Moottori laskee kaikki kolme samoista simuloiduista kausista:
#   dist    sijajakauma 1..n nyt (perustaso) ja skenaariossa
#   points  odotettu pistekertymä päivä kerrallaan (pankki + ottelujen odotusarvot)
#   locked  lukittujen otteluiden mallitodennäköisyys (compute: locked_games)
# Kohdejoukkueet = suurin odotettujen pisteiden muutos (enintään 3), jotta vastaus pysyy pienenä.
_HOME_PTS = np.array([3, 2, 1, 0])        # CANON-järjestys: home_reg, home_ot, away_ot, away_reg
_AWAY_PTS = np.array([0, 1, 2, 3])
CHART_TEAMS = 3


def charts(scn: dict, base: dict, games: list[dict], teams: list[str], banked: dict[str, float],
           fixed: dict[int, tuple[str, ...]], published: dict[str, dict], crowd_weight: float) -> dict:
    moved = np.abs(scn["points"] - base["points"])
    focus = [teams[i] for i in np.argsort(-moved)[:CHART_TEAMS] if moved[i] >= 0.05]
    n = len(teams)
    dist, points = {}, {}
    for t in focus:
        i = teams.index(t)
        dist[t] = {"now": (np.bincount(base["_ranks"][:, i], minlength=n + 1)[1:] / N_SIMS).tolist(),
                   "scenario": (np.bincount(scn["_ranks"][:, i], minlength=n + 1)[1:] / N_SIMS).tolist()}
        now = sc = float(banked.get(t, 0.0))
        series = [{"iso": None, "date": "nyt", "now": now, "scenario": sc, "locked": False}]
        for g, gm in enumerate(games):
            side = _HOME_PTS if gm["home_team"] == t else _AWAY_PTS if gm["away_team"] == t else None
            if side is None:
                continue
            now += float(side[base["_k"][:, g]].mean())
            sc += float(side[scn["_k"][:, g]].mean())
            series.append({"iso": gm.get("iso"), "date": gm.get("date"), "now": now, "scenario": sc,
                           "opponent": gm["away_team"] if gm["home_team"] == t else gm["home_team"],
                           "locked": g in fixed})
        # Ankkurointi kuten _team_rows: nykykäyrä päättyy julkaistuun pistemäärään ja skenaarion ero
        # kerrotaan (1 - crowd_weight):lla, joten kuvaaja ja taulukko näyttävät samat loppuluvut.
        b0, raw_end = series[0]["now"], series[-1]["now"]
        k = (published[t]["points"] - b0) / (raw_end - b0) if raw_end != b0 else 1.0
        for pt in series:
            raw_now, raw_scn = pt["now"], pt["scenario"]
            pt["now"] = b0 + (raw_now - b0) * k
            pt["scenario"] = pt["now"] + (1 - crowd_weight) * (raw_scn - raw_now)
        points[t] = series
    return {"focus": focus, "dist": dist, "points": points}


# ------------------------------------------------------- skenaariopaneeli (sovellus)
PANEL_GOALS = ("avoid_relegation", "top10", "top6", "win")
PANEL_STREAKS = (0, 3, 5, 10)


def panel(team: str, goals: tuple[str, ...], streak: int, games, banked, published, w, played=None,
          base: dict | None = None, today: str | None = None) -> dict[str, dict]:
    """Joukkuesivun "mitä vaaditaan" + "entä jos voittaa seuraavat N": {tavoite: vastaus}.
    Sama muoto kaikkialla: paikallinen reitti, Snowflaken MODE 'panel' ja Pagesin
    esilaskettu tiedosto (scripts/deploy/scenario_static.py). Kaikki tavoitteet
    yhdellä simulaatiolla per putki."""
    want = [{"team": team, "goal": g} for g in goals]
    base = base or simulate(games, banked, sorted(published))
    b = compute(want, games, banked, published, w, played, base=base, today=today)
    s = None
    if streak:
        try:
            s = compute([{"team": team, "result": "win", "games": streak}, *want], games, banked, published, w,
                        played, base=base, today=today)
        except ScenarioError:
            s = None                     # kautta jäljellä vähemmän kuin putki
    out = {}
    for i, g in enumerate(goals):
        st = None
        if s:
            movers = sorted(({"team": r["team"], "d": r["points_scenario"] - r["points_now"]} for r in s["teams"]
                             if r["team"] != team and abs(r["points_scenario"] - r["points_now"]) >= 0.3),
                            key=lambda m: m["d"])[:6]
            st = {"games": streak, "req": s["requirements"][i], "locked": s["locked_games"], "movers": movers}
        out[g] = {"team": team, "goal": g, "base": b["requirements"][i], "streak": st}
    return out


def panel_request(req: dict, teams: list[str]) -> tuple[str, str, int]:
    team = _team_of({t.lower(): t for t in teams}, req.get("team"))
    goal = str(req.get("goal", ""))
    streak = int(req.get("streak") or 0)
    if goal not in PANEL_GOALS or streak not in PANEL_STREAKS:
        raise ScenarioError("virheellinen skenaario")
    return team, goal, streak


# ------------------------------------------------ poissaolot (joukkuesivu, J2/V6)
REGULAR_LAST, REGULAR_MIN = 10, 7          # vakio: kokoonpanossa 7 joukkueen 10 edellisestä
ABSENCE_DAYS = {"week": 7, "month": 28, "season": None}
LINEUP_SQL = """
    SELECT l.team, SUBSTR(g.start_ts, 1, 10) || '|' || CAST(l.game_id AS VARCHAR) AS game_key,
           l.player_id, l.first_name || ' ' || l.last_name AS name
    FROM {lineups} l JOIN {games} g ON g.season = l.season AND g.game_id = l.game_id
    WHERE l.season = (SELECT MAX(season) FROM {games}) AND g.ended AND l.line IS NOT NULL
      AND l.position_group <> 'G' AND NOT COALESCE(l.removed, FALSE)"""


def _regulars(prev: list[dict]) -> set:
    counts: dict = {}
    for g in prev:
        for pid in g:
            counts[pid] = counts.get(pid, 0) + 1
    need = math.ceil(REGULAR_MIN / REGULAR_LAST * len(prev))
    return {pid for pid, c in counts.items() if c >= need}


def missing_regulars(lineups: list[dict], team: str) -> tuple[list[dict], float]:
    """Vakiot (kokoonpanossa 7/10 edellisestä), jotka puuttuivat joukkueen viimeisimmästä
    pelatusta ottelusta, ja perustaso: montako vakiota tavallisesti puuttuu (keskiarvo 10
    edellisestä ottelusta samalla säännöllä). Puuttuminen voi olla myös lepuutus."""
    games: dict[str, dict] = {}
    names: dict = {}
    for r in lineups:
        if r["team"] == team and r["player_id"] is not None:
            games.setdefault(r["game_key"], {})[int(r["player_id"])] = r["name"]
            names[int(r["player_id"])] = r["name"]
    keys = sorted(games)
    if len(keys) < 6:
        return [], 0.0

    def miss(i: int) -> set:
        return _regulars([games[k] for k in keys[max(0, i - REGULAR_LAST):i]]) - set(games[keys[i]])
    last = len(keys) - 1
    hist = [len(miss(i)) for i in range(max(5, last - REGULAR_LAST), last)]
    return ([{"player_id": pid, "name": names[pid]} for pid in sorted(miss(last), key=lambda x: names[x])],
            sum(hist) / len(hist) if hist else 0.0)


def _alive_goal(published: dict, team: str) -> str:
    """Joukkueen elävin tavoite: julkaistu todennäköisyys lähimpänä 50 %:a."""
    return min(GOAL_PUB, key=lambda g: abs((_pub_goal(published, team, g) or 0.0) - 0.5))


def absence(team: str, lineups: list[dict], games, banked, published, w, played, model, base=None, today=None) -> dict:
    """Joukkuesivun poissaolokortti: puuttuvien vakioiden vaikutus elävimpään tavoitteeseen
    kolmella kestolla. Näytetään vain, kun puuttuvia on yli perustason JA loppukauden
    vaikutus on vähintään 1 %-yks. (mitattu: lähes kaikilta puuttuu joku)."""
    missing, baseline = missing_regulars(lineups, team)
    ids = {_pid(p.get("player_id")) for p in model["players"] if p["position_group"] != "G"}
    missing = [m for m in missing if m["player_id"] in ids]
    goal = _alive_goal(published, team)
    out = {"team": team, "goal": goal, "missing": missing, "baseline": baseline, "durations": {}, "show": False}
    if not missing:
        return out
    base = base or simulate(games, banked, sorted(published))
    for key, days in ABSENCE_DAYS.items():
        items = [{"injury": m["player_id"], **({"days": days} if days else {})} for m in missing]
        req = compute([*items, {"team": team, "goal": goal}], games, banked, published, w, played, model,
                      base=base, today=today)["requirements"][0]
        out["durations"][key] = {"p_now": req["p_without_injury"], "p": req["p"]}
    s = out["durations"]["season"]
    out["show"] = len(missing) > baseline and abs(s["p"] - s["p_now"]) >= 0.01
    return out


def _pct(x: float) -> str:
    return f"{x * 100:.1f}".replace(".", ",")


def _signed(x: float, d: int = 1) -> str:
    return (f"{x:+.{d}f}").replace(".", ",").replace("-", "−")


def _num(x: float) -> str:
    return f"{x:.1f}".replace(".", ",").replace("-", "−")


def render(res: dict, forecast_date: str) -> str:
    """Valmis suomenkielinen teksti agentille: lukitut ottelut ja ne joukkueet,
    joiden luvut liikkuivat (tai jotka olivat skenaariossa)."""
    L = [f"SKENAARIO (ennuste {forecast_date}, 10 000 simulaatiota, samat satunnaisluvut kuin perustasossa)"]
    for x in res.get("shifts", []):
        pct = (f"{100 * x['share_before']:.1f} % -> {100 * x['share_after']:.1f} %").replace(".", ",")
        L.append(f"JOUKKUEEN MUUTOS: {x['team']} xG-osuus {pct} ({x['n_games']} ottelua, {x['first']}–{x['last']})")
    for x in res.get("injuries", []):
        pos = {"F": "hyökkääjä", "D": "puolustaja", "G": "maalivahti"}[x["position_group"]]
        rate = (f"torjuntaennuste {x['rate'] * 100:.1f} %".replace(".", ",") if x["position_group"] == "G"
                else f"ennuste {x['rate']:.2f} maalia/ottelu".replace(".", ","))
        if x.get("until"):
            span = f"{x['until']} asti = {x['n_games']} ottelua"
        elif x.get("days"):
            span = f"{x['days']} päivää = {x['n_games']} ottelua"
        elif x.get("games"):
            span = f"{x['n_games']} seuraavaa ottelua"
        else:
            span = f"koko loppukausi ({x['n_games']} ottelua)"
        L.append(f"LOUKKAANTUMINEN: {x['name']} ({x['team']}, {pos}, {rate}) poissa: {span}")
        if x["n_ramp"]:
            L.append(f"- Paluu {x['return_date']}: {x['n_ramp']} ensimmäisessä ottelussa vaikutuksesta jäljellä "
                     f"{_pct(x['ramp_effect'])} % (hidas alku), sen jälkeen normaali taso")
        elif x.get("return_date"):
            L.append(f"- Paluu {x['return_date']} normaalilla tasolla")
        L.append(f"- Poissa ollessa ({x['team']}): odotetut tehdyt maalit/ottelu {_signed(x['d_goals_for'], 2)}, "
                 f"päästetyt {_signed(x['d_goals_against'], 2)} (mallin kaavoilla, tilalle seuraava pelaaja)")
        if x["win_before"] is not None:
            L.append(f"- Voittotodennäköisyys poissaolon otteluissa keskimäärin ({x['team']}): "
                     f"{_pct(x['win_before'])} % -> {_pct(x['win_after'])} %")
        L.append(f"- Odotetut pisteet jaksolta ({len(x['game_rows'])} ottelua): {_num(x['xp_window_before'])} -> "
                 f"{_num(x['xp_window_after'])} ({_signed(x['xp_window_after'] - x['xp_window_before'])})")
        if x["game_rows"] and len(x["game_rows"]) <= 30:
            L.append(f"Ottelut jaksolla ({x['team']}): päivä | vastustaja | koti/vieras | vaihe | voitto % ennen -> nyt | odotetut pisteet ennen -> nyt")
            for r in x["game_rows"]:
                L.append(f"{r['date']} | {r['opponent']} | {'koti' if r['home'] else 'vieras'} | {r['phase']} | "
                         f"{_pct(r['win_before'])} -> {_pct(r['win_after'])} | "
                         f"{r['xp_before']:.2f} -> {r['xp_after']:.2f}".replace(".", ",")
                         .replace(f"{r['date'].replace('.', ',')}", r["date"], 1))
    for r in res.get("requirements", []):
        L += render_requirement(r)
    if res["locked_games"]:
        L.append("Lukitut ottelut:")
        L += [f"- {g['date']} {g['game']}: {g['result']}" for g in res["locked_games"]]
    if not res["locked_games"] and not res.get("injuries") and not res.get("shifts"):
        return "\n".join(L)
    involved = {t for g in res["locked_games"] for t in g["game"].split("–")} | {x["team"] for x in res.get("shifts", [])}
    # Jatkoon (sijat 1-10) mukaan 7.11.2026: agentti vastaa ensin siihen, pääseekö joukkue jatkoon.
    L.append("Joukkue | sija nyt -> skenaario | pisteet nyt -> skenaario | runkosarjan voitto % | "
             "top 6 % | jatkoon (1.-10.) % | putoaminen (15.-17.) %")
    for r in res["teams"]:
        moved = (abs(r["points_scenario"] - r["points_now"]) >= 0.3 or r["rank_now"] != r["rank_scenario"]
                 or any(abs(r[f"{k}_scenario"] - r[f"{k}_now"]) >= 0.01
                        for k in ("p_title", "p_top6", "p_top10", "p_relegation") if f"{k}_now" in r))
        if not (moved or r["team"] in involved):
            continue
        L.append(f"{r['team']} | {r['rank_now']}. -> {r['rank_scenario']}. | "
                 f"{_num(r['points_now'])} -> {_num(r['points_scenario'])} | "
                 f"{_pct(r['p_title_now'])} -> {_pct(r['p_title_scenario'])} | "
                 f"{_pct(r['p_top6_now'])} -> {_pct(r['p_top6_scenario'])} | "
                 f"{_pct(r.get('p_top10_now', float('nan')))} -> {_pct(r.get('p_top10_scenario', float('nan')))} | "
                 f"{_pct(r['p_relegation_now'])} -> {_pct(r['p_relegation_scenario'])}")
    L.append("Muut joukkueet: muutos alle 0,3 pistettä ja alle 1 prosenttiyksikkö.")
    return "\n".join(L)


def render_requirement(r: dict) -> list[str]:
    rem = r["remaining"]
    exp_rest = r["expected_final"] - r["banked"]
    L = [f"MITÄ VAADITAAN: {r['team']} {r['goal']} (sija {r['limit']}. tai parempi)",
         f"- Todennäköisyys nyt: {_pct(r['p'])} %"
         + (f" (ilman poissaoloa {_pct(r['p_without_injury'])} %)" if "p_without_injury" in r else ""),
         (f"- Pisteet nyt {r['banked']:.0f} {r['played']} ottelusta ({_num(r['banked'] / r['played'])} p/ottelu), "
          if r.get("played") else f"- Pisteet nyt {r['banked']:.0f}, ")
         + f"otteluita jäljellä {rem}.",
         f"- Mallin odotus loppukaudesta {_num(exp_rest)} p ({_num(exp_rest / rem if rem else 0)} p/ottelu) "
         f"-> loppupisteet {_num(r['expected_final'])} (mallin oma simulaatio, ilman yleisöarviota)"]
    for thr, label in ((0.5, "50 %"), (0.8, "80 %"), (0.95, "95 %")):
        x = r["need"][thr]
        if x is None:
            L.append(f"- {label} varmuus: ei saavuteta yhdessäkään simuloidussa pistemäärässä")
            continue
        more = x - r["banked"]
        L.append(f"- {label} varmuus: {x:.0f} loppupistettä = {more:.0f} p {rem} ottelusta "
                 f"({_num(more / rem if rem else 0)} p/ottelu)")
    L.append(f"- Sijan {r['limit']}. pisteraja simulaatioissa: keskimäärin {_num(r['line_mean'])} p "
             f"(5-95 %: {r['line_p05']:.0f}-{r['line_p95']:.0f})")
    L.append(f"- Kilpakumppanit rajalla (useimmin sijoilla {max(1, r['limit'] - 2)}.-{r['limit'] + 3}.): "
             + ", ".join(r["rivals"]))
    if r.get("rival_rows"):
        L.append(f"Miten kilpakumppanien pitää pelata (kaudet joissa {r['team']} {r['goal']} vs. mallin odotus):")
        L.append("Joukkue | loppupisteet odotus -> kun tavoite toteutuu | p/ottelu loppukaudesta odotus -> kun toteutuu"
                 f" | {r['team']}: todennäköisyys jos tämä joukkue jää mediaaniensa alle")
        for x in r["rival_rows"]:
            L.append(f"{x['team']} | {_num(x['expected'])} -> {_num(x['when_goal'])} "
                     f"({_num(x['when_goal'] - x['expected'])}) | {_num(x['ppg_expected'])} -> {_num(x['ppg_when_goal'])} | "
                     f"{_pct(x['p_goal_if_below'])} %")
    L.append("- p/ottelu: 3 = voitto varsinaisella peliajalla, 2 = jatkoaikavoitto, 1 = jatkoaikatappio.")
    return L


def parse(scenario_json: str, allow_empty: bool = False) -> list[dict]:
    try:
        s = json.loads(scenario_json)
    except (TypeError, ValueError) as exc:
        raise ScenarioError(f"skenaario ei ole JSONia: {exc}") from exc
    if isinstance(s, dict):
        s = s.get("scenario", [s]) if "team" not in s else [s]
    if not isinstance(s, list) or (not s and not allow_empty):
        raise ScenarioError("skenaario on tyhjä: anna lista, esim. [{\"team\": \"Ilves\", \"result\": \"win\"}]")
    return s


# --------------------------------------------------------------- Snowflake
def load(session) -> tuple[list[dict], dict, dict, float, str, dict]:
    """Snowpark: lukee samat taulut joista ennuste julkaistiin."""
    snap = session.sql("SELECT MAX(snapshot_date) FROM LIIGA.MODEL.PREDICTION_GAMES").collect()[0][0]
    games = [r.as_dict() for r in session.sql(f"""
        SELECT TO_CHAR(CONVERT_TIMEZONE('Europe/Helsinki', TO_TIMESTAMP_TZ(s.start_ts)), 'DD.MM.') AS "date",
               TO_CHAR(CONVERT_TIMEZONE('Europe/Helsinki', TO_TIMESTAMP_TZ(s.start_ts)), 'YYYY-MM-DD') AS "iso",
               p.game_id AS "game_id", p.home_team AS "home_team", p.away_team AS "away_team",
               p.p_home_reg AS "p_home_reg", p.p_overtime AS "p_overtime", p.p_home_ot_win AS "p_home_ot_win"
        FROM LIIGA.MODEL.PREDICTION_GAMES p
        JOIN LIIGA.MODEL.STG_GAMES s ON s.season = 2027 AND s.game_id = p.game_id
        WHERE p.snapshot_date = '{snap}' AND NOT s.ended
        ORDER BY TO_TIMESTAMP_TZ(s.start_ts), p.game_id""").collect()]
    banked: dict[str, float] = {}
    played: dict[str, int] = {}
    for r in session.sql("""SELECT home_team, away_team, home_points, away_points
                            FROM LIIGA.MODEL.STG_GAMES WHERE season = 2027 AND ended""").collect():
        banked[r[0]] = banked.get(r[0], 0) + r[2]
        banked[r[1]] = banked.get(r[1], 0) + r[3]
        played[r[0]] = played.get(r[0], 0) + 1
        played[r[1]] = played.get(r[1], 0) + 1
    published = {r[0]: {"points": r[1], "p_title": r[2], "p_top6": r[3], "p_relegation": r[4], "p_top10": r[5]}
                 for r in session.sql("""
        SELECT s.team, s.mean_points, s.p_title, z.p_top6_quarterfinal, z.p_relegation_15_17, z.p_playoffs_any
        FROM LIIGA.MODEL.STANDINGS_2026_27 s JOIN LIIGA.MODEL.V_ZONE_PROBABILITIES z ON z.team = s.team""").collect()}
    w = session.sql("SELECT crowd_weight_eff FROM LIIGA.MODEL.PREDICTION_META").collect()[0][0] or 0.0
    return games, banked, published, float(w), str(snap), played


def load_model(session) -> dict:
    """Pelaaja- ja joukkuedata loukkaantumisskenaariolle (vain kun sitä tarvitaan)."""
    players = [{"name": r[0], "team": r[1], "position_group": r[2], "projected_goals_per_game": r[3],
                "player_id": _pid(r[4])}
               for r in session.sql("""SELECT name, team, position_group, projected_goals_per_game, player_id
                                       FROM LIIGA.MODEL.PLAYER_RATES""").collect()]
    goalies = [{"team": r[0], "name": r[1], "proj_save_pct": r[2], "wt": r[3]}
               for r in session.sql("""SELECT team, name, proj_save_pct, wt
                                       FROM LIIGA.MODEL.TEAM_GOALIE_WEIGHTS""").collect()]
    strength = {r[0]: {"off_rating": r[1], "def_rating": r[2]}
                for r in session.sql("SELECT team, off_rating, def_rating FROM LIIGA.MODEL.TEAM_STRENGTH").collect()}
    today = session.sql("SELECT TO_CHAR(TO_DATE(CONVERT_TIMEZONE('Europe/Helsinki', CURRENT_TIMESTAMP())), "
                        "'YYYY-MM-DD')").collect()[0][0]
    return {"players": players, "goalies": goalies, "strength": strength, "today": today}


def to_json(res: dict, forecast_date: str) -> str:
    def clean(o):
        if isinstance(o, dict):
            return {str(k): clean(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)):
            return [clean(v) for v in o]
        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, (np.floating, float)):
            return None if o != o else float(o)
        return o
    return json.dumps(clean({**res, "forecast_date": forecast_date}), ensure_ascii=False)


def needs_model(sc: list[dict]) -> bool:
    return any(it.get("injury") is not None or it.get("player_id") is not None or it.get("xg_share") is not None for it in sc)


def load_lineups(session) -> list[dict]:
    """Pelattujen otteluiden kokoonpanot (kenttäpelaajat) poissaolokorttiin."""
    sql = LINEUP_SQL.format(lineups="LIIGA.RAW.GAME_LINEUPS", games="LIIGA.MODEL.STG_GAMES")
    return [{"team": r[0], "game_key": r[1], "player_id": r[2], "name": r[3]} for r in session.sql(sql).collect()]


def run(session, scenario: str, mode: str = "text") -> str:
    """Proseduurin käsittelijä. MODE 'text' (agentti, oletus), 'json' (sovellus) tai
    'panel' ({"team", "goal", "streak"} -> joukkuesivun skenaariopaneeli) tai 'absence'
    ({"team"} -> joukkuesivun poissaolokortti).
    Virhe palautetaan tekstinä tai {"error": ..}, jotta agentti voi kertoa sen
    käyttäjälle ja pyytää tarkennusta."""
    js = str(mode or "text").lower() in ("json", "panel", "absence")
    try:
        if str(mode).lower() == "absence":
            games, banked, published, w, snap, played = load(session)
            team = _team_of({t.lower(): t for t in published}, json.loads(scenario).get("team"))
            res = absence(team, load_lineups(session), games, banked, published, w, played, load_model(session))
            return to_json({**res, "forecastDate": str(snap)}, str(snap))
        if str(mode).lower() == "panel":
            games, banked, published, w, snap, played = load(session)
            team, goal, streak = panel_request(json.loads(scenario), sorted(published))
            res = panel(team, (goal,), streak, games, banked, published, w, played)[goal]
            return to_json({**res, "forecastDate": str(snap)}, str(snap))
        sc = parse(scenario, allow_empty=js)
        games, banked, published, w, snap, played = load(session)
        model = load_model(session) if needs_model(sc) else None
        res = compute(sc, games, banked, published, w, played, model)
        if js:
            return to_json(res, str(snap))
        return render(res, f"{int(snap[8:10])}.{int(snap[5:7])}.{snap[:4]}")
    except ScenarioError as exc:
        return json.dumps({"error": str(exc)}, ensure_ascii=False) if js else f"SKENAARIOTA EI VOITU AJAA: {exc}"
