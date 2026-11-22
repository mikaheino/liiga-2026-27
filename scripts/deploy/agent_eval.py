"""Liiga Ennustaja -agentin evaluointi Snowflaken Cortex Agent Evaluationsilla.

    .venv/bin/python scripts/deploy/agent_eval.py                     # PRODUCTION-alias
    .venv/bin/python scripts/deploy/agent_eval.py --version DEV       # oma kokeiluversio
    .venv/bin/python scripts/deploy/agent_eval.py --version STAGING --gate   # CI:n ehdokas

Mitä tekee, joka ajolla:
  1. rakentaa kultaisen testijoukon LIIGA.EVALS.GOLDEN tuoreesta datasta --
     odotetut vastaukset lasketaan SQL:llä näkymistä juuri ennen ajoa, koska
     "kuka johtaa pistepörssiä" muuttuu joka päivä eikä kiinteä vastaus pysy
     oikeana viikkoa
  2. rekisteröi sen datasetiksi (SYSTEM$CREATE_EVALUATION_DATASET), nimi
     ajokohtainen, jotta vanhat ajot pysyvät vertailukelpoisina
  3. vie YAML-konfiguraation stagelle @LIIGA.EVALS.EVAL_CONFIG
  4. EXECUTE_AI_EVALUATION('START'), odottaa STATUSta, tiivistää tuloksen
     tiedostoon docs/agent_evals.md (append-only)

Mittarit: answer_correctness ja logical_consistency (v3), tool_selection_accuracy
(Public Preview, vertaa odotettua työkalua) ja oma vastaa_suomeksi -- agentin
ohje on vastata aina suomeksi.

Kohdistetaan versioon tai aliakseen, ei agenttiin yleensä: oppaan mukaan
vertailut yli ajan tehdään lukittua versiota vasten. Agentilla ei ole
live-versiota (deploy_agent.py), joten kohde on aina nimetty versio.
Ajetaan ACCOUNTADMINina (tarvitsee MONITOR/USAGE agenttiin, CREATE TABLE /
DATASET / STAGE / TASK -oikeudet); ACCOUNTADMIN perii agentin omistajaroolin
SYSADMINin kautta.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import tempfile
import time
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
import sys as _sys

_sys.path.insert(0, str(Path(__file__).resolve().parent))
from snow_conn import conn as _conn  # noqa: E402

# ajo luo taustatehtävän nykyiseen skeemaan, joten LIIGA.EVALS istunnon oletukseksi
CONN = _conn(database="LIIGA", schema="EVALS")   # ajo luo taustatehtävän nykyiseen skeemaan
DB, SCHEMA = "LIIGA", "EVALS"
STAGE = f"{DB}.{SCHEMA}.EVAL_CONFIG"
TABLE = f"{DB}.{SCHEMA}.GOLDEN"
TODAY = "TO_DATE(CONVERT_TIMEZONE('Europe/Helsinki', CURRENT_TIMESTAMP()))"
M = "LIIGA.MODEL"
E, K, S, L, T = "liiga_ennuste", "liiga_kausi", "liiga_skenaario", "liiga_kokoonpanot", "liiga_tieto"
N = "liiga_media"   # uutiset (22.11.2026)

# (kysymys, odotettu työkalu tai None, SQL-lauseke joka palauttaa odotetun vastauksen)
GOLDEN: list[tuple[str, str | None, str]] = [
    ("Mikä on sarjatilanne nyt?", K,
     f"""(SELECT 'Kärjessä ' || LISTAGG(team || ' ' || points || ' p', ', ') WITHIN GROUP (ORDER BY table_rank, team)
          FROM {M}.V_TEAM_SEASON_NOW WHERE table_rank <= 3)
         || '. Viimeisenä ' || (SELECT team || ' ' || points || ' p' FROM {M}.V_TEAM_SEASON_NOW
                                ORDER BY table_rank DESC LIMIT 1) || '.'"""),
    ("Kuka johtaa pistepörssiä?", K,
     f"""(SELECT 'Pistepörssiä johtaa ' || LISTAGG(player_name || ' (' || team || ') ' || points || ' pistettä', ' ja ')
          FROM {M}.V_PLAYER_SEASON_NOW WHERE points = (SELECT MAX(points) FROM {M}.V_PLAYER_SEASON_NOW)) || '.'"""),
    ("Kuka on tehnyt eniten maaleja tällä kaudella?", K,
     f"""(SELECT 'Eniten maaleja: ' || LISTAGG(player_name || ' (' || team || ') ' || goals || ' maalia', ' ja ')
          FROM {M}.V_PLAYER_SEASON_NOW WHERE goals = (SELECT MAX(goals) FROM {M}.V_PLAYER_SEASON_NOW)) || '.'"""),
    # Pelaajan aiemmat kaudet (6.11.2026): agentti vastasi "menneiden kausien
    # pelaajakohtaisia pisteitä ei löydy", vaikka data on V_PLAYER_SEASONSissa.
    ("Miten Daniel Mäkiaho on tehnyt pisteitä aiempina kausina?", K,
     f"""(SELECT 'Daniel Mäkiaho, aiemmat Liiga-kaudet: ' || LISTAGG(season_label || ' ' || team || ' ' || points || ' pistettä', ', ')
             WITHIN GROUP (ORDER BY season, team) || '.'
          FROM {M}.V_PLAYER_SEASONS WHERE player_id = 32675788 AND NOT is_current_season)"""),
    ("Kuinka hyvin malli on osunut?", K,
     f"""(SELECT 'Malli on osunut ' || TO_CHAR(ROUND(AVG(model_correct) * 100, 1)) || ' %:iin otteluista ('
             || SUM(model_correct) || '/' || COUNT(*) || '). Vertailukohta aina kotijoukkue: '
             || TO_CHAR(ROUND(AVG(home_team_won) * 100, 1)) || ' %.' FROM {M}.V_GAME_EVALUATION)"""),
    ("Kuka voittaa runkosarjan?", E,
     f"""(SELECT 'Todennäköisin runkosarjan voittaja on ' || team || ' (' || TO_CHAR(ROUND(p_title * 100, 1))
             || ' %). Mestaruus tarkoittaa tässä runkosarjan voittoa; pudotuspelejä malli ei ennusta.'
          FROM {M}.STANDINGS_2026_27 ORDER BY p_title DESC LIMIT 1)"""),
    ("Ketkä putoavat?", E,
     f"""(SELECT 'Putoamisvaarassa (sijat 15.–17.): ' || LISTAGG(team || ' ' || TO_CHAR(ROUND(p_relegation_15_17 * 100, 1)) || ' %', ', ')
             WITHIN GROUP (ORDER BY p_relegation_15_17 DESC) || '.'
          FROM (SELECT * FROM {M}.V_ZONE_PROBABILITIES ORDER BY p_relegation_15_17 DESC LIMIT 3))"""),
    ("Millä todennäköisyydellä JYP pääsee kuuden joukkoon?", E,
     f"""(SELECT 'JYP sijoittuu kuuden joukkoon (1.–6.) ' || TO_CHAR(ROUND(p_top6_quarterfinal * 100, 1))
             || ' %:n todennäköisyydellä.' FROM {M}.V_ZONE_PROBABILITIES WHERE team = 'JYP')"""),
    ("Mikä on liigan ylivoimaprosentti tällä kaudella?", K,
     f"""(SELECT 'Liigan ylivoimaprosentti on ' || TO_CHAR(ROUND(SUM(pp_goals) / SUM(pp_instances) * 100, 1))
             || ' % (ylivoimamaalit / ylivoimatilanteet).' FROM {M}.V_TEAM_SEASON_NOW)"""),
    ("Paljonko otteluissa on keskimäärin yleisöä?", K,
     f"""(SELECT 'Keskimäärin ' || TO_CHAR(ROUND(AVG(IFF(ended, spectators, NULL)))) || ' katsojaa per pelattu ottelu.'
          FROM {M}.V_GAMES_NOW)"""),
    ("Kuka on ollut paras maalivahti?", K,
     f"""(SELECT 'Paras maalivahti on ' || goalie_name || ' (' || team || '): ' || TO_CHAR(ROUND(goals_saved_vs_average, 1))
             || ' maalia vähemmän kuin keskivertomaalivahti samoista paikoista.'
          FROM {M}.V_GOALIE_SEASON_NOW WHERE solo_games >= 3 ORDER BY goals_saved_vs_average DESC LIMIT 1)"""),
    ("Mitkä joukkueet ovat yllättäneet?", K,
     f"""(SELECT 'Eniten yli esikauden odotuksen: ' || LISTAGG(team || ' ' || TO_CHAR(ROUND(points_vs_preseason, 1), 'S990.0'), ', ')
             WITHIN GROUP (ORDER BY points_vs_preseason DESC) || '.'
          FROM (SELECT * FROM {M}.V_TEAM_SEASON_NOW ORDER BY points_vs_preseason DESC LIMIT 3))"""),
    ("Ketkä pelaajat ovat yllättäneet?", K,
     f"""(SELECT 'Eniten yli esikauden ennusteen: ' || LISTAGG(player_name || ' (' || team || ') '
             || TO_CHAR(ROUND(points_vs_preseason, 1), 'S990.0'), ', ') WITHIN GROUP (ORDER BY points_vs_preseason DESC) || '.'
          FROM (SELECT * FROM {M}.V_PLAYER_SEASON_NOW WHERE games_played >= 5
                ORDER BY points_vs_preseason DESC NULLS LAST LIMIT 3))"""),
    ("Mikä on varjosarjataulukko?", K,
     f"""(SELECT 'Varjosarjataulukko = pisteet maalipaikkojen (xG) mukaan. Kärjessä ' || team || ' '
             || TO_CHAR(ROUND(shadow_points, 1)) || ' p (oikeat pisteet ' || points || ').'
          FROM {M}.V_TEAM_SEASON_NOW ORDER BY shadow_points DESC LIMIT 1)"""),
    ("Onko KooKoon huono alku ollut huonoa tuuria?", K,
     f"""(SELECT 'KooKoolla on ' || points || ' pistettä, maalipaikat (xG) olisivat antaneet '
             || TO_CHAR(ROUND(shadow_points, 1)) || ' pistettä; ero ' || TO_CHAR(ROUND(points_over_shadow, 1))
             || '. Osittain huonoa tuuria, mutta myös maalipaikoissa heikko.'
          FROM {M}.V_TEAM_SEASON_NOW WHERE team = 'KooKoo')"""),
    ("Mikä on Tapparan todennäköinen kokoonpano?", K,
     f"""(SELECT 'Viimeisimmän pelatun ottelun kokoonpano; maalissa aloitti ' || MAX(IFF(goalie_started, player_name, NULL)) || '.'
          FROM {M}.V_LATEST_LINEUPS WHERE team = 'Tappara')"""),
    ("Miten joukkueet menestyivät viime kaudella?", K,
     f"""(SELECT 'Kaudella 2025-26 eniten pisteitä: ' || LISTAGG(team || ' ' || points || ' p', ', ')
             WITHIN GROUP (ORDER BY points DESC) || '.'
          FROM (SELECT * FROM {M}.TEAM_SEASON WHERE season = 2026 ORDER BY points DESC LIMIT 3))"""),
    ("Mitkä ovat olleet suurimmat yllätystulokset?", K,
     f"""(SELECT 'Suurin yllätys: ' || winner_team || ' voitti ottelun ' || home_team || '–' || away_team || ' '
             || TO_CHAR(game_date) || ', malli antoi voittajalle ' || TO_CHAR(ROUND(p_given_to_winner * 100, 1)) || ' %.'
          FROM {M}.V_GAME_EVALUATION ORDER BY p_given_to_winner LIMIT 1)"""),
    ("Miten tämän päivän pelit päättyvät?", E,
     f"""(SELECT IFF(COUNT(*) = 0, 'Tänään ei ole otteluita.',
             'Tänään ' || COUNT(*) || ' ottelua; selkein suosikki ' || MAX_BY(predicted_winner, confidence)
             || ' (' || TO_CHAR(ROUND(MAX(confidence) * 100, 1)) || ' %).')
          FROM {M}.V_UPCOMING_PREDICTIONS WHERE game_date = {TODAY})"""),
    ("Miten Tapparan seuraava ottelu päättyy?", E,
     f"""(SELECT 'Seuraava ottelu ' || TO_CHAR(game_date) || ' ' || home_team || '–' || away_team
             || '; suosikki ' || predicted_winner || ' ' || TO_CHAR(ROUND(confidence * 100, 1)) || ' %.'
          FROM {M}.V_UPCOMING_PREDICTIONS WHERE home_team = 'Tappara' OR away_team = 'Tappara'
          ORDER BY game_date, start_time_fi LIMIT 1)"""),
    ("Missä malli on eri mieltä yleisön kanssa?", E,
     f"""(SELECT 'Suurin ero: ' || team || ', malli ' || proj_rank || '., yleisö ' || crowd_rank || '.'
          FROM {M}.STANDINGS_2026_27 ORDER BY ABS(proj_rank - crowd_rank) DESC LIMIT 1)"""),
    ("Vertaa Tapparan ja HIFK:n vahvuuksia", E,
     f"""(SELECT LISTAGG(team || ': hyökkäys ' || TO_CHAR(ROUND(off_rating, 3)) || ', puolustus '
             || TO_CHAR(ROUND(def_rating, 3)) || ', maalivahti ' || TO_CHAR(ROUND(goalie_mult, 3)), '; ')
             || ' (puolustus ja maalivahti: pienempi parempi).'
          FROM {M}.TEAM_STRENGTH WHERE team IN ('Tappara', 'HIFK'))"""),
    ("Milloin ennuste on päivitetty?", E,
     f"""(SELECT 'Päivitetty ' || TO_CHAR(updated_at) || ', pelattu ' || games_played || '/' || games_total || ' ottelua.'
          FROM {M}.PREDICTION_META)"""),
    ("Kuka voittaa Liigan mestaruuden pudotuspeleissä?", E,
     f"""(SELECT 'Malli ei ennusta pudotuspelejä. Runkosarjan voiton suosikki on ' || team || ' ('
             || TO_CHAR(ROUND(p_title * 100, 1)) || ' %).' FROM {M}.STANDINGS_2026_27 ORDER BY p_title DESC LIMIT 1)"""),
    # "Vaikea" joukko: ei vahvistettua kyselyä, agentti kirjoittaa SQL:n itse.
    ("Montako maalia otteluissa tehdään keskimäärin?", K,
     f"""(SELECT 'Keskimäärin ' || TO_CHAR(ROUND(AVG(IFF(ended, home_goals + away_goals, NULL)), 2))
             || ' maalia per pelattu ottelu.' FROM {M}.V_GAMES_NOW)"""),
    ("Millä joukkueella on paras alivoima?", K,
     f"""(SELECT 'Paras alivoima: ' || team || ' (' || TO_CHAR(ROUND(pk_pct * 100, 1)) || ' %).'
          FROM {M}.V_TEAM_SEASON_NOW ORDER BY pk_pct DESC NULLS LAST LIMIT 1)"""),
    ("Mikä joukkue on kerännyt eniten pisteitä kotiotteluista?", K,
     f"""(SELECT 'Eniten kotipisteitä: ' || LISTAGG(team || ' ' || home_points || ' p', ', ')
          FROM {M}.V_TEAM_SEASON_NOW
          WHERE home_points = (SELECT MAX(home_points) FROM {M}.V_TEAM_SEASON_NOW)) || '.'"""),
    ("Kuka voittaa NHL:n Stanley Cupin?", None,
     "'Kieltäytyy kohteliaasti: agentti kattaa vain Liigan, ei NHL:ää.'"),
    # Miksi ennuste muuttui ja mitä jos (2026-10-16).
    ("Miksi KooKoon ennuste on muuttunut esikaudesta?", E,
     f"""(SELECT 'KooKoon ennuste on muuttunut ' || TO_CHAR(points_change) || ' pistettä ('
             || TO_CHAR(points_before) || ' -> ' || TO_CHAR(points_now) || ', sija ' || rank_before || '. -> '
             || rank_now || '.): tulokset vs. odotus ' || TO_CHAR(results_vs_expected) || ', kokoonpanot '
             || TO_CHAR(roster_changes) || ', mallin uusi arvio ' || TO_CHAR(model_revision) || '.'
          FROM {M}.V_FORECAST_CHANGE WHERE team = 'KooKoo' AND comparison = 'ESIKAUSI')"""),
    ("Entä jos Ilves voittaa seuraavan ottelunsa?", S,
     f"""(SELECT 'Lukitsee Ilveksen voiton seuraavassa ottelussa (' || home_team || '–' || away_team || ' '
             || TO_CHAR(game_date) || ') ja kertoo, miten Ilveksen sija, pisteet ja runkosarjan voiton '
             || 'todennäköisyys muuttuvat (simulaatio, 10 000 kierrosta).'
          FROM {M}.V_UPCOMING_PREDICTIONS WHERE home_team = 'Ilves' OR away_team = 'Ilves'
          ORDER BY game_date, start_time_fi LIMIT 1)"""),
    ("Mitä vaaditaan, että KooKoo pysyy Liigassa ensi kaudella?", S,
     "'Kertoo KooKoon todennäköisyyden välttää putoaminen (sija 14. tai parempi) ja montako "
     "loppupistettä ja pistettä per ottelu loppukaudelta se tarvitsee (simulaatio, 10 000 kautta).'"),
    # 1X2, kokoonpanot ja vedonlyönnin välimuoto (2026-10-16).
    ("Mitkä ovat tämän illan otteluiden 1X2-todennäköisyydet ja maaliodottamat?", E,
     f"""(SELECT IFF(COUNT(*) = 0, 'Tänään ei ole otteluita.',
             LISTAGG(home_team || '–' || away_team || ': 1 ' || TO_CHAR(ROUND(p_home_regulation_win * 100, 1))
                     || ' %, X ' || TO_CHAR(ROUND(p_overtime * 100, 1)) || ' %, 2 '
                     || TO_CHAR(ROUND(p_away_regulation_win * 100, 1)) || ' %', '; ') || '.')
          FROM {M}.V_UPCOMING_PREDICTIONS WHERE game_date = {TODAY})"""),
    ("Anna pitkävetoehdotus tämän illan peleihin.", L,
     f"""(SELECT IFF(COUNT(*) = 0, 'Tänään ei ole otteluita.',
             'Antaa tämän illan ' || COUNT(*) || ' ottelun 1X2-todennäköisyydet (varsinainen peliaika), '
             || 'maaliodottamat ja reilut kertoimet kokoonpanokorjattuna, sanoo että veto on mallin mukaan '
             || 'kannattava vain jos tarjottu kerroin ylittää reilun kertoimen, ei kehota pelaamaan eikä ehdota panoksia.')
          FROM {M}.V_UPCOMING_PREDICTIONS WHERE game_date = {TODAY})"""),
    # Tietopankki (Cortex Search, 2026-10-16).
    ("Miten ennustemalli toimii?", T,
     "'Kaksi osaa: pelaajapohjainen Poisson-malli (40 %) ja Elo (60 %). Pelaajien maalitahti viidestä "
     "kaudesta, ikäkäyrä, sarjojen tasokertoimet, 18 parhaan kenttäpelaajan hyökkäys, maalivahtien "
     "torjunta puolustuksena, jatkoajan kalibrointi (~23 %), yleisöarvio 20 % hiipuen, 10 000 "
     "simulaatiota. 64 ottelua per joukkue. Ei pudotuspelejä.'"),
    ("Voiko maalivahtien torjuntaprosentin laskea tältä kaudelta?", T,
     "'Ei: liiga.fi ei julkaise laukauksia maalivahtikohtaisesti. Kuluvalta kaudelta tiedetään aloitukset "
     "ja päästetyt maalit, ja vertailu tehdään odotettuihin maaleihin.'"),
    # Uutiset (22.11.2026, G3): uutiset pääkysymyksenä, ja joukkueen ennuste + uutistarkistus (luvut mallista).
    ("Ketkä Liiga-pelaajat ovat saaneet pelikieltoa viimeisen kahden viikon aikana?", N,
     """(SELECT 'Uutisten mukaan: ' || COALESCE(LISTAGG(who, ', ') WITHIN GROUP (ORDER BY who), 'ei nimettyjä pelaajia')
             || '. Lähde ja päivä mainittava.'
          FROM (SELECT DISTINCT p.value::STRING || ' (' || COALESCE(NULLIF(e.teams, ''), '?') || ')' AS who
                  FROM LIIGA.MEDIA.MEDIA_EVENTS e, LATERAL FLATTEN(e.players) p
                 WHERE e.event_type = 'suspension' AND e.published >= DATEADD(day, -14, CURRENT_TIMESTAMP())))"""),
    ("Millä todennäköisyydellä Lukko pääsee kuuden joukkoon?", E,
     f"""(SELECT 'Lukko sijoittuu kuuden joukkoon (1.–6.) ' || TO_CHAR(ROUND(p_top6_quarterfinal * 100, 1))
             || ' %:n todennäköisyydellä. Luku mallista; tuoreet uutiset voidaan mainita taustana, mutta ne eivät muuta lukua.'
          FROM {M}.V_ZONE_PROBABILITIES WHERE team = 'Lukko')"""),
    ("Tee illan peleistä HTML-sivu", E,
     f"""(SELECT 'Vastaa chatissa ilman HTML-tiedostoa (sivu vain johtoryhmävisualisointina). '
             || IFF(COUNT(*) = 0, 'Tänään ei ole otteluita.', 'Tänään ' || COUNT(*) || ' ottelua.')
          FROM {M}.V_UPCOMING_PREDICTIONS WHERE game_date = {TODAY})"""),
]

CUSTOM_FINNISH = {
    "name": "vastaa_suomeksi",
    "score_ranges": {"min_score": [0, 0.33], "median_score": [0.34, 0.66], "max_score": [0.67, 1]},
    "prompt": ("You are checking the language of an AI agent's answer. The agent must always "
               "answer in Finnish. Answer: {{output}}\n"
               "Return 1 if the answer is written in Finnish (Finnish team or player names and "
               "short English technical terms are fine), 0.5 if it mixes Finnish and another "
               "language in full sentences, 0 if it is mainly in another language. "
               "Return only the number."),
}


def _snow(*args: str, json_out: bool = False):
    cmd = ["snow", *args, *CONN] + (["--format", "json"] if json_out else [])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError((r.stderr or r.stdout).strip()[-2000:])
    return json.loads(r.stdout) if json_out else r.stdout


def _sql(q: str, json_out: bool = False):
    return _snow("sql", "-q", q, json_out=json_out)


# Uutistarkistus (23.11.2026, katselmointi): vain ETEENPÄIN katsovat kysymykset (ennuste, skenaario, kokoonpanot),
# jotka nimeävät joukkueen tai pelaajan, odottavat päätyökalun lisäksi yhden liiga_media-kutsun. Historia,
# ura ja osuvuus (liiga_kausi) sekä mallikysymykset (liiga_tieto) eivät. Nimet: joukkueiden vartalot ja
# pelaajat LIIGA.RAW.ROSTER_2026_27:stä (ajossa, ei kovakoodattu).
FORWARD = {E, S, L}
TEAMS_RE = (r"HIFK|HPK|Ilve|Joker|JYP|Jukuri|KalPa|Kärp|KooKoo|K-Espoo|Kiekko-Espoo|Lukko|Luko|Pelicans|SaiPa|"
            r"Sport|Tappara|TPS|Ässi|Ässät")
_named: re.Pattern | None = None


def named_re() -> re.Pattern:
    global _named
    if _named is None:
        rows = _sql("SELECT DISTINCT last_name AS n FROM LIIGA.RAW.ROSTER_2026_27 WHERE LENGTH(last_name) >= 4",
                    json_out=True)
        names = sorted({re.escape(r["N"]) for r in rows if r.get("N")}, key=len, reverse=True)
        _named = re.compile(r"\b(" + TEAMS_RE + ("|" + "|".join(names) if names else "") + ")")
    return _named


def expected_tools(q: str, tool: str | None, named: re.Pattern | None = None) -> list[str]:
    if not tool:
        return []
    named = named or named_re()
    return [tool, N] if tool in FORWARD and named.search(q) else [tool]


def _q(s: str) -> str:
    return s.replace("'", "''")


def adversarial() -> list[tuple[str, str | None, str]]:
    """2-3 riviä tuoreimmasta rosterin pelaajan pelikiellosta tai loukkaantumisesta (21 pv): mallin luku
    täsmälleen + Uutiset-rivi; vaikutusta ei arvioida itse. Ei rivejä, jos tuoretta tapahtumaa ei ole."""
    ev = _sql("""SELECT r.team, r.first_name || ' ' || r.last_name AS player, e.event_type, e.source,
                         TO_CHAR(e.published, 'DD.MM.') AS d
                    FROM LIIGA.MEDIA.MEDIA_EVENTS e, LATERAL FLATTEN(e.players) f
                    JOIN LIIGA.RAW.ROSTER_2026_27 r ON LOWER(r.first_name || ' ' || r.last_name) = LOWER(TRIM(f.value::STRING))
                   WHERE e.event_type IN ('suspension', 'injury') AND e.published >= DATEADD(day, -21, CURRENT_TIMESTAMP())
                     AND CONTAINS(e.teams, r.team)
                   ORDER BY e.published DESC LIMIT 1""", json_out=True)
    if not ev:
        return []
    t, pl, kind = _q(ev[0]["TEAM"]), _q(ev[0]["PLAYER"]), ev[0]["EVENT_TYPE"]
    what = "pelikielto" if kind == "suspension" else "loukkaantuminen"
    news = f"Uutiset-rivi: {pl} {what} ({_q(ev[0]['SOURCE'])} {ev[0]['D']}) lähdelinkillä; uutinen ei muuta lukua."
    return [
        (f"Millä todennäköisyydellä {t} pääsee kuuden joukkoon?", E,
         f"""(SELECT '{t} sijoittuu kuuden joukkoon ' || TO_CHAR(ROUND(p_top6_quarterfinal * 100, 1))
                 || ' %:n todennäköisyydellä (täsmälleen mallin luku). {news}'
              FROM {M}.V_ZONE_PROBABILITIES WHERE team = '{t}')"""),
        (f"Miten joukkueen {t} seuraava ottelu päättyy?", E,
         f"""(SELECT 'Seuraava ottelu ' || TO_CHAR(game_date) || ' ' || home_team || '–' || away_team
                 || '; suosikki ' || predicted_winner || ' ' || TO_CHAR(ROUND(confidence * 100, 1)) || ' % (mallin luku). {news}'
              FROM {M}.V_UPCOMING_PREDICTIONS WHERE home_team = '{t}' OR away_team = '{t}'
              ORDER BY game_date, start_time_fi LIMIT 1)"""),
        (f"Paljonko {pl} heikentää joukkueen {t} mahdollisuuksia nyt?", S,
         f"""'Ei arvioi vaikutusta itse eikä muuta mallin lukua: ajaa liiga_skenaarion poissaololla ({pl}) tai '
             || 'tarjoaa sitä, ja kertoo uutisesta vain sen, mitä se sanoo. {news}'"""),
    ]


def golden() -> list[tuple[str, str | None, str]]:
    return GOLDEN + adversarial()


def build_dataset(run: str) -> str:
    rows = []
    for q, tool, gt in golden():
        tools = expected_tools(q, tool)
        inv = ("ARRAY_CONSTRUCT(" + ", ".join(f"OBJECT_CONSTRUCT('tool_name', '{t}')" for t in tools) + ")"
               if tools else "ARRAY_CONSTRUCT()")
        rows.append(f"SELECT '{q.replace(chr(39), chr(39)*2)}' AS input_query, "
                    f"TO_VARIANT(OBJECT_CONSTRUCT('ground_truth_output', {gt}, "
                    f"'ground_truth_invocations', {inv})) AS ground_truth")
    # Skeema luodaan snowflake/_account/roles/LIIGA_DEPLOYER.sql:ssä: CREATE SCHEMA IF NOT EXISTS vaatisi
    # CREATE SCHEMA -oikeuden tietokantaan, vaikka skeema on jo olemassa.
    _sql(f"CREATE OR REPLACE TABLE {TABLE} AS\n" + "\nUNION ALL\n".join(rows))
    bad = _sql(f"SELECT input_query FROM {TABLE} WHERE ground_truth:ground_truth_output IS NULL", json_out=True)
    if bad:
        raise SystemExit(f"odotettu vastaus puuttuu: {[b['INPUT_QUERY'] for b in bad]}")
    dataset = f"{DB}.{SCHEMA}.GOLDEN_{run}"
    _sql(f"CALL SYSTEM$CREATE_EVALUATION_DATASET('Cortex Agent', '{TABLE}', '{dataset}', "
         f"OBJECT_CONSTRUCT('query_text', 'INPUT_QUERY', 'expected_tools', 'GROUND_TRUTH'))")
    return dataset


def write_config(agent: str, version: str, dataset: str, run: str) -> str:
    import yaml
    cfg = {
        "evaluation": {
            "agent_params": {"agent_name": f"SNOWFLAKE_INTELLIGENCE.AGENTS.{agent}",
                             "agent_type": "CORTEX AGENT", "agent_version": version},
            "run_params": {"label": f"{agent} {version} {run}"},
            "source_metadata": {"type": "dataset", "dataset_name": dataset},
        },
        "metrics": [{"name": "answer_correctness", "version": "v3"},
                    {"name": "logical_consistency", "version": "v3"},
                    "tool_selection_accuracy",
                    CUSTOM_FINNISH],
    }
    _sql(f"CREATE FILE FORMAT IF NOT EXISTS {DB}.{SCHEMA}.YAML_FILE_FORMAT TYPE = 'CSV' "
         "FIELD_DELIMITER = NONE RECORD_DELIMITER = '\\n' SKIP_HEADER = 0 "
         "FIELD_OPTIONALLY_ENCLOSED_BY = NONE ESCAPE_UNENCLOSED_FIELD = NONE")
    _sql(f"CREATE STAGE IF NOT EXISTS {STAGE} FILE_FORMAT = {DB}.{SCHEMA}.YAML_FILE_FORMAT")
    path = Path(tempfile.mkdtemp()) / f"eval_{run}.yaml"
    path.write_text(yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False), encoding="utf-8")
    (ROOT / "snowflake" / "LIIGA" / "EVALS" / "results").mkdir(parents=True, exist_ok=True)
    (ROOT / "snowflake" / "LIIGA" / "EVALS" / "results" / "last_config.yaml").write_text(path.read_text(), encoding="utf-8")
    _snow("stage", "copy", str(path), f"@{STAGE}/", "--overwrite")
    return f"@{STAGE}/{path.name}"


def start_and_wait(run: str, cfg_path: str, timeout_s: int = 3600) -> dict:
    _sql(f"CALL EXECUTE_AI_EVALUATION('START', OBJECT_CONSTRUCT('run_name', '{run}'), '{cfg_path}')")
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        time.sleep(30)
        st = _sql(f"CALL EXECUTE_AI_EVALUATION('STATUS', OBJECT_CONSTRUCT('run_name', '{run}'), '{cfg_path}')",
                  json_out=True)
        val = json.dumps(st)
        print(f"  {int(time.time() - t0)} s: {val[:200]}")
        if any(s in val.upper() for s in ("COMPLETED", "FAILED", "PARTIALLY", "CANCELLED")):
            return st
    raise TimeoutError(run)


def results(agent: str, run: str):
    return _sql("SELECT * FROM TABLE(SNOWFLAKE.LOCAL.GET_AI_EVALUATION_DATA("
                f"'SNOWFLAKE_INTELLIGENCE', 'AGENTS', '{agent}', 'CORTEX AGENT', '{run}'))", json_out=True)


METRICS = 4   # answer_correctness, logical_consistency, tool_selection_accuracy, vastaa_suomeksi


def complete_results(agent: str, run: str, n_rows: int, timeout_s: int = 900) -> list[dict]:
    """STATUS = COMPLETED ei tarkoita, että pisteet ovat luettavissa: 16.10.
    tuotantoajo (20261016_1101) luki tulokset heti ja kaatui laatuporttiin,
    vaikka sama ajo antoi myöhemmin 28/28 pistettä joka mittarille ja läpäisi
    portin. Odotetaan, kunnes jokaisella mittarilla on pisteet joka kysymykselle."""
    t0 = time.time()
    while True:
        data = results(agent, run)
        got: dict[str, int] = {}
        for r in data:
            if r.get("EVAL_AGG_SCORE") is not None:
                got[r["METRIC_NAME"]] = got.get(r["METRIC_NAME"], 0) + 1
        if len(got) >= METRICS and min(got.values()) >= n_rows:
            return data
        if time.time() - t0 > timeout_s:
            print(f"  pisteitä yhä kesken {timeout_s} s jälkeen: {got}")
            return data
        print(f"  pisteitä {got} / {n_rows}, odotetaan")
        time.sleep(30)


# Laatuportti: mittarin keskiarvon alaraja 25 kysymyksen ajossa. Perustaso
# 16.10. (VERSION$2): oikeellisuus 0,97, työkalu 1,00, suomi 0,98,
# johdonmukaisuus 0,87. Rajat jättävät tilaa LLM-tuomarin vaihtelulle mutta
# pysäyttävät selvän heikkenemisen.
#
# Työkalun valinta portitetaan oikean työkalun osuutena (pisteet >= 0,5), ei
# raakana tool_selection_accuracyna: kysymys ilman vahvistettua kyselyä menee
# Cortex Analystissa kahdessa vaiheessa (mallin lataus + kysely), ja mittari
# laskee sen kahdeksi saman työkalun kutsuksi -> 0,5, vaikka työkalu on oikea.
# Raaka arvo raportoidaan yhä tehokkuusmittarina. (GitHub-ajo 16.10.: 0,94
# raakana, 1,00 oikeina työkaluina.)
GATE = {"answer_correctness": 0.90, "tool_correct_rate": 0.95, "main_tool_match": 0.95,
        "vastaa_suomeksi": 0.95, "logical_consistency": 0.80}


def summarize(data: list[dict]) -> dict:
    by: dict[str, dict[str, float]] = {}
    for r in data:
        if r.get("EVAL_AGG_SCORE") is not None:
            by.setdefault(r["METRIC_NAME"], {})[r["INPUT"]] = float(r["EVAL_AGG_SCORE"])
    means = {m: sum(v.values()) / len(v) for m, v in by.items()}
    if "tool_selection_accuracy" in by:
        t = by["tool_selection_accuracy"]
        means["tool_correct_rate"] = sum(1 for x in t.values() if x >= 0.5) / len(t)
    means.update(tool_split(data))
    low = sorted({q for v in by.values() for q, x in v.items() if x < 0.67})
    errors = sum(1 for r in data if r.get("ERROR"))
    return {"metrics": means, "n": max((len(v) for v in by.values()), default=0),
            "low": low, "errors": errors, "p50": p50(data)}


_LIST = re.compile(r"\*\*(Expected|Invoked):\*\* `\[([^\]]*)\]`")


def tool_split(data: list[dict]) -> dict[str, float]:
    """tool_selection_accuracyn perusteluista (METRIC_CALLS): odotetut ja kutsutut työkalut.
    main_tool_match = ensimmäinen odotettu (päätyökalu) kutsuttiin (sama määritelmä kuin ennen uutistarkistusta,
    vertailukelpoinen); news_check_match = liiga_media kutsuttiin täsmälleen silloin, kun sitä odotettiin."""
    main, news = [], []
    for r in data:
        if r.get("METRIC_NAME") != "tool_selection_accuracy":
            continue
        calls = r.get("METRIC_CALLS")
        txt = json.dumps(calls if not isinstance(calls, str) else json.loads(calls or "[]"))
        got = {k: [t.strip(" `") for t in v.split(",") if t.strip(" `")] for k, v in _LIST.findall(txt.replace("\\n", " "))}
        exp, inv = got.get("Expected", []), got.get("Invoked", [])
        if exp:
            main.append(exp[0] in inv)
        news.append((N in exp) == (N in inv))
    out = {}
    if main:
        out["main_tool_match"] = sum(main) / len(main)
    if news:
        out["news_check_match"] = sum(news) / len(news)
    return out


def p50(data: list[dict]) -> dict[str, float]:
    """Mediaani kysymystä kohden (yksi rivi per kysymys: answer_correctness)."""
    import statistics
    rows = [r for r in data if r.get("METRIC_NAME") == "answer_correctness"]
    def med(k):
        v = [float(r[k]) for r in rows if r.get(k) is not None]
        return statistics.median(v) if v else float("nan")
    return {"latency_s": med("DURATION_MS") / 1000, "input_tokens": med("TOTAL_INPUT_TOKENS"),
            "output_tokens": med("TOTAL_OUTPUT_TOKENS")}


def record(agent: str, version: str, run: str, summary: dict) -> str:
    """Rivi docs/agent_evals.md:hen (append-only) ja sama markdown CI:n yhteenvetoon."""
    m = summary["metrics"]
    cols = ["answer_correctness", "tool_correct_rate", "tool_selection_accuracy",
            "vastaa_suomeksi", "logical_consistency"]
    p = summary.get("p50", {})
    row = (f"| {run} | {agent} | {version} | {summary['n']} | "
           + " | ".join(f"{m.get(c, float('nan')):.2f}" for c in cols)
           + f" | {summary['errors']} | {'; '.join(summary['low']) or '–'} |"
           # 23.11.2026: päätyökalu ja uutistarkistus erikseen, mediaaniviive ja -tokenit
           + f" päätyökalu {m.get('main_tool_match', float('nan')):.2f}, uutistarkistus {m.get('news_check_match', float('nan')):.2f},"
           + f" p50 {p.get('latency_s', float('nan')):.1f} s / {p.get('input_tokens', float('nan')):.0f}+{p.get('output_tokens', float('nan')):.0f} tok |")
    path = ROOT / "docs" / "agent_evals.md"
    if not path.exists():
        path.write_text("# Agentin evaluoinnit\n\n*Kirjoittaa `scripts/deploy/agent_eval.py`. Append-only.*\n\n"
                        "| ajo | agentti | versio | n | oikeellisuus | oikea työkalu | työkalu (raaka) | suomi | "
                        "johdonmukaisuus | virheet | heikot (< 0,67) |\n"
                        "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|\n", encoding="utf-8")
    with path.open("a", encoding="utf-8") as fh:
        fh.write(row + "\n")
    return row


def gate(summary: dict) -> list[str]:
    fails = [f"{k} {summary['metrics'].get(k, 0):.2f} < {v:.2f}"
             for k, v in GATE.items() if summary["metrics"].get(k, 0) < v]
    if summary["errors"]:
        fails.append(f"{summary['errors']} virhettä")
    return fails


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--agent", default="LIIGA_ENNUSTAJA")
    # Alias tallentuu isoilla kirjaimilla, ja evaluointi vertaa kirjainkoon mukaan:
    # "production" -> "Version does not exist".
    ap.add_argument("--version", default="PRODUCTION")
    ap.add_argument("--build-only", action="store_true")
    ap.add_argument("--gate", action="store_true", help="exit 1 jos mittari alle GATE-rajan")
    ap.add_argument("--summarize", metavar="RESULTS_JSON",
                    help="tiivistä olemassa oleva tulostiedosto ja kirjaa se, ei uutta ajoa")
    a = ap.parse_args()
    if a.summarize:
        data = json.loads(Path(a.summarize).read_text())
        run = Path(a.summarize).stem.replace("results_", "")
        sm = summarize(data)
        print(record(a.agent, a.version, run, sm))
        print(gate(sm) or "laatuportti läpi")
        return
    # Aina UTC ja sekunnit: CI (UTC) ja paikallinen ajo (Suomen aika) antoivat
    # 16.10. saman nimen 20261016_1238 eri hetkistä, ja CI kaatui, koska
    # ACCOUNTADMINin aiemmin luomaan datasettiin ei ollut oikeuksia.
    run = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    dataset = build_dataset(run)
    n_rows = int(_sql(f"SELECT COUNT(*) AS n FROM {TABLE}", json_out=True)[0]["N"])
    print(f"testijoukko {TABLE}: {n_rows} kysymystä (joista vaikeita {n_rows - len(GOLDEN)}) -> {dataset}")
    if a.build_only:
        return
    cfg_path = write_config(a.agent, a.version, dataset, run)
    print(f"konfiguraatio {cfg_path}; ajo {run} ({a.agent} {a.version})")
    start_and_wait(run, cfg_path)
    data = complete_results(a.agent, run, n_rows)
    out = ROOT / "snowflake" / "LIIGA" / "EVALS" / "results" / f"results_{run}.json"
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    print(f"tulokset {out} ({len(data)} riviä)")
    summary = summarize(data)
    row = record(a.agent, a.version, run, summary)
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    (ROOT / "snowflake" / "LIIGA" / "EVALS" / "results" / "last_summary.json").write_text(
        json.dumps({"run": run, "agent": a.agent, "version": a.version, **summary},
                   ensure_ascii=False, indent=1), encoding="utf-8")
    import os
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as fh:
            fh.write(f"### Evaluointi {a.agent} {a.version}\n\n"
                     "| ajo | agentti | versio | n | oikeellisuus | oikea työkalu | työkalu (raaka) | suomi | "
                     "johdonmukaisuus | virheet | heikot |\n|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|\n"
                     + row + "\n")
    if a.gate:
        fails = gate(summary)
        if fails:
            raise SystemExit("LAATUPORTTI EI LÄPI: " + "; ".join(fails))
        print("laatuportti läpi")


if __name__ == "__main__":
    main()
