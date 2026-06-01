#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/apps/web"
if [[ ! -d node_modules ]]; then
  echo "pre-commit: run 'cd apps/web && npm ci' first" >&2
  exit 1
fi
npx tsc --noEmit
