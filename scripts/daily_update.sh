#!/bin/bash
# Daily standings update — invoked by launchd (com.liiga.daily-update).
# Logs to logs/daily_update.log; keeps only the last ~2000 lines.
set -euo pipefail

REPO="/Users/mika.heino/prod/liiga_2026-27"
LOG_DIR="$REPO/logs"
LOG="$LOG_DIR/daily_update.log"

mkdir -p "$LOG_DIR"
cd "$REPO"

{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') daily update ==="
  "$REPO/.venv/bin/python" scripts/daily_update.py
  echo "=== done ==="
} >> "$LOG" 2>&1

tail -n 2000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
