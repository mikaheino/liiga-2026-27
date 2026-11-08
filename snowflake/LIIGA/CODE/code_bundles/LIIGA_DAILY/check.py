"""Tarkistusajo ilman kirjoituksia (8.11.2026): julkaisurooli voi ajaa tämän itse ja iteroida.

Tekee daily.py:n alun (paketin kopio, config, importit, liiga.fi- ja uutislähteiden saavutettavuus)
mutta ei kirjoita tauluihin. EXECUTE CODE BUNDLE LIIGA.CODE.LIIGA_DAILY_BUNDLE ENTRYPOINT = 'check.py'
"""
from __future__ import annotations

import importlib.util
import os
import sys

for base in (os.getcwd(), *(os.path.join(os.getcwd(), d) for d in sorted(os.listdir(os.getcwd())))):
    if os.path.isfile(os.path.join(base, "daily.py")):
        sys.path.insert(0, base)
        break
spec = importlib.util.spec_from_file_location("daily", os.path.join(sys.path[0], "daily.py"))
daily = importlib.util.module_from_spec(spec)
spec.loader.exec_module(daily)          # kopio /tmp:hen ja sys.path, ei ajoa

import requests  # noqa: E402

print("python", sys.version.split()[0], "työhakemisto", os.getcwd())
import liiga.pipeline  # noqa: E402,F401

print("liiga-paketti ok")
for url in ("https://www.liiga.fi/api/v2/games?tournament=runkosarja&season=2027", "https://yle.fi/rss/t/18-188906/fi"):
    try:
        print(url[:40], requests.get(url, timeout=15).status_code)
    except Exception as e:  # noqa: BLE001
        print(url[:40], "VIRHE", type(e).__name__, str(e)[:120])
s = daily.session()
print("sessio", s.sql("SELECT CURRENT_ROLE(), CURRENT_WAREHOUSE()").collect())
print("TARKISTUS VALMIS")
