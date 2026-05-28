#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_MERGED="${ROOT}/deploy/.env.runtime.merged"

ARGS=( -f "${ROOT}/docker-compose.prod.yml" down "$@")
if [[ -f "$ENV_MERGED" ]]; then
  ARGS=( --env-file "$ENV_MERGED" "${ARGS[@]}" )
fi

docker compose "${ARGS[@]}"
