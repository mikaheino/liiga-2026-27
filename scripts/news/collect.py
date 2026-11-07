"""Uutiskeräin, uutismallin vaihe 0 (27.10.2026; docs/uutismalli_suunnitelma.md).

Hakee Ylen urheilu-RSS:n ja seurojen omat sivut -- vain lähteet, joiden
robots.txt ei kiellä tekoälyä -- ja kirjaa uudet jutut CSV:hen: otsikko,
linkki, joukkue ja avainsanaliput. Ei kielimallia, ei artikkelitekstiä talteen
(vain otsikko ja linkki), ei vaikutusta ennusteeseen. Tarkoitus on mitata
kahden viikon ajan, kuinka paljon loukkaantumis-, siirto- ja valmentajatietoa
näistä lähteistä oikeasti tulee ja kuka julkaisee ensin.

Ajaa .github/workflows/news.yml kerran päivässä klo 14.00 Suomen aikaa yhdessä
kokoonpanojen kanssa (scripts/news/lineups.py; käyttäjä 27.10.); Ylen
SM-liiga-aihesyötteen 20 juttua kattavat noin viikon, seurojen syötteet 10-100
juttua. Tulos news-data-haaraan. Paikallisesti:

    python scripts/news/collect.py OUTDIR
"""
from __future__ import annotations

import csv
import datetime as dt
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))
from liiga.news_collect import FIELDS, collect, reflag  # noqa: E402  (ydin src/liiga:ssa, 7.11.2026)


def main(out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "news_items.csv"
    old = list(csv.DictReader(path.open(encoding="utf-8"))) if path.exists() else []
    reflag(old)
    now = dt.datetime.now(dt.UTC).isoformat(timespec="seconds")
    summaries: dict[str, str] = {}
    rows, status = collect({r["url"] for r in old}, now, summaries)
    for r in old:
        if not r.get("summary"):
            r["summary"] = summaries.get(r["url"], "")
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(old + rows)
    for source, s in status.items():
        print(f"{source:8} {s}")
    flagged = [r for r in rows if r["flags"]]
    print(f"uusia {len(rows)}, joista liputettuja {len(flagged)}; yhteensä {len(old) + len(rows)}")
    for r in flagged:
        print(f"  [{r['flags']}] {r['team']}: {r['title']}")
    # Kaatuu vain, jos mikään lähde ei vastannut: yksittäinen katkos ei pysäytä keräystä.
    return 1 if all(s.startswith("virhe") for s in status.values()) else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(Path(sys.argv[1])))
