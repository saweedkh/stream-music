#!/usr/bin/env bash
# Export minimal OpenAPI JSON from a running API (or DJANGO_SETTINGS_MODULE local).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$ROOT/apps/web/src/lib/api/openapi.snapshot.json}"
BASE_URL="${OPENAPI_BASE_URL:-http://127.0.0.1:8000}"
curl -fsS "${BASE_URL%/}/api/schema/openapi.json" -o "$OUT"
echo "Wrote $OUT"
