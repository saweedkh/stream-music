#!/usr/bin/env bash
# Post-deploy smoke checks (run on server after ./deploy/up.sh).
# Usage: SMOKE_BASE_URL=http://127.0.0.1:8080 ./deploy/smoke.sh

set -euo pipefail

BASE="${SMOKE_BASE_URL:-http://127.0.0.1:8080}"
HEALTH_URL="${BASE%/}/api/health"
ROOT_URL="${BASE%/}/"

echo "[smoke] GET $HEALTH_URL"
health="$(curl -sf --max-time 15 "$HEALTH_URL")"
echo "$health" | grep -q '"status"' || {
  echo "[smoke] health response missing status field" >&2
  exit 1
}
echo "$health" | grep -q '"db": true' || {
  echo "[smoke] database not ready" >&2
  exit 1
}

echo "[smoke] GET $ROOT_URL"
curl -sf --max-time 15 -o /dev/null "$ROOT_URL"

echo "[smoke] OK"
