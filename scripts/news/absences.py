"""Poissaolokirjaukset tapahtumalokina (27.10.2026; docs/uutismalli_suunnitelma.md).

Jokainen OK-painallus on oma tiedostonsa news-data/absences/<aika>-<pelaaja>.csv
(yksi rivi): rinnakkaiset kirjaukset eivät törmää gitissä, eikä GitHubin jono
voi hävittää niitä (jono pitää vain yhden odottavan ajon). Pelaajan voimassa
oleva tila = hänen viimeisin kirjauksensa: "out" alku- ja paluupäivineen tai
"back" (palasi; url "kokoonpano" = haastaja huomasi pelaajan päivän
kokoonpanossa ja lopetti poissaolon itse). "dismiss" = uutinen ohitettu (EI OK):
ei koske pelaajan tilaa, mutta poistaa uutisen kirjattavista ja on oppimisdataa.
Vanha yhteinen absences.csv luetaan myös.
"""
from __future__ import annotations

import csv
from pathlib import Path

FIELDS = ["approved_at", "url", "player", "team", "kind", "games", "start", "until"]


def events(folder: Path) -> list[dict]:
    paths = sorted((folder / "absences").glob("*.csv")) if (folder / "absences").exists() else []
    legacy = folder / "absences.csv"
    rows = []
    for p in ([legacy] if legacy.exists() else []) + paths:
        rows += list(csv.DictReader(p.open(encoding="utf-8")))
    return sorted(rows, key=lambda r: r["approved_at"])


def latest(folder: Path) -> dict[str, dict]:
    """Pelaajan viimeisin kirjaus (paluu korvaa poissaolon); ohitukset eivät koske tilaa."""
    out: dict[str, dict] = {}
    for r in events(folder):
        if r["kind"] in ("out", "back"):
            out[r["player"]] = r
    return out


def active(folder: Path, day: str) -> list[dict]:
    """Poissaolot, jotka ovat voimassa päivänä `day`."""
    return [r for r in latest(folder).values() if r["kind"] == "out" and r["start"] <= day < r["until"]]


def write(folder: Path, row: dict) -> Path:
    d = folder / "absences"
    d.mkdir(parents=True, exist_ok=True)
    slug = "".join(c if c.isalnum() else "-" for c in (row["player"] or row["kind"]).lower())
    path = d / f"{row['approved_at'].replace(':', '')}-{slug}.csv"
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        w.writeheader()
        w.writerow(row)
    return path
