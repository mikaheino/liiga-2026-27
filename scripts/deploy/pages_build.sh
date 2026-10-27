#!/bin/bash
# GitHub Pages -kopio Liiga Ennuste -sovelluksesta (27.10.): staattinen vienti
# ilman agenttia (Chat, /api/chat), LinkedIn-osiota ja Mouho-ilmoittautumista.
# Data luetaan data/liiga.duckdb:stä käännöksen aikana (LIIGA_DATA=duckdb), joten
# aja ensin daily_update.py. Ajaa .github/workflows/pages.yml; paikallisesti:
#
#     scripts/deploy/pages_build.sh            # -> .pages/out
#     python -m http.server 8766 --directory .pages/out   # BASE_PATH= paikalliseen katseluun
#
# Sovelluksen lähdettä ei muuteta: käännös tehdään kopiossa, josta palvelinreitit
# poistetaan ja force-dynamic vaihdetaan force-staticiksi (vienti ei salli sitä).
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
APP="$REPO/snowflake/LIIGA/CODE/application_services/LIIGA_ENNUSTE"
WORK="$REPO/.pages"
BUILD="$WORK/build"
OUT="$WORK/out"
export NEXT_PUBLIC_BASE_PATH="${BASE_PATH-/liiga-2026-27}"

rm -rf "$BUILD" "$OUT"
mkdir -p "$BUILD"
rsync -a --exclude node_modules --exclude .next --exclude out --exclude '*.log' \
  --exclude tsconfig.tsbuildinfo --exclude public/mouho "$APP/" "$BUILD/"
rm -rf "$BUILD/app/api" "$BUILD/app/linkedin" "$BUILD/app/mouho"
grep -rl 'dynamic = "force-dynamic"' "$BUILD/app" | xargs perl -pi -e 's/dynamic = "force-dynamic"/dynamic = "force-static"/'
# Joukkuesivut etukäteen. Vain tähän kopioon: lähteessä generateStaticParams tekisi
# Snowflaken joukkuesivuista staattisia (ensimmäisen haun data jäisi voimaan).
cat >> "$BUILD/app/joukkue/[team]/page.tsx" <<'TS'

export async function generateStaticParams() {
  return (await loadTeams()).map((team) => ({ team }));
}
TS

# Riippuvuudet: CI:ssä puhdas asennus, paikallisesti sovelluksen omat kopiona
# (Turbopack ei seuraa projektin ulkopuolelle osoittavaa node_modules-linkkiä).
if [ -n "${CI:-}" ]; then
  (cd "$BUILD" && npm ci --no-audit --no-fund)
else
  rsync -a "$APP/node_modules" "$BUILD/"
fi

(cd "$BUILD" && LIIGA_DATA=duckdb LIIGA_REPO="$REPO" NEXT_PUBLIC_LIIGA_STATIC=1 npx next build)
mv "$BUILD/out" "$OUT"
touch "$OUT/.nojekyll"     # _next/-hakemisto: Jekyll jättäisi alaviivalliset pois
echo "valmis: $OUT ($(du -sh "$OUT" | cut -f1))"
