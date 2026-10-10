---
name: esikatselu-html
description: Johtoryhmävisualisointi of a Liiga round as a shareable HTML page. Use ONLY when the user's message contains the word "johtoryhmävisualisointi" (any inflection, e.g. "johtoryhmävisualisoinnin", "johtoryhmävisualisointina"). Without that word, never use this skill, even if the user asks for HTML, a page, a presentation or a file.
---

# Johtoryhmävisualisointi: kierroksen esikatselu HTML-sivuna

Exactly three steps. Do not write HTML yourself and do not look for files.

1. `liiga_ennuste`: ask exactly `Kierroksen esikatselu: tämän illan ottelut`
   (tomorrow: `Esikatsele huomisen kierros`). No rows: say there are no games and stop.

2. Run this once, with every returned row copied verbatim into `rows`:

```python
import glob, os, sys
# Skillin kansio on versiokohtainen (git-commit polussa), joten haetaan se.
sys.path.insert(0, os.path.dirname(glob.glob("/mnt/skills/**/esikatselu-html/render.py", recursive=True)[0]))
from render import render
rows = [{"ottelu": "...", "ennuste": "...", "tilanne": "...", "maalivahdit": "...",
         "keskinaiset": None, "suosikki": "..."}]   # one dict per row
print(render(rows, title="Kierroksen esikatselu D.M.YYYY"))   # prints the file path
```

3. `present_file` with the printed path. Then one Finnish sentence: number of
   games and the clearest favourite.
