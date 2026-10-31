#!/usr/bin/env bash
# Projektin tila muutamalla rivillä (tokenisäästö: ei lokien ja taulujen selaamista).
# Käyttö: scripts/dev/status.sh
cd "$(dirname "$0")/../.." || exit 1
echo "git: $(git rev-parse --abbrev-ref HEAD) $(git log -1 --format='%h %cr: %s' | cut -c1-80); origin +$(git rev-list --count origin/main..HEAD 2>/dev/null) committia pushaamatta"
echo "ajo: $(grep -E '^season [0-9]+:|^updated:' logs/daily_update.log | tail -2 | tr '\n' ' ')"
f=$(grep -E 'snowflake sync:' logs/daily_update.log | tail -1); echo "synkka: ${f:-ei tietoa}"
.venv/bin/python - <<'PY'
import duckdb
c = duckdb.connect("data/liiga.duckdb", read_only=True)
# execute(...).fetchone(), ei sql(...).fetchone(): duckdb 2.0 poisti sen relaatioilta.
r = c.execute("""select count(*) filter (where ended), max(start_time) filter (where ended),
             min(start_time) filter (where not ended) from raw_games where season = (select max(season) from raw_games)""").fetchone()
u = c.execute("select max(updated_at) from prediction_meta").fetchone()[0]
print(f"data: {r[0]} pelattu, viimeisin {r[1]}, seuraava {r[2]}; ennuste päivitetty {u}")
PY
curl -s -o /dev/null -w "sovellus :3010 %{http_code}\n" --max-time 3 http://localhost:3010/ || echo "sovellus :3010 ei käynnissä"
