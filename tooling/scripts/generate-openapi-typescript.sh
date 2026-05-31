#!/usr/bin/env bash
# Generate TypeScript types from openapi.snapshot.json via openapi-typescript.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SNAPSHOT="${1:-$ROOT/apps/web/src/lib/api/openapi.snapshot.json}"
OUT="$ROOT/apps/web/src/lib/api/types/openapi-schema.ts"

if [[ ! -f "$SNAPSHOT" ]]; then
  echo "Missing snapshot — run: make openapi-export" >&2
  exit 1
fi

cd "$ROOT/apps/web"
if ! npm ls openapi-typescript >/dev/null 2>&1; then
  npm install --save-dev openapi-typescript@^7.6.1
fi

npx openapi-typescript "$SNAPSHOT" -o "$OUT"
echo "Wrote $OUT"
"$ROOT/apps/api/.venv/bin/python" "$ROOT/tooling/scripts/generate-api-types-from-openapi.py" "$SNAPSHOT" 2>/dev/null || true
