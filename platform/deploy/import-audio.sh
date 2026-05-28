#!/usr/bin/env bash
# Import tracks from a host folder into the prod stack's MEDIA_ROOT (/media volume)
# and Postgres used by docker-compose.prod.yml.
#
# Usage:
#   ./deploy/import-audio.sh /absolute/path/to/music --owner USERNAME
#   ./deploy/import-audio.sh ~/Music/albums --owner saweedkh --dry-run
#
# Requires: ./deploy/up.sh has been run at least once (deploy/.env.runtime.merged exists).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_MERGED="${ROOT}/deploy/.env.runtime.merged"
COMPOSE="${ROOT}/docker-compose.prod.yml"

if [[ ! -f "$ENV_MERGED" ]]; then
  echo "[import-audio] Missing $ENV_MERGED — run ./deploy/up.sh first."
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /absolute/path/to/music/folder [--owner USER] [other import_audio flags]"
  exit 1
fi

SOURCE="$(realpath "$1")"
shift

if [[ ! -d "$SOURCE" ]]; then
  echo "[import-audio] Not a directory: $SOURCE"
  exit 1
fi

echo "[import-audio] Host folder (read-only in container): $SOURCE"
echo "[import-audio] Running: python manage.py import_audio /inbox $*"

cd "$ROOT"
docker compose --env-file "$ENV_MERGED" -f "$COMPOSE" run --rm \
  -v "${SOURCE}:/inbox:ro" \
  backend \
  python manage.py import_audio /inbox "$@"
