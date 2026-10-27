#!/bin/bash
# Push news-data-haaraan, vaikka toinen ajo ehti ensin: haetaan ja rebasetaan
# päälle (eri tiedostot, ei konflikteja) ja yritetään uudelleen. Käyttö
# haaran hakemistossa: push-retry.sh HAARA
set -euo pipefail
branch="$1"
for i in 1 2 3 4 5 6; do
  git push -q origin "HEAD:$branch" && exit 0
  echo "push hylättiin (yritys $i), haetaan uudet muutokset"
  sleep $((i * 2))
  git pull -q --rebase origin "$branch"
done
echo "push ei onnistunut"; exit 1
