#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ROOT}/.env.edge"
compose() {
  if [[ -f "$ENV_FILE" ]]; then
    docker compose -f "${ROOT}/docker-compose.yml" --env-file "$ENV_FILE" "$@"
  else
    docker compose -f "${ROOT}/docker-compose.yml" "$@"
  fi
}
compose down "$@"
