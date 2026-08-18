"""Parse the official Liiga 2026-27 transfers article into authoritative rosters.

The liiga.fi transfers article (saved verbatim to data/transfers_2026_27.txt)
lists, per team, the contract players ("Sopimuspelaajat") by position plus the
incoming players (+) with their previous club and league. That contract list is
a far more complete and current roster than the preseason API squads, so we use
it as the authoritative roster source.

We:
  1. parse the contract roster (name + position) for all 17 teams,
  2. parse incoming players' previous league (to know who needs external stats
     and from where),
  3. match each roster name to our Liiga scoring history to attach player_ids,
  4. write the roster_2026_27 table (drop-in replacement for rosters.py output).
"""
from __future__ import annotations

import re
import unicodedata

import pandas as pd

from .config import resolve_path
from .db import get_connection, query_df, register_df

# Article team headers -> canonical team names used everywhere else.
ARTICLE_TEAM_MAP = {
    "HIFK": "HIFK", "HPK": "HPK", "ILVES": "Ilves", "JOKERIT": "Jokerit",
    "JUKURIT": "Jukurit", "JYP": "JYP", "KALPA": "KalPa", "KIEKKO-ESPOO": "K-Espoo",
    "KOOKOO": "KooKoo", "KÄRPÄT": "Kärpät", "LUKKO": "Lukko", "PELICANS": "Pelicans",
    "SAIPA": "SaiPa", "SPORT": "Sport", "TAPPARA": "Tappara", "TPS": "TPS",
    "ÄSSÄT": "Ässät",
}
POSITION_HEADER = {
    "Maalivahdit": "G", "Puolustajat": "D",
    "Keskushyökkääjät": "F", "Laitahyökkääjät": "F",
}
PLAYER_ROLE_CODES = {"mv": "G", "p": "D", "kh": "F", "lh": "F"}


def _norm(name: str) -> str:
    """Normalise a name for matching: lowercase, strip accents and punctuation."""
    s = unicodedata.normalize("NFKD", str(name))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[^a-z ]", " ", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def _strip_paren(token: str) -> str:
    return re.sub(r"\s*\([^)]*\)\s*$", "", token).strip()


def parse_article(path=None) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (roster_df, incoming_df) parsed from the transfers text."""
    path = path or resolve_path("data/transfers_2026_27.txt")
    lines = path.read_text(encoding="utf-8").splitlines()

    roster_rows, incoming_rows = [], []
    team = None
    for raw in lines:
        line = raw.strip()
        if not line:
            continue

        # team header e.g. "KIEKKO-ESPOO, Espoo"
        head = line.split(",")[0].strip()
        if head in ARTICLE_TEAM_MAP and ("," in line):
            team = ARTICLE_TEAM_MAP[head]
            continue
        if team is None:
            continue

        # incoming player line: "+ Name / role (Club LEAGUE)"
        if line.startswith("+"):
            body = line[1:].strip()
            m = re.match(r"^(.*?)\s*/\s*([\w-]+)\s*(?:\(([^)]*)\))?\s*$", body)
            if not m:
                continue
            name, role, source = m.group(1).strip(), m.group(2), (m.group(3) or "").strip()
            if role not in PLAYER_ROLE_CODES:        # skip coaches/managers
                continue
            league = source.split()[-1] if source else ""
            club = " ".join(source.split()[:-1]) if league else source
            incoming_rows.append(
                {"team": team, "name": name, "norm": _norm(name),
                 "source_club": club, "source_league": league or "Liiga"}
            )
            continue

        # contract roster line: "Maalivahdit (3): Name (2027), Name (2028), ..."
        m = re.match(r"^(Maalivahdit|Puolustajat|Keskushyökkääjät|Laitahyökkääjät)\s*\(\d+\):\s*(.*)$", line)
        if m:
            pos = POSITION_HEADER[m.group(1)]
            for tok in m.group(2).split(","):
                name = _strip_paren(tok)
                if name:
                    roster_rows.append(
                        {"team": team, "name": name, "norm": _norm(name),
                         "position_group": pos}
                    )

    return pd.DataFrame(roster_rows), pd.DataFrame(incoming_rows)


def _liiga_name_index(con) -> dict[str, int]:
    """Normalised 'first last' -> player_id, using the player with the most
    career goals when a name is shared."""
    df = query_df(
        con,
        """SELECT player_id, MAX(first_name) fn, MAX(last_name) ln, SUM(goals) g
           FROM player_season_scoring GROUP BY player_id""",
    )
    df["norm"] = (df["fn"].fillna("") + " " + df["ln"].fillna("")).map(_norm)
    df = df.sort_values("g", ascending=False).drop_duplicates("norm")
    return dict(zip(df["norm"], df["player_id"]))


def build_rosters_from_article() -> pd.DataFrame:
    """Parse the article, attach Liiga player_ids by name, write roster_2026_27."""
    roster, incoming = parse_article()
    con = get_connection()
    try:
        name_to_id = _liiga_name_index(con)
        bio = query_df(con, "SELECT player_id, date_of_birth FROM player_bio")
        dob = dict(zip(bio["player_id"], bio["date_of_birth"]))

        src = dict(zip(incoming["norm"], incoming["source_league"])) if not incoming.empty else {}
        out = []
        for _, r in roster.iterrows():
            pid = name_to_id.get(r["norm"])
            first, _, last = r["name"].partition(" ")
            out.append(
                {
                    "team": r["team"],
                    "player_id": int(pid) if pid is not None else None,
                    "first_name": first,
                    "last_name": last,
                    "position_group": r["position_group"],
                    "date_of_birth": dob.get(pid),
                    "source": "article",
                    "has_liiga_history": pid is not None,
                    "source_league": src.get(r["norm"], "Liiga" if pid is not None else "unknown"),
                }
            )
        roster_df = pd.DataFrame(out).drop_duplicates(
            subset=["team", "first_name", "last_name"]
        )
        register_df(con, "roster_2026_27", roster_df)
    finally:
        con.close()
    return roster_df


if __name__ == "__main__":
    r = build_rosters_from_article()
    print(f"{len(r)} players, {r['team'].nunique()} teams")
    print("with Liiga history:", int(r["has_liiga_history"].sum()),
          "| need external:", int((~r["has_liiga_history"]).sum()))
