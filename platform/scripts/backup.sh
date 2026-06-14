#!/usr/bin/env bash
# Backup Postgres + media volume for Stream Music.
# Usage: ./scripts/backup.sh [output_dir]

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-${ROOT}/backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${OUT}/${STAMP}"
mkdir -p "$DEST"

ENV_FILE="${ROOT}/.env.production"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

POSTGRES_DB="${POSTGRES_DB:-stream_music}"
POSTGRES_USER="${POSTGRES_USER:-stream_music}"

echo "[backup] Writing to $DEST"

if docker compose -f "${ROOT}/docker-compose.prod.yml" ps postgres 2>/dev/null | grep -q running; then
  docker compose -f "${ROOT}/docker-compose.prod.yml" exec -T postgres \
    pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "${DEST}/postgres.sql.gz"
  echo "[backup] Postgres dump done"
else
  echo "[backup] Postgres container not running — skip DB dump"
fi

MEDIA_DIR="${MEDIA_HOST_DIR:-${ROOT}/media}"
if [[ -d "$MEDIA_DIR" ]]; then
  tar czf "${DEST}/media.tar.gz" -C "$(dirname "$MEDIA_DIR")" "$(basename "$MEDIA_DIR")"
  echo "[backup] Media archive done (${MEDIA_DIR})"
else
  MEDIA_VOL="stream-music_media_data"
  if docker volume inspect "$MEDIA_VOL" >/dev/null 2>&1; then
    docker run --rm -v "${MEDIA_VOL}:/media:ro" -v "${DEST}:/backup" alpine \
      tar czf /backup/media.tar.gz -C /media .
    echo "[backup] Media archive done (legacy volume ${MEDIA_VOL})"
  else
    echo "[backup] No media dir or volume — skip media"
  fi
fi

echo "[backup] Complete: $DEST"
