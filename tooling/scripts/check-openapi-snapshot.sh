#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SNAPSHOT="$ROOT/apps/web/src/lib/api/openapi.snapshot.json"
bash "$ROOT/tooling/scripts/export-openapi-schema.sh" "$SNAPSHOT"
if ! git -C "$ROOT" diff --exit-code -- "$SNAPSHOT" "$ROOT/apps/web/src/lib/api/types/schema-paths.ts" >/dev/null 2>&1; then
  echo "OpenAPI snapshot or schema-paths.ts is out of date. Run: make openapi-export" >&2
  git -C "$ROOT" diff -- "$SNAPSHOT" "$ROOT/apps/web/src/lib/api/types/schema-paths.ts" || true
  exit 1
fi
echo "OpenAPI snapshot OK"
