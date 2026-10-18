#!/usr/bin/env bash
# Mouho-pelin kaikki näkymät kuviksi (päätteetön Chrome, ?nayta=). Käyttö: mouho_shots.sh <kansio> [näkymä ...]
# Grafiikkaputken (docs/mouho_pixel_art.md) arvostelija ja valvoja katsovat näitä.
set -euo pipefail
out=${1:?kansio}; shift || true
views=${*:-"kisa liiga suomi kartta basaari temppeli kaivokatu loppu puhelu esineet hahmot otsikko"}
mkdir -p "$out"
for v in $views; do
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
    --screenshot="$out/$v.png" --window-size=960,440 --virtual-time-budget=4000 "${MOUHO_URL:-http://localhost:3010/mouho/index.html}?nayta=$v" 2>/dev/null
done
ls "$out"
