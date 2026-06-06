#!/usr/bin/env bash
# Restore Postgres + media from a backup folder created by backup.sh.
# Usage: ./scripts/restore-backup.sh /path/to/backups/20260101-120000
#
# WARNING: overwrites current DB and media volume. Stop traffic first.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${1:-}"

if [[ -z "$SRC" || ! -d "$SRC" ]]; then
  echo "[restore] Usage: $0 /path/to/backup-folder" >&2
  exit 1
fi

ENV_FILE="${ROOT}/.env.production"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

POSTGRES_DB="${POSTGRES_DB:-stream_music}"
POSTGRES_USER="${POSTGRES_USER:-stream_music}"
COMPOSE=(docker compose -f "${ROOT}/docker-compose.prod.yml")
if [[ "${USE_VPS_COMPOSE:-0}" == "1" && -f "${ROOT}/docker-compose.prod.vps.yml" ]]; then
  COMPOSE+=(-f "${ROOT}/docker-compose.prod.vps.yml")
fi

echo "[restore] Source: $SRC"
read -r -p "[restore] This will REPLACE the database and media. Continue? [y/N] " ans
if [[ "${ans,,}" != "y" ]]; then
  echo "[restore] Aborted."
  exit 0
fi

"${COMPOSE[@]}" up -d postgres redis

if [[ -f "${SRC}/postgres.sql.gz" ]]; then
  echo "[restore] Restoring Postgres…"
  gunzip -c "${SRC}/postgres.sql.gz" | "${COMPOSE[@]}" exec -T postgres \
    psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1
  echo "[restore] Postgres restored."
else
  echo "[restore] No postgres.sql.gz — skip DB" >&2
fi

MEDIA_VOL="stream-music_media_data"
if [[ -f "${SRC}/media.tar.gz" ]] && docker volume inspect "$MEDIA_VOL" >/dev/null 2>&1; then
  echo "[restore] Restoring media volume…"
  docker run --rm -v "${MEDIA_VOL}:/media" -v "${SRC}:/backup:ro" alpine \
    sh -c "rm -rf /media/* /media/.[!.]* 2>/dev/null || true; tar xzf /backup/media.tar.gz -C /media"
  echo "[restore] Media restored."
else
  echo "[restore] No media.tar.gz or volume — skip media" >&2
fi

echo "[restore] Done. Restart stack: ./deploy/up.sh"
