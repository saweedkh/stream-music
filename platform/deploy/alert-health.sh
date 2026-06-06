#!/usr/bin/env bash
# Cron-friendly health alert — exits non-zero when API is degraded.
# Usage: SMOKE_BASE_URL=http://127.0.0.1:8080 ./deploy/alert-health.sh
# Example cron (every 5 min): */5 * * * * /root/stream-music/deploy/alert-health.sh || logger "stream-music health FAIL"

set -euo pipefail

BASE="${SMOKE_BASE_URL:-http://127.0.0.1:8080}"
HEALTH_URL="${BASE%/}/api/health"

body="$(curl -sf --max-time 15 "$HEALTH_URL")" || {
  echo "[alert] unreachable: $HEALTH_URL" >&2
  exit 2
}

echo "$body" | grep -q '"status": "ok"' || {
  echo "[alert] degraded: $body" >&2
  exit 1
}

echo "[alert] OK"
