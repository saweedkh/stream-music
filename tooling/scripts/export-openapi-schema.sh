#!/usr/bin/env bash
# Export minimal OpenAPI JSON (offline via Django, or curl when API is up).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$ROOT/apps/web/src/lib/api/openapi.snapshot.json}"
BASE_URL="${OPENAPI_BASE_URL:-http://127.0.0.1:8000}"

if curl -fsS "${BASE_URL%/}/api/schema/openapi.json" -o "$OUT" 2>/dev/null; then
  echo "Wrote $OUT (from ${BASE_URL})"
  "$ROOT/apps/api/.venv/bin/python" "$ROOT/tooling/scripts/generate-api-types-from-openapi.py" "$OUT"
  exit 0
fi

API_DIR="$ROOT/apps/api"
if [[ ! -x "$API_DIR/.venv/bin/python" ]]; then
  echo "curl failed and no apps/api/.venv — start API or create venv" >&2
  exit 1
fi

(
  cd "$API_DIR"
  export DJANGO_SETTINGS_MODULE=config.settings
  .venv/bin/python -c "
import json, sys
from django import setup
setup()
from apps.core.schema.schema_api import build_openapi_dict
path = sys.argv[1]
with open(path, 'w', encoding='utf-8') as f:
    json.dump(build_openapi_dict(), f, indent=2)
    f.write(chr(10))
print('Wrote', path, '(Django offline)')
" "$OUT"
  "$ROOT/apps/api/.venv/bin/python" "$ROOT/tooling/scripts/generate-api-types-from-openapi.py" "$OUT"
)
