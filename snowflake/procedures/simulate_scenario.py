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

Puhdas Python + numpy: sama tiedosto ajetaan paikallisesti testissä
(tests/test_simulate_scenario.py) ja Snowflaken proseduurina (handler `run`).
"""
from __future__ import annotations

import json

import numpy as np

N_SIMS = 10_000
SEED = 42
PTS = {"reg_win": 3, "ot_win": 2, "ot_loss": 1, "reg_loss": 0}
RESULTS = {
    "win": ("home_reg", "home_ot"), "reg_win": ("home_reg",), "ot_win": ("home_ot",),
    "loss": ("away_reg", "away_ot"), "reg_loss": ("away_reg",), "ot_loss": ("away_ot",),
}
FLIP = {"home_reg": "away_reg", "home_ot": "away_ot", "away_reg": "home_reg", "away_ot": "home_ot"}
ALIASES = {"voitto": "win", "tappio": "loss", "häviö": "loss", "jatkoaikavoitto": "ot_win",
           "jatkoaikatappio": "ot_loss", "regulation_win": "reg_win", "regulation_loss": "reg_loss"}


class ScenarioError(ValueError):
    """Skenaariota ei voi tulkita; viesti kerrotaan käyttäjälle."""


def resolve(scenario: list[dict], games: list[dict], teams: set[str]) -> dict[int, tuple[str, ...]]:
    """Skenaarion rivit -> {pelaamattoman ottelun indeksi: sallitut tulokset kotijoukkueen
    näkökulmasta}. `games` on aikajärjestyksessä."""
    fixed: dict[int, tuple[str, ...]] = {}
    lower = {t.lower(): t for t in teams}
    for item in scenario:
        team = lower.get(str(item.get("team", "")).strip().lower())
        if not team:
            raise ScenarioError(f"tuntematon joukkue {item.get('team')!r}; joukkueet: {', '.join(sorted(teams))}")
        res = str(item.get("result", "win")).strip().lower()
        res = ALIASES.get(res, res)
        if res not in RESULTS:
            raise ScenarioError(f"tuntematon tulos {item.get('result')!r}; käytä {', '.join(RESULTS)}")
        opp = item.get("opponent")
        if opp:
            opp = lower.get(str(opp).strip().lower())
            if not opp:
                raise ScenarioError(f"tuntematon vastustaja {item.get('opponent')!r}")
        n = int(item.get("games") or 1)
        hits = [i for i, g in enumerate(games)
                if team in (g["home_team"], g["away_team"])
                and (not opp or opp in (g["home_team"], g["away_team"]))][:n]
        if len(hits) < n:
            raise ScenarioError(f"{team}: pelaamattomia otteluita löytyi {len(hits)}, pyydettiin {n}")
        for i in hits:
            allowed = RESULTS[res] if games[i]["home_team"] == team else tuple(FLIP[o] for o in RESULTS[res])
            if i in fixed and set(fixed[i]) != set(allowed):
                g = games[i]
                raise ScenarioError(f"ristiriita: {g['home_team']}–{g['away_team']} lukittu kahdesti eri tavoin")
            fixed[i] = allowed
    return fixed


def simulate(games: list[dict], banked: dict[str, float], teams: list[str],
             fixed: dict[int, tuple[str, ...]] | None = None) -> dict[str, np.ndarray]:
    """Monte Carlo kuten src/liiga/simulate.py. Satunnaisluvut arvotaan ennen
    lukitusta, joten kahdella kutsulla (fixed=None ja fixed=...) on samat luvut."""
    fixed = fixed or {}
    rng = np.random.default_rng(SEED)
    idx = {t: i for i, t in enumerate(teams)}
    G = len(games)
    u = rng.random((N_SIMS, G))
    jitter = rng.random((N_SIMS, len(teams))) * 1e-6
    points = np.zeros((N_SIMS, len(teams)))
    for t, b in banked.items():
        if t in idx:
            points[:, idx[t]] += b
    for g, gm in enumerate(games):
        hreg, ot, how = gm["p_home_reg"], gm["p_overtime"], gm["p_home_ot_win"]
        p = {"home_reg": hreg, "home_ot": ot * how, "away_ot": ot * (1 - how),
             "away_reg": max(0.0, 1.0 - hreg - ot)}
        allowed = fixed.get(g, ("home_reg", "home_ot", "away_ot", "away_reg"))
        order = [o for o in ("home_reg", "home_ot", "away_ot", "away_reg") if o in allowed]
        w = np.array([p[o] for o in order])
        w = w / w.sum() if w.sum() > 0 else np.full(len(order), 1 / len(order))
        # Sama u valitsee tuloksen sallittujen joukosta: lukittu ottelu käyttää
        # samaa satunnaislukua kuin perustasossa (common random numbers).
        cut = np.cumsum(w)
        k = np.minimum(np.searchsorted(cut, u[:, g], side="right"), len(order) - 1)
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
            "p_top6": (ranks <= 6).mean(axis=0), "p_relegation": (ranks >= n - 2).mean(axis=0),
            "_points": points, "_ranks": ranks}


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


def compute(scenario: list[dict], games: list[dict], banked: dict[str, float],
            published: dict[str, dict], crowd_weight: float,
            played: dict[str, int] | None = None) -> dict:
    teams = sorted(published)
    goals = [it for it in scenario if it.get("goal")]
    fixed = resolve([it for it in scenario if not it.get("goal")], games, set(teams))
    base = simulate(games, banked, teams)
    scn = simulate(games, banked, teams, fixed) if fixed else base
    lower = {t.lower(): t for t in teams}
    reqs = []
    for g in goals:
        t = lower.get(str(g.get("team", "")).strip().lower())
        if not t:
            raise ScenarioError(f"tuntematon joukkue {g.get('team')!r}")
        named = []
        for rv in g.get("rivals") or []:
            rt = lower.get(str(rv).strip().lower())
            if not rt:
                raise ScenarioError(f"tuntematon kilpakumppani {rv!r}")
            named.append(rt)
        reqs.append(requirement(t, str(g["goal"]).strip().lower(), scn, games, banked, teams, played,
                                named or None))
    rows = []
    for i, t in enumerate(teams):
        pub = published[t]
        rows.append({
            "team": t,
            "points_now": pub["points"],
            "points_scenario": pub["points"] + (1 - crowd_weight) * (scn["points"][i] - base["points"][i]),
            **{f"{k}_now": pub[k] for k in ("p_title", "p_top6", "p_relegation")},
            **{f"{k}_scenario": min(1.0, max(0.0, pub[k] + scn[k][i] - base[k][i]))
               for k in ("p_title", "p_top6", "p_relegation")},
        })
    for key in ("now", "scenario"):
        for r, row in enumerate(sorted(rows, key=lambda x: -x[f"points_{key}"]), start=1):
            row[f"rank_{key}"] = r
    locked = []
    for g, allowed in sorted(fixed.items()):
        gm = games[g]
        desc = {("home_reg", "home_ot"): f"{gm['home_team']} voittaa",
                ("away_ot", "away_reg"): f"{gm['away_team']} voittaa",
                ("home_reg",): f"{gm['home_team']} voittaa varsinaisella peliajalla",
                ("home_ot",): f"{gm['home_team']} voittaa jatkoajalla",
                ("away_ot",): f"{gm['away_team']} voittaa jatkoajalla",
                ("away_reg",): f"{gm['away_team']} voittaa varsinaisella peliajalla"}
        key = tuple(o for o in ("home_reg", "home_ot", "away_ot", "away_reg") if o in allowed)
        locked.append({"date": gm["date"], "game": f"{gm['home_team']}–{gm['away_team']}",
                       "result": desc.get(key, "/".join(key))})
    return {"locked_games": locked, "teams": sorted(rows, key=lambda x: x["rank_scenario"]),
            "requirements": reqs}


def _pct(x: float) -> str:
    return f"{x * 100:.1f}".replace(".", ",")


def _num(x: float) -> str:
    return f"{x:.1f}".replace(".", ",").replace("-", "−")


def render(res: dict, forecast_date: str) -> str:
    """Valmis suomenkielinen teksti agentille: lukitut ottelut ja ne joukkueet,
    joiden luvut liikkuivat (tai jotka olivat skenaariossa)."""
    L = [f"SKENAARIO (ennuste {forecast_date}, 10 000 simulaatiota, samat satunnaisluvut kuin perustasossa)"]
    for r in res.get("requirements", []):
        L += render_requirement(r)
    if not res["locked_games"]:
        return "\n".join(L)
    L.append("Lukitut ottelut:")
    L += [f"- {g['date']} {g['game']}: {g['result']}" for g in res["locked_games"]]
    involved = {t for g in res["locked_games"] for t in g["game"].split("–")}
    L.append("Joukkue | sija nyt -> skenaario | pisteet nyt -> skenaario | runkosarjan voitto % | "
             "top 6 % | putoaminen (15.-17.) %")
    for r in res["teams"]:
        moved = (abs(r["points_scenario"] - r["points_now"]) >= 0.3 or r["rank_now"] != r["rank_scenario"]
                 or any(abs(r[f"{k}_scenario"] - r[f"{k}_now"]) >= 0.01
                        for k in ("p_title", "p_top6", "p_relegation")))
        if not (moved or r["team"] in involved):
            continue
        L.append(f"{r['team']} | {r['rank_now']}. -> {r['rank_scenario']}. | "
                 f"{_num(r['points_now'])} -> {_num(r['points_scenario'])} | "
                 f"{_pct(r['p_title_now'])} -> {_pct(r['p_title_scenario'])} | "
                 f"{_pct(r['p_top6_now'])} -> {_pct(r['p_top6_scenario'])} | "
                 f"{_pct(r['p_relegation_now'])} -> {_pct(r['p_relegation_scenario'])}")
    L.append("Muut joukkueet: muutos alle 0,3 pistettä ja alle 1 prosenttiyksikkö.")
    return "\n".join(L)


def render_requirement(r: dict) -> list[str]:
    rem = r["remaining"]
    exp_rest = r["expected_final"] - r["banked"]
    L = [f"MITÄ VAADITAAN: {r['team']} {r['goal']} (sija {r['limit']}. tai parempi)",
         f"- Todennäköisyys nyt: {_pct(r['p'])} %",
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


def parse(scenario_json: str) -> list[dict]:
    try:
        s = json.loads(scenario_json)
    except (TypeError, ValueError) as exc:
        raise ScenarioError(f"skenaario ei ole JSONia: {exc}") from exc
    if isinstance(s, dict):
        s = s.get("scenario", [s]) if "team" not in s else [s]
    if not isinstance(s, list) or not s:
        raise ScenarioError("skenaario on tyhjä: anna lista, esim. [{\"team\": \"Ilves\", \"result\": \"win\"}]")
    return s


# --------------------------------------------------------------- Snowflake
def load(session) -> tuple[list[dict], dict, dict, float, str, dict]:
    """Snowpark: lukee samat taulut joista ennuste julkaistiin."""
    snap = session.sql("SELECT MAX(snapshot_date) FROM LIIGA.MODEL.PREDICTION_GAMES").collect()[0][0]
    games = [r.as_dict() for r in session.sql(f"""
        SELECT TO_CHAR(CONVERT_TIMEZONE('Europe/Helsinki', TO_TIMESTAMP_TZ(s.start_ts)), 'DD.MM.') AS "date",
               p.home_team AS "home_team", p.away_team AS "away_team",
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
    published = {r[0]: {"points": r[1], "p_title": r[2], "p_top6": r[3], "p_relegation": r[4]}
                 for r in session.sql("""
        SELECT s.team, s.mean_points, s.p_title, z.p_top6_quarterfinal, z.p_relegation_15_17
        FROM LIIGA.MODEL.STANDINGS_2026_27 s JOIN LIIGA.MODEL.V_ZONE_PROBABILITIES z ON z.team = s.team""").collect()}
    w = session.sql("SELECT crowd_weight_eff FROM LIIGA.MODEL.PREDICTION_META").collect()[0][0] or 0.0
    return games, banked, published, float(w), str(snap), played


def run(session, scenario: str) -> str:
    """Proseduurin käsittelijä. Virhe palautetaan tekstinä, jotta agentti voi
    kertoa sen käyttäjälle ja pyytää tarkennusta."""
    try:
        games, banked, published, w, snap, played = load(session)
        d = f"{int(snap[8:10])}.{int(snap[5:7])}.{snap[:4]}"
        return render(compute(parse(scenario), games, banked, published, w, played), d)
    except ScenarioError as exc:
        return f"SKENAARIOTA EI VOITU AJAA: {exc}"
