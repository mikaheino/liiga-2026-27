"""Snowflake Intelligence -agentin kaksi semanttista mallia, yhdestä lähteestä.

    LIIGA_ENNUSTAJA_SV  ennuste: lopullinen sarjataulukko, vyöhykkeet,
                        tulevat ottelut, joukkuevahvuudet, pelaajaennusteet
    LIIGA_KAUSI_SV      toteuma: sarjataulukko nyt, mallin osuvuus, yllättäjät,
                        pistepörssi, maalivahdit, kokoonpanot, aiemmat kaudet

Miksi kaksi eikä yksi: Cortex Analyst lukee KOKO semanttisen mallin jokaisella
kutsulla. Vanha yksi malli oli 13 taulua ja ~1 250 riviä YAMLia, joten jokainen
kysymys -- myös "mikä on sarjatilanne" -- maksoi sen kaiken. Kaksi pientä,
kumpikin omalle kysymystyypilleen, on halvempi ja osuu useammin oikeaan.

Toinen tokenisäästö on näkymissä (snowflake/kausi_views.sql): viimeisimmän
ennusteen etsiminen, viimeisimmän kokoonpanon poiminta, sarjajärjestys ja
ottelukohtainen osuma on laskettu valmiiksi, joten generoitu SQL on yksi
SELECT eikä monivaiheinen ikkunafunktio jonka agentti joutuu yrittämään
uudelleen.

    python scripts/semantic_views.py --write          # YAML -> snowflake/semantic/
    python scripts/semantic_views.py --deploy --dev   # luo *_DEV-versiot
    python scripts/semantic_views.py --deploy         # tuotantoon

Deploy validoi ensin (verify_only) ja luo vasta sitten. Ajetaan ACCOUNTADMINina,
koska se omistaa pohjataulut.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "snowflake" / "semantic"
CONN = ["-c", "CONTAINER_SERVICES", "--role", "ACCOUNTADMIN"]
VERIFIED_AT = 1791590400          # 2026-10-10
TEAMS = ["HIFK", "HPK", "Ilves", "JYP", "Jokerit", "Jukurit", "K-Espoo", "KalPa",
         "KooKoo", "Kärpät", "Lukko", "Pelicans", "SaiPa", "Sport", "TPS",
         "Tappara", "Ässät"]


# ---------------------------------------------------------------- rakentajat
def dim(name, desc, expr=None, syn=None, enum=False):
    d = {"name": name, "description": desc, "expr": expr or name}
    if syn:
        d["synonyms"] = syn
    if enum:
        d["is_enum"] = True
    return d


def team(desc="Joukkue"):
    return dim("TEAM", desc, syn=["joukkue", "seura"])


def fact(name, desc, expr=None, syn=None):
    d = {"name": name, "description": desc, "expr": expr or name}
    if syn:
        d["synonyms"] = syn
    return d


def tdim(name, desc, expr=None, syn=None):
    d = {"name": name, "description": desc, "expr": expr or name,
         "data_type": "DATE"}
    if syn:
        d["synonyms"] = syn
    return d


def table(name, base, desc, pk=None, dims=(), facts=(), tdims=(), metrics=()):
    schema, tbl = base.split(".")
    t = {"name": name, "description": desc,
         "base_table": {"database": "LIIGA", "schema": schema, "table": tbl}}
    if pk:
        t["primary_key"] = {"columns": pk}
    for key, val in (("dimensions", dims), ("time_dimensions", tdims),
                     ("facts", facts), ("metrics", metrics)):
        if val:
            t[key] = list(val)
    return t


def rel(name, left, right, cols, kind="many_to_one"):
    return {"name": name, "left_table": left, "right_table": right,
            "relationship_columns": [{"left_column": c, "right_column": c}
                                     for c in cols],
            "relationship_type": kind}


def vq(name, question, sql, onboarding=False):
    return {"name": name, "question": question, "sql": sql.strip() + "\n",
            "verified_at": VERIFIED_AT, "verified_by": "mheino",
            "use_as_onboarding_question": onboarding}


TODAY = "TO_DATE(CONVERT_TIMEZONE('Europe/Helsinki', CURRENT_TIMESTAMP()))"
COMMON = f"""Joukkueiden nimet ovat tarkkoja merkkijonoja: {", ".join(TEAMS)}.
Todennäköisyydet ovat 0-1 -lukuja: näytä prosentteina (* 100), 1 desimaali.
"Tänään" = {TODAY} (Suomen aika, ei session aikavyöhyke).
Kausi 2027 = 2026-27. Pisteet: 3 varsinaisen peliajan voitto, 2 jatkoaika-
tai voittolaukausvoitto, 1 jatkoaika- tai voittolaukaustappio, 0 tappio.
Sarjavyöhykkeet 2026-27: 1.-6. suoraan puolivälieriin, 7.-10. säälipudotuspeleihin,
11.-14. ulkona, 15.-17. putoaa (uutta tällä kaudella).
Palauta vain kysymykseen tarvittavat sarakkeet ja enintään 17 riviä."""


# ---------------------------------------------------------------- ENNUSTAJA
def ennustaja() -> dict:
    tables = [
        table("STANDINGS", "MODEL.STANDINGS_2026_27",
              "Ennustettu LOPULLINEN runkosarjataulukko (60 ottelua) 10 000 "
              "simulaatiosta. Sisältää jo pelattujen otteluiden pisteet.",
              pk=["TEAM"],
              dims=[team(),
                    dim("PROJECTED_RANK", "Ennustettu loppusija, 1 = runkosarjan voittaja",
                        "PROJ_RANK", ["ennustettu sija"])],
              facts=[fact("MEAN_POINTS", "Ennustetut loppupisteet (keskiarvo)",
                          syn=["ennustetut pisteet"]),
                     fact("P05_POINTS", "Pisteiden alaraja (5 %)"),
                     fact("P95_POINTS", "Pisteiden yläraja (95 %)"),
                     fact("P_REGULAR_SEASON_WIN", "Todennäköisyys voittaa RUNKOSARJA "
                          "(ei mestaruus -- pudotuspelejä malli ei ennusta)", "P_TITLE",
                          ["runkosarjan voitto"]),
                     fact("CROWD_POINTS", "Yleisöennusteen pisteet", "CROWD_PTS",
                          ["yleisö", "fanien ennuste"]),
                     fact("CROWD_RANK", "Yleisöennusteen sija")]),
        table("ZONES", "MODEL.V_ZONE_PROBABILITIES",
              "Todennäköisyys päätyä kullekin sarjavyöhykkeelle.", pk=["TEAM"],
              dims=[team()],
              facts=[fact("P_TOP6", "1.-6. eli suoraan puolivälieriin",
                          "P_TOP6_QUARTERFINAL", ["kuuden joukkoon", "suoraan jatkoon"]),
                     fact("P_7_10", "7.-10. eli säälipudotuspeleihin",
                          "P_7_10_PLAYOFF_QUALIFIER", ["säälipleijarit", "karsinta"]),
                     fact("P_PLAYOFFS", "1.-10. eli pudotuspeleihin millä tahansa reitillä",
                          "P_PLAYOFFS_ANY", ["pudotuspelit", "playoffs"]),
                     fact("P_RELEGATION", "15.-17. eli putoaa sarjasta",
                          "P_RELEGATION_15_17", ["putoaminen", "putoaa"])]),
        table("UPCOMING_GAMES", "MODEL.V_UPCOMING_PREDICTIONS",
              "Pelaamattomat ottelut ja uusimman ennusteen voittotodennäköisyydet. "
              "Voitto sisältää jatkoajan ja voittolaukaukset.", pk=["GAME_ID"],
              dims=[dim("GAME_ID", "Ottelun tunniste"),
                    dim("HOME_TEAM", "Kotijoukkue", syn=["koti"]),
                    dim("AWAY_TEAM", "Vierasjoukkue", syn=["vieras"]),
                    dim("START_TIME_FI", "Alkamisaika Suomen aikaa (HH:MI)"),
                    dim("PREDICTED_WINNER", "Todennäköisempi voittaja",
                        syn=["ennustettu voittaja"])],
              tdims=[tdim("GAME_DATE", "Ottelupäivä Suomen aikaa", syn=["päivä", "milloin"])],
              facts=[fact("P_HOME_WIN", "Kotijoukkueen voittotodennäköisyys"),
                     fact("P_AWAY_WIN", "Vierasjoukkueen voittotodennäköisyys"),
                     fact("P_OVERTIME", "Todennäköisyys jatkoajalle", syn=["jatkoaika"]),
                     fact("CONFIDENCE", "Suosikin voittotodennäköisyys")]),
        table("ROUND_PREVIEW", "MODEL.V_ROUND_PREVIEW_TEXT",
              "Kierroksen esikatselu valmiina suomenkielisinä riveinä: yksi rivi per "
              "tuleva ottelu. Kopioi tekstisarakkeet sellaisenaan.", pk=["GAME_ID"],
              dims=[dim("GAME_ID", "Ottelun tunniste"),
                    dim("HOME_TEAM", "Kotijoukkue"), dim("AWAY_TEAM", "Vierasjoukkue"),
                    dim("START_TIME_FI", "Alkamisaika Suomen aikaa (HH:MI)"),
                    dim("OTTELU", "Otsikkorivi: aika, koti – vieras"),
                    dim("ENNUSTE", "Ennusterivi: voittotodennäköisyydet ja jatkoaika"),
                    dim("TILANNE", "Tilannerivi: sija, pisteet ja vire (pisteet 5 viime ottelusta /15)"),
                    dim("MAALIVAHDIT", "Todennäköiset maalivahdit ja heidän maalinsa vähemmän (+) "
                        "kuin keskiverto"),
                    dim("KESKINAISET", "Keskinäiset ottelut tällä kaudella, tyhjä jos ei kohdattu"),
                    dim("SUOSIKKI", "Suosikkijoukkue, tai 'tasainen' jos alle 55 %")],
              tdims=[tdim("GAME_DATE", "Ottelupäivä Suomen aikaa", syn=["kierros", "päivä"])],
              facts=[fact("SUOSIKIN_PCT", "Suosikin voittotodennäköisyys prosentteina"),
                     fact("VIRE_ERO", "Kotijoukkueen vire miinus vierasjoukkueen vire")]),
        table("FORECAST_HISTORY", "MODEL.PREDICTION_HISTORY",
              "Ennusteen kehitys: yksi rivi per joukkue per päivittäinen ajo.",
              dims=[team(), dim("PROJ_RANK", "Ennustettu loppusija sinä päivänä")],
              tdims=[tdim("SNAPSHOT_DATE", "Ennusteen päivä", "TO_DATE(SNAPSHOT_DATE)")],
              facts=[fact("MEAN_POINTS", "Ennustetut loppupisteet sinä päivänä"),
                     fact("P_REGULAR_SEASON_WIN", "Runkosarjan voiton todennäköisyys", "P_TITLE"),
                     fact("GAMES_PLAYED", "Pelattuja otteluita koko sarjassa sinä päivänä")]),
        table("TEAM_STRENGTH", "MODEL.TEAM_STRENGTH",
              "Mallin joukkuevahvuudet. OFF_RATING suurempi = parempi hyökkäys; "
              "DEF_RATING ja GOALIE_MULT pienempi = parempi.", pk=["TEAM"],
              dims=[team()],
              facts=[fact("OFF_RATING", "Hyökkäysvoima", syn=["hyökkäys"]),
                     fact("DEF_RATING", "Puolustus (pienempi parempi)", syn=["puolustus"]),
                     fact("GOALIE_MULT", "Maalivahtikerroin (pienempi parempi)",
                          syn=["maalivahtipeli"]),
                     fact("EXP_GF_PLAYER", "Pelaajien ennusteista laskettu maalimäärä / ottelu")]),
        table("PLAYER_PROJECTIONS", "MODEL.PLAYER_RATES",
              "Mallin pelaajakohtainen ennuste per ottelu, nykyinen rosteri.",
              dims=[team(), dim("PLAYER_NAME", "Pelaaja", "NAME", ["pelaaja"]),
                    dim("POSITION", "F = hyökkääjä, D = puolustaja, G = maalivahti",
                        "POSITION_GROUP", ["pelipaikka"])],
              facts=[fact("GOALS_PER_GAME", "Ennustetut maalit / ottelu",
                          "PROJECTED_GOALS_PER_GAME"),
                     fact("POINTS_PER_GAME", "Ennustetut tehopisteet / ottelu",
                          "PROJECTED_POINTS_PER_GAME")]),
        table("FORECAST_META", "MODEL.PREDICTION_META",
              "Milloin ennuste päivitettiin ja montako ottelua oli pelattu (1 rivi).",
              dims=[dim("UPDATED_AT", "Päivityshetki (UTC)", syn=["päivitetty"])],
              facts=[fact("GAMES_PLAYED", "Pelattuja otteluita"),
                     fact("GAMES_TOTAL", "Otteluita kaudella yhteensä")]),
    ]
    rels = [rel("ZONES_TO_STANDINGS", "ZONES", "STANDINGS", ["TEAM"], "one_to_one"),
            rel("STRENGTH_TO_STANDINGS", "TEAM_STRENGTH", "STANDINGS", ["TEAM"], "one_to_one"),
            rel("PLAYERS_TO_STANDINGS", "PLAYER_PROJECTIONS", "STANDINGS", ["TEAM"])]
    vqs = [
        vq("PREDICTED_TABLE", "Mikä on ennustettu sarjataulukko?", """
SELECT s.projected_rank, s.team, ROUND(s.mean_points, 1) AS pisteet,
       ROUND(z.p_top6 * 100, 1) AS top6_pct, ROUND(z.p_relegation * 100, 1) AS putoaa_pct
FROM __standings s JOIN __zones z ON z.team = s.team
ORDER BY s.projected_rank""", True),
        vq("REGULAR_SEASON_WINNER", "Kuka voittaa runkosarjan?", """
SELECT team, ROUND(p_regular_season_win * 100, 1) AS voitto_pct, ROUND(mean_points, 1) AS pisteet
FROM __standings WHERE p_regular_season_win >= 0.01
ORDER BY p_regular_season_win DESC""", True),
        vq("RELEGATION", "Ketkä putoavat?", """
SELECT team, ROUND(p_relegation * 100, 1) AS putoaa_pct
FROM __zones WHERE p_relegation >= 0.01 ORDER BY p_relegation DESC""", True),
        vq("TODAYS_GAMES", "Miten tämän päivän pelit päättyvät?", f"""
SELECT start_time_fi, home_team, away_team,
       ROUND(p_home_win * 100, 1) AS koti_pct, ROUND(p_away_win * 100, 1) AS vieras_pct,
       ROUND(p_overtime * 100, 1) AS jatkoaika_pct, predicted_winner
FROM __upcoming_games WHERE game_date = {TODAY}
ORDER BY start_time_fi, home_team""", True),
        vq("ROUND_PREVIEW_TODAY", "Kierroksen esikatselu: tämän illan ottelut", f"""
SELECT ottelu, ennuste, tilanne, maalivahdit, keskinaiset, suosikki
FROM __round_preview WHERE game_date = {TODAY}
ORDER BY start_time_fi, home_team""", True),
        vq("ROUND_PREVIEW_TONIGHT_2", "Miten illan pelit menevät?", f"""
SELECT ottelu, ennuste, tilanne, maalivahdit, keskinaiset, suosikki
FROM __round_preview WHERE game_date = {TODAY}
ORDER BY start_time_fi, home_team"""),
        vq("ROUND_PREVIEW_TONIGHT_3", "Mitä tänään pelataan?", f"""
SELECT ottelu, ennuste, tilanne, maalivahdit, keskinaiset, suosikki
FROM __round_preview WHERE game_date = {TODAY}
ORDER BY start_time_fi, home_team"""),
        vq("ROUND_PREVIEW_TOMORROW", "Esikatsele huomisen kierros", f"""
SELECT ottelu, ennuste, tilanne, maalivahdit, keskinaiset, suosikki
FROM __round_preview WHERE game_date = DATEADD(day, 1, {TODAY})
ORDER BY start_time_fi, home_team"""),
        vq("TEAM_NEXT_GAME", "Miten Tapparan seuraava ottelu päättyy?", """
SELECT game_date, start_time_fi, home_team, away_team,
       ROUND(p_home_win * 100, 1) AS koti_pct, ROUND(p_away_win * 100, 1) AS vieras_pct,
       predicted_winner
FROM __upcoming_games WHERE home_team = 'Tappara' OR away_team = 'Tappara'
ORDER BY game_date LIMIT 1"""),
        vq("CROWD_VS_MODEL", "Missä malli on eri mieltä yleisön kanssa?", """
SELECT team, projected_rank, crowd_rank, projected_rank - crowd_rank AS ero_sijoina,
       ROUND(mean_points - crowd_points, 1) AS ero_pisteina
FROM __standings ORDER BY ABS(projected_rank - crowd_rank) DESC LIMIT 6"""),
        vq("COMPARE_STRENGTH", "Vertaa Tapparan ja HIFK:n vahvuuksia", """
SELECT team, ROUND(off_rating, 3) AS hyokkays, ROUND(def_rating, 3) AS puolustus,
       ROUND(goalie_mult, 3) AS maalivahti
FROM __team_strength WHERE team IN ('Tappara', 'HIFK')"""),
        vq("BEST_PROJECTED_PLAYERS", "Ketkä ovat mallin mukaan parhaat pelaajat?", """
SELECT player_name, team, position, ROUND(points_per_game * 60, 1) AS pisteet_60_ottelussa
FROM __player_projections WHERE position <> 'G'
ORDER BY points_per_game DESC LIMIT 10"""),
        vq("FORECAST_TREND", "Miten Tapparan ennuste on muuttunut?", """
SELECT snapshot_date, proj_rank, ROUND(mean_points, 1) AS pisteet
FROM __forecast_history WHERE team = 'Tappara'
ORDER BY snapshot_date"""),
        vq("UPDATED", "Milloin ennuste on päivitetty?", """
SELECT updated_at, games_played, games_total FROM __forecast_meta"""),
    ]
    return {
        "name": "LIIGA_ENNUSTAJA_SV",
        "description": "Liiga 2026-27 ennuste: lopullinen runkosarjataulukko, "
                       "sarjavyöhykkeet, tulevien otteluiden voittotodennäköisyydet, "
                       "joukkuevahvuudet ja pelaajaennusteet.",
        "tables": tables, "relationships": rels,
        "module_custom_instructions": {
            "sql_generation": COMMON + """
STANDINGS on LOPULLINEN ennuste. Nykyinen sarjatilanne ei ole tässä mallissa.
Tulevat ottelut: käytä aina UPCOMING_GAMES, se on jo uusin ennuste.""",
            "question_categorization": """Vain Liiga 2026-27 runkosarja. Ei pudotuspelejä
eikä muita sarjoja. Kysymys nykyisestä sarjatilanteesta, pelatuista otteluista,
pistepörssistä tai mallin osuvuudesta kuuluu toiselle työkalulle.""",
        },
        "verified_queries": vqs,
    }


# ---------------------------------------------------------------- KAUSI
def kausi() -> dict:
    tables = [
        table("TABLE_NOW", "MODEL.V_TEAM_SEASON_NOW",
              "Toteutunut sarjatilanne NYT ja joukkueen kausi tähän asti. "
              "TABLE_RANK on liiga.fi:n järjestys (pisteet, maaliero, tehdyt).",
              pk=["TEAM"],
              dims=[team(), dim("TABLE_RANK", "Sija sarjataulukossa nyt",
                                syn=["sija", "sarjasija"])],
              facts=[fact("GAMES_PLAYED", "Pelatut ottelut", syn=["ottelut"]),
                     fact("POINTS", "Pisteet", syn=["pisteet"]),
                     fact("REGULATION_WINS", "Voitot varsinaisella peliajalla"),
                     fact("OVERTIME_WINS", "Jatkoaika- ja voittolaukausvoitot"),
                     fact("OVERTIME_LOSSES", "Jatkoaika- ja voittolaukaustappiot"),
                     fact("REGULATION_LOSSES", "Tappiot varsinaisella peliajalla"),
                     fact("GOALS_FOR", "Tehdyt maalit"), fact("GOALS_AGAINST", "Päästetyt maalit"),
                     fact("GOAL_DIFF", "Maaliero"),
                     fact("LAST5_POINTS", "Pisteet viidestä viimeisestä ottelusta",
                          syn=["vire", "muoto"]),
                     fact("HOME_POINTS", "Pisteet kotiotteluista"),
                     fact("AWAY_POINTS", "Pisteet vierasotteluista"),
                     fact("XG_FOR", "Maaliodottama, tehdyt (xG)"),
                     fact("XG_AGAINST", "Maaliodottama, päästetyt (xGA)"),
                     fact("SHADOW_POINTS", "Varjosarjataulukon pisteet: mitä maalipaikat "
                          "(xG) olisivat antaneet", syn=["varjosarjataulukko"]),
                     fact("POINTS_OVER_SHADOW", "Pisteet miinus varjopisteet: + = onnekas"),
                     fact("PRESEASON_EXPECTED_POINTS", "Esikauden ennusteen pisteet "
                          "juuri pelatuista otteluista"),
                     fact("POINTS_VS_PRESEASON", "Pisteet miinus esikauden odotus: "
                          "+ = yllättänyt positiivisesti", syn=["yllättäjä", "pettymys"]),
                     fact("PP_PCT", "Ylivoimaprosentti (0-1)", syn=["ylivoima", "YV"]),
                     fact("PK_PCT", "Alivoiman onnistuminen (0-1)", syn=["alivoima", "AV"])]),
        table("GAMES", "MODEL.V_GAMES_NOW",
              "Kuluvan kauden kaikki ottelut: tulokset ja otteluohjelma.", pk=["GAME_ID"],
              dims=[dim("GAME_ID", "Ottelun tunniste"),
                    dim("HOME_TEAM", "Kotijoukkue"), dim("AWAY_TEAM", "Vierasjoukkue"),
                    dim("ENDED", "TRUE = pelattu"),
                    dim("RESULT_CATEGORY", "regulation / overtime / shootout"),
                    dim("WINNER_TEAM", "Voittaja"),
                    dim("START_TIME_FI", "Alkamisaika Suomen aikaa")],
              tdims=[tdim("GAME_DATE", "Ottelupäivä Suomen aikaa")],
              facts=[fact("HOME_GOALS", "Kotijoukkueen maalit"),
                     fact("AWAY_GOALS", "Vierasjoukkueen maalit"),
                     fact("HOME_XG", "Kotijoukkueen xG"), fact("AWAY_XG", "Vierasjoukkueen xG"),
                     fact("SPECTATORS", "Yleisömäärä", syn=["yleisö", "katsojat"])]),
        table("MODEL_ACCURACY", "MODEL.V_GAME_EVALUATION",
              "Jokainen pelattu ottelu verrattuna mallin viimeisimpään ennusteeseen "
              "ennen ottelua. Vertailutaso on 'kotijoukkue voittaa aina', ei 50 %.",
              pk=["GAME_ID"],
              dims=[dim("GAME_ID", "Ottelun tunniste"),
                    dim("HOME_TEAM", "Kotijoukkue"), dim("AWAY_TEAM", "Vierasjoukkue"),
                    dim("WINNER_TEAM", "Toteutunut voittaja"),
                    dim("PREDICTED_WINNER", "Mallin suosikki")],
              tdims=[tdim("GAME_DATE", "Ottelupäivä")],
              facts=[fact("MODEL_CORRECT", "1 = malli ennusti voittajan oikein",
                          syn=["osuma", "osui"]),
                     fact("HOME_TEAM_WON", "1 = kotijoukkue voitti (vertailutaso)"),
                     fact("P_HOME_WIN", "Mallin antama kotivoiton todennäköisyys"),
                     fact("P_GIVEN_TO_WINNER", "Todennäköisyys jonka malli antoi voittajalle: "
                          "pieni = yllätystulos", syn=["yllätys"]),
                     fact("MODEL_CONFIDENCE", "Suosikin todennäköisyys"),
                     fact("LOG_LOSS", "Log-loss, pienempi parempi"),
                     fact("BRIER", "Brier-pisteet, pienempi parempi")],
              metrics=[{"name": "HIT_RATE", "description": "Osumaprosentti (0-1)",
                        "expr": "AVG(MODEL_CORRECT)"},
                       {"name": "HOME_BASELINE_RATE",
                        "description": "Kotijoukkueen voittoprosentti (vertailutaso, 0-1)",
                        "expr": "AVG(HOME_TEAM_WON)"}]),
        table("PLAYERS_NOW", "MODEL.V_PLAYER_SEASON_NOW",
              "Kenttäpelaajien kausi nyt (pistepörssi). Maalit ilman epäonnistuneita "
              "rangaistuslaukauksia. Ottelut kokoonpanoista.",
              dims=[dim("PLAYER_NAME", "Pelaaja", syn=["pelaaja"]),
                    team(), dim("POSITION", "Hyökkääjä / Puolustaja", syn=["pelipaikka"])],
              facts=[fact("GAMES_PLAYED", "Pelatut ottelut"),
                     fact("GOALS", "Maalit", syn=["maalit"]),
                     fact("ASSISTS", "Syötöt", syn=["syötöt"]),
                     fact("POINTS", "Tehopisteet", syn=["pisteet", "pistepörssi"]),
                     fact("POINTS_PER_GAME", "Tehopisteet / ottelu"),
                     fact("PP_GOALS", "Ylivoimamaalit"),
                     fact("GAME_WINNING_GOALS", "Voittomaalit"),
                     fact("PRESEASON_EXPECTED_POINTS", "Esikauden ennuste × pelatut ottelut"),
                     fact("POINTS_VS_PRESEASON", "Pisteet yli (+) tai ali (−) esikauden ennusteen",
                          syn=["yllättäjä"])]),
        table("GOALIES_NOW", "MODEL.V_GOALIE_SEASON_NOW",
              "Maalivahtien kausi nyt. Torjunta-%:a ei ole (liiga.fi ei julkaise "
              "laukauksia); vertailu tehdään päästetyillä vs. odotus samoista maalipaikoista. "
              "Vertailut vain otteluista joissa pelasi yksi maalivahti.",
              dims=[dim("GOALIE_NAME", "Maalivahti", syn=["maalivahti", "veskari"]), team()],
              facts=[fact("GAMES_PLAYED", "Pelatut ottelut"), fact("STARTS", "Aloitukset"),
                     fact("SOLO_GAMES", "Ottelut koko ottelun yksin"),
                     fact("GOALS_AGAINST", "Päästetyt maalit (yksin pelatut)"),
                     fact("GOALS_AGAINST_PER_GAME", "Päästetyt / ottelu"),
                     fact("GOALS_SAVED_VS_AVERAGE", "Maaleja vähemmän (+) kuin keskiverto"
                          "maalivahti samoista paikoista", syn=["paras maalivahti"]),
                     fact("GOALS_SAVED_VS_PRESEASON", "Maaleja vähemmän (+) kuin oma "
                          "esikauden ennuste", syn=["yllättäjä"])]),
        table("LATEST_LINEUPS", "MODEL.V_LATEST_LINEUPS",
              "Joukkueen viimeisimmän pelatun ottelun kokoonpano = todennäköisin seuraava.",
              dims=[team(), dim("OPPONENT", "Vastustaja siinä ottelussa"),
                    dim("ROLE_FI", "Pelipaikka", syn=["paikka"]),
                    dim("POSITION_GROUP", "F / D / G"),
                    dim("PLAYER_NAME", "Pelaaja"),
                    dim("CAPTAIN", "Kapteeni"),
                    dim("GOALIE_STARTED", "Maalivahti aloitti")],
              tdims=[tdim("GAME_DATE", "Ottelun päivä")],
              facts=[fact("LINE", "Ketju / pari (1-4)", syn=["ketju", "kenttä"]),
                     fact("JERSEY", "Pelinumero")]),
        table("PAST_SEASONS", "MODEL.TEAM_SEASON",
              "Joukkueiden kaudet 2022-2027 (2026 = kausi 2025-26).",
              dims=[team(), dim("SEASON", "Kausi, 2026 = 2025-26", syn=["kausi"])],
              facts=[fact("GAMES_PLAYED", "Ottelut"), fact("POINTS", "Pisteet"),
                     fact("WINS", "Voitot"), fact("GOALS_FOR", "Tehdyt"),
                     fact("GOALS_AGAINST", "Päästetyt"), fact("XG_SHARE", "xG-osuus")]),
    ]
    rels = [rel("PLAYERS_TO_TABLE", "PLAYERS_NOW", "TABLE_NOW", ["TEAM"]),
            rel("GOALIES_TO_TABLE", "GOALIES_NOW", "TABLE_NOW", ["TEAM"])]
    vqs = [
        vq("TABLE_NOW", "Mikä on sarjatilanne nyt?", """
SELECT table_rank, team, games_played, points, goal_diff, last5_points
FROM __table_now ORDER BY table_rank""", True),
        vq("HIT_RATE", "Kuinka hyvin malli on osunut?", """
SELECT COUNT(*) AS ottelut, SUM(model_correct) AS osumat,
       ROUND(AVG(model_correct) * 100, 1) AS osuma_pct,
       ROUND(AVG(home_team_won) * 100, 1) AS aina_koti_pct,
       ROUND(AVG(log_loss), 3) AS log_loss
FROM __model_accuracy""", True),
        vq("HIT_RATE_TEAM", "Miten malli on osunut Tapparan otteluissa?", """
SELECT game_date, home_team, away_team, winner_team, predicted_winner,
       ROUND(p_given_to_winner * 100, 1) AS voittajalle_pct, model_correct
FROM __model_accuracy WHERE home_team = 'Tappara' OR away_team = 'Tappara'
ORDER BY game_date"""),
        vq("UPSETS", "Mitkä ovat olleet suurimmat yllätystulokset?", """
SELECT game_date, home_team, away_team, winner_team,
       ROUND(p_given_to_winner * 100, 1) AS voittajalle_pct
FROM __model_accuracy ORDER BY p_given_to_winner LIMIT 5"""),
        vq("SURPRISE_TEAMS", "Mitkä joukkueet ovat yllättäneet?", """
SELECT team, points, ROUND(preseason_expected_points, 1) AS odotus,
       ROUND(points_vs_preseason, 1) AS ero
FROM __table_now ORDER BY points_vs_preseason DESC""", True),
        vq("SURPRISE_PLAYERS", "Ketkä pelaajat ovat yllättäneet?", """
SELECT player_name, team, position, games_played, points,
       ROUND(points_vs_preseason, 1) AS yli_ennusteen
FROM __players_now WHERE games_played >= 5
ORDER BY points_vs_preseason DESC NULLS LAST LIMIT 10"""),
        vq("SCORING_LEADERS", "Kuka johtaa pistepörssiä?", """
SELECT player_name, team, games_played, goals, assists, points
FROM __players_now ORDER BY points DESC, goals DESC LIMIT 10""", True),
        vq("BEST_GOALIES", "Kuka on ollut paras maalivahti?", """
SELECT goalie_name, team, solo_games, goals_against,
       ROUND(goals_saved_vs_average, 1) AS torjuttu_yli_keskiverron
FROM __goalies_now WHERE solo_games >= 3
ORDER BY goals_saved_vs_average DESC LIMIT 6"""),
        vq("SHADOW_TABLE", "Mikä on varjosarjataulukko?", """
SELECT team, points, ROUND(shadow_points, 1) AS varjopisteet,
       ROUND(points_over_shadow, 1) AS yli_ali
FROM __table_now ORDER BY shadow_points DESC"""),
        vq("LINEUP", "Mikä on Tapparan todennäköinen kokoonpano?", """
SELECT line, role_fi, player_name, jersey, goalie_started
FROM __latest_lineups WHERE team = 'Tappara'
ORDER BY position_group DESC, line, role_fi"""),
        vq("RESULTS_YESTERDAY", "Miten eilen pelatut ottelut päättyivät?", f"""
SELECT home_team, away_team, home_goals, away_goals, result_category
FROM __games WHERE ended AND game_date = DATEADD(day, -1, {TODAY})
ORDER BY home_team"""),
        vq("LAST_SEASON", "Miten joukkueet menestyivät viime kaudella?", """
SELECT team, points, games_played, goals_for, goals_against
FROM __past_seasons WHERE season = 2026 ORDER BY points DESC"""),
    ]
    return {
        "name": "LIIGA_KAUSI_SV",
        "description": "Liiga 2026-27 toteuma: sarjatilanne nyt, tulokset, mallin "
                       "osuvuus, yllättäjät, pistepörssi, maalivahdit, kokoonpanot "
                       "ja aiemmat kaudet.",
        "tables": tables, "relationships": rels,
        "module_custom_instructions": {
            "sql_generation": COMMON + """
Mallin osuvuus: vertaa aina HIT_RATEa kotijoukkueen voittoprosenttiin, ei 50 %:iin.
Yllättäjä = POINTS_VS_PRESEASON (joukkue, pelaaja) tai GOALS_SAVED_VS_PRESEASON (maalivahti).
Pelaajalistoissa vaadi GAMES_PLAYED >= 5 ellei toisin kysytä.""",
            "question_categorization": """Vain Liiga. Ennusteet lopputaulukosta tai
tulevista otteluista kuuluvat toiselle työkalulle.""",
        },
        "verified_queries": vqs,
    }


# ---------------------------------------------------------------- rikastus
# Taulujen synonyymit, kohdennetut sarakesynonyymit ja valmiit metriikat.
# Synonyymi vain siellä missä käyttäjän sana poikkeaa sarakkeen nimestä --
# jokainen kasvattaa mallia, joka luetaan joka SQL-generoinnilla.
# Metriikka siellä missä yhdistämisen voi tehdä väärin: liigan ylivoima-%
# on SUM/SUM eikä joukkueprosenttien keskiarvo (18,8 % vs. 18,5 %, 10.10.).
def metric(name, desc, expr, syn=None):
    d = {"name": name, "description": desc, "expr": expr}
    if syn:
        d["synonyms"] = syn
    return d


ENRICH = {
    "LIIGA_ENNUSTAJA_SV": {
        "STANDINGS": {"syn": ["ennustettu sarjataulukko", "lopputaulukko", "loppusijoitus"],
                      "cols": {"MEAN_POINTS": ["lopulliset pisteet"]},
                      "metrics": [metric("AVG_PROJECTED_POINTS", "Ennustettujen loppupisteiden keskiarvo",
                                         "AVG(MEAN_POINTS)")]},
        "ZONES": {"syn": ["sarjavyöhykkeet", "pudotuspelipaikat"],
                  "metrics": [metric("EXPECTED_RELEGATED_TEAMS", "Putoavien joukkueiden odotettu "
                                     "määrä (summa on aina 3)", "SUM(P_RELEGATION)")]},
        "UPCOMING_GAMES": {"syn": ["tulevat ottelut", "otteluohjelma", "seuraavat pelit"],
                           "metrics": [metric("UPCOMING_GAME_COUNT", "Tulevien otteluiden määrä",
                                              "COUNT(GAME_ID)", ["montako ottelua"]),
                                       metric("AVG_HOME_WIN_PROB", "Kotivoiton keskimääräinen "
                                              "todennäköisyys", "AVG(P_HOME_WIN)", ["kotietu"])]},
        "ROUND_PREVIEW": {"syn": ["kierroksen esikatselu", "illan pelit", "päivän ottelut"]},
        "FORECAST_HISTORY": {"syn": ["ennusteen kehitys", "ennustehistoria"]},
        "TEAM_STRENGTH": {"syn": ["joukkuevahvuus", "vahvuudet"]},
        "PLAYER_PROJECTIONS": {"syn": ["pelaajaennusteet"],
                               "cols": {"POINTS_PER_GAME": ["tehot / ottelu"]}},
        "FORECAST_META": {"syn": ["päivitystiedot"]},
    },
    "LIIGA_KAUSI_SV": {
        "TABLE_NOW": {"syn": ["sarjataulukko", "sarjatilanne", "taulukko"],
                      "cols": {"GOALS_FOR": ["tehdyt maalit", "TM"],
                               "GOALS_AGAINST": ["päästetyt maalit", "PM"],
                               "GOAL_DIFF": ["maaliero"],
                               "XG_FOR": ["maaliodottama", "xG"]},
                      "facts": [fact("PP_GOALS", "Ylivoimamaalit"),
                                fact("PP_INSTANCES", "Ylivoimatilanteet"),
                                fact("PP_GOALS_AGAINST", "Alivoimalla päästetyt maalit"),
                                fact("SH_INSTANCES", "Alivoimatilanteet")],
                      "metrics": [metric("LEAGUE_PP_PCT", "Ylivoimaprosentti summista (0-1). Käytä "
                                         "tätä, älä PP_PCT:n keskiarvoa.",
                                         "SUM(PP_GOALS) / NULLIF(SUM(PP_INSTANCES), 0)",
                                         ["liigan ylivoimaprosentti"]),
                                  metric("LEAGUE_PK_PCT", "Alivoiman onnistuminen summista (0-1)",
                                         "1 - SUM(PP_GOALS_AGAINST) / NULLIF(SUM(SH_INSTANCES), 0)",
                                         ["liigan alivoima"]),
                                  metric("GOALS_PER_TEAM_GAME", "Tehdyt maalit per joukkueottelu",
                                         "SUM(GOALS_FOR) / NULLIF(SUM(GAMES_PLAYED), 0)",
                                         ["maaleja per ottelu"]),
                                  metric("POINTS_PER_TEAM_GAME", "Pisteet per joukkueottelu",
                                         "SUM(POINTS) / NULLIF(SUM(GAMES_PLAYED), 0)")]},
        "GAMES": {"syn": ["ottelut", "tulokset", "otteluohjelma"],
                  "cols": {"SPECTATORS": ["yleisömäärä"]},
                  "metrics": [metric("GAMES_PLAYED_COUNT", "Pelattujen otteluiden määrä",
                                     "SUM(IFF(ENDED, 1, 0))", ["montako ottelua pelattu"]),
                              metric("AVG_ATTENDANCE", "Keskimääräinen yleisömäärä pelatuissa",
                                     "AVG(IFF(ENDED, SPECTATORS, NULL))", ["keskiyleisö"]),
                              metric("AVG_GOALS_PER_GAME", "Maaleja per ottelu yhteensä (molemmat)",
                                     "AVG(IFF(ENDED, HOME_GOALS + AWAY_GOALS, NULL))", ["maalimäärä"]),
                              metric("HOME_WIN_SHARE", "Kotivoittojen osuus pelatuista (0-1)",
                                     "AVG(IFF(ENDED, IFF(WINNER_TEAM = HOME_TEAM, 1, 0), NULL))",
                                     ["kotietu"])]},
        "MODEL_ACCURACY": {"syn": ["mallin osuvuus", "ennusteiden osumat", "ennustetarkkuus"],
                           "metrics": [metric("AVG_LOG_LOSS", "Log-lossin keskiarvo, pienempi parempi",
                                              "AVG(LOG_LOSS)"),
                                       metric("AVG_BRIER", "Brier-pisteiden keskiarvo, pienempi parempi",
                                              "AVG(BRIER)"),
                                       metric("GAMES_EVALUATED", "Arvioitujen otteluiden määrä",
                                              "COUNT(GAME_ID)")]},
        "PLAYERS_NOW": {"syn": ["pistepörssi", "pelaajatilastot", "kenttäpelaajat"],
                        "cols": {"POINTS": ["tehot", "tehopisteet"], "GOALS": ["maalipörssi"]},
                        "metrics": [metric("TOTAL_GOALS", "Maalit yhteensä", "SUM(GOALS)"),
                                    metric("TOTAL_POINTS", "Tehopisteet yhteensä", "SUM(POINTS)")]},
        "GOALIES_NOW": {"syn": ["maalivahdit", "maalivahtitilastot", "veskarit"],
                        "cols": {"GOALS_AGAINST": ["päästetyt"]},
                        "metrics": [metric("TOTAL_GOALS_SAVED_VS_AVERAGE", "Maaleja vähemmän kuin "
                                           "keskiverto yhteensä", "SUM(GOALS_SAVED_VS_AVERAGE)")]},
        "LATEST_LINEUPS": {"syn": ["kokoonpano", "ketjut", "todennäköinen kokoonpano"]},
        "PAST_SEASONS": {"syn": ["aiemmat kaudet", "viime kausi", "kausihistoria"]},
    },
}


def enrich(name: str, m: dict) -> dict:
    # Kopio: ENRICHin metriikat ovat moduulitason olioita, ja translate()
    # muokkaa kuvauksia paikallaan -- ilman kopiota toinen rakennus kääntäisi
    # jo englanninkielisen tekstin.
    import copy
    spec = copy.deepcopy(ENRICH.get(name, {}))
    for t in m["tables"]:
        e = spec.get(t["name"])
        if not e:
            continue
        if e.get("syn"):
            t["synonyms"] = e["syn"]
        for col, syn in e.get("cols", {}).items():
            c = next((c for k in ("dimensions", "time_dimensions", "facts")
                      for c in t.get(k, []) if c["name"] == col), None)
            if c is None:
                raise KeyError(f"{name}.{t['name']}: ei saraketta {col}")
            c["synonyms"] = list(dict.fromkeys(c.get("synonyms", []) + syn))
        if e.get("facts"):
            t["facts"] = t.get("facts", []) + e["facts"]
        if e.get("metrics"):
            t["metrics"] = t.get("metrics", []) + e["metrics"]
    return m


MODELS = {"LIIGA_ENNUSTAJA_SV": lambda: enrich("LIIGA_ENNUSTAJA_SV", ennustaja()),
          "LIIGA_KAUSI_SV": lambda: enrich("LIIGA_KAUSI_SV", kausi())}


def translate(m: dict, lang: str) -> dict:
    """lang='en': kuvaukset ja ohjeet englanniksi (semantic_views_en.py).
    Synonyymit, VQR-kysymykset ja sarakealiakset jäävät suomeksi -- ne vastaavat
    sitä mitä käyttäjä kirjoittaa ja näkee."""
    if lang == "fi":
        return m
    from semantic_views_en import EN
    def tr(x: str) -> str:
        if x not in EN:
            raise KeyError(f"ei englanninkielistä vastinetta: {x[:80]!r}")
        return EN[x]
    m["description"] = tr(m["description"])
    for t in m["tables"]:
        t["description"] = tr(t["description"])
        for k in ("dimensions", "time_dimensions", "facts", "metrics"):
            for c in t.get(k, []):
                c["description"] = tr(c["description"])
    m["module_custom_instructions"] = {k: tr(v) for k, v in
                                       m["module_custom_instructions"].items()}
    return m


def _yaml(m: dict) -> str:
    return yaml.safe_dump(m, allow_unicode=True, sort_keys=False, width=100)


def write(lang: str = "en") -> list[Path]:
    OUT.mkdir(parents=True, exist_ok=True)
    paths = []
    for name, build in MODELS.items():
        p = OUT / f"{name.lower()}.yaml"
        p.write_text("# Generoitu: python scripts/semantic_views.py --write. Älä muokkaa käsin.\n"
                     + _yaml(translate(build(), lang)), encoding="utf-8")
        paths.append(p)
    return paths


def _sql(q: str) -> str:
    r = subprocess.run(["snow", "sql", *CONN, "--format", "json", "-q", q],
                       capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError((r.stderr or r.stdout).strip()[-1500:])
    return r.stdout


def deploy(dev: bool, lang: str = "en") -> None:
    for name, build in MODELS.items():
        m = translate(build(), lang)
        if dev:
            m["name"] = name + "_DEV"
        body = _yaml(m)
        assert "$$" not in body
        for verify in (True, False):
            flag = ", TRUE" if verify else ""
            out = _sql("CALL SYSTEM$CREATE_SEMANTIC_VIEW_FROM_YAML("
                       f"'LIIGA.MODEL', $${body}$${flag})")
            msg = next(iter(json.loads(out)[0].values()))
            print(f"LIIGA.MODEL.{m['name']}: {msg}")


def comment_sql(lang: str = "en") -> str:
    """ALTER VIEW ... ALTER COLUMN ... COMMENT jokaiselle V_*-näkymän sarakkeelle,
    jolla on kuvaus semanttisessa mallissa. Agentti ei lue näitä (Cortex Analyst
    lukee semanttisen mallin), joten ne eivät maksa tokeneita; ne ovat
    tietoluetteloa ja SQL:n kirjoittajia varten, samasta lähteestä.

    kausi_views.sql:n CREATE OR REPLACE VIEW pyyhkii kommentit, joten aja tämä
    sen jälkeen (deploy tekee sen).
    """
    seen, out = set(), []
    for name, build in MODELS.items():
        for t in translate(build(), lang)["tables"]:
            view = t["base_table"]["table"]
            if not view.startswith("V_"):
                continue
            for k in ("dimensions", "time_dimensions", "facts"):
                for c in t.get(k, []):
                    col = c["expr"]
                    if not col.replace("_", "").isalnum() or (view, col) in seen:
                        continue
                    seen.add((view, col))
                    txt = c["description"].replace("'", "''")
                    out.append(f"ALTER VIEW LIIGA.MODEL.{view} ALTER COLUMN {col} "
                               f"COMMENT '{txt}';")
    return "\n".join(out) + "\n"


def apply_comments(lang: str = "en") -> None:
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False) as fh:
        fh.write(comment_sql(lang))
    r = subprocess.run(["snow", "sql", *CONN, "-f", fh.name], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError((r.stderr or r.stdout).strip()[-1500:])
    print(f"sarakekommentit: {comment_sql(lang).count(chr(10))} saraketta")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--deploy", action="store_true")
    ap.add_argument("--dev", action="store_true")
    ap.add_argument("--lang", choices=["fi", "en"], default="en",
                    help="kuvausten ja ohjeiden kieli (vastaukset ovat aina suomeksi)")
    a = ap.parse_args()
    for p in write(a.lang):
        print(f"kirjoitettu {p.relative_to(ROOT)} ({len(p.read_text().splitlines())} riviä)")
    if a.deploy:
        deploy(a.dev, a.lang)
        apply_comments(a.lang)


if __name__ == "__main__":
    main()
