#!/usr/bin/env bash
# Sync project to production server and run ./deploy/up.sh (safe: keeps Docker volumes).
set -euo pipefail

_DEPLOY_LIB="$(cd "$(dirname "${BASH_SOURCE[0]}")/lib" && pwd)"
# shellcheck source=lib/resolve-repo-root.sh
source "${_DEPLOY_LIB}/resolve-repo-root.sh"
ROOT="$(resolve_repo_root "${BASH_SOURCE[0]}")" || {
  echo "[push] Could not find repo root." >&2
  exit 1
}
cd "$ROOT"

SYNC_ENV="${ROOT}/deploy/sync.env"
DRY_RUN=0
SYNC_ONLY=0
WITH_ENV=0

usage() {
  cat <<'EOF'
Usage: ./deploy/push.sh [options]

  Sync code to the server (rsync) and run ./deploy/up.sh remotely.
  Does NOT delete Postgres/media volumes. By default does NOT overwrite .env.production on the server.

Options:
  --with-env    Also rsync ./.env.production to the server (overwrites remote copy)
  --dry-run     Show rsync changes without copying or deploying
  --sync-only   Rsync only; skip remote ./deploy/up.sh
  -h, --help    This help

Setup (once):
  cp deploy/sync.env.example deploy/sync.env
  # Edit deploy/sync.env (host, user, path, optional SSH_PASSWORD or use ssh-copy-id)

EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-env) WITH_ENV=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --sync-only) SYNC_ONLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "[push] Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ "$WITH_ENV" -eq 1 && ! -f "${ROOT}/.env.production" ]]; then
  echo "[push] --with-env requires ${ROOT}/.env.production on this machine" >&2
  exit 1
fi

if [[ ! -f "$SYNC_ENV" ]]; then
  echo "[push] Missing $SYNC_ENV" >&2
  echo "[push] Run: cp deploy/sync.env.example deploy/sync.env && edit it" >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$SYNC_ENV"

REMOTE_HOST="${REMOTE_HOST:?Set REMOTE_HOST in deploy/sync.env}"
REMOTE_USER="${REMOTE_USER:?Set REMOTE_USER in deploy/sync.env}"
REMOTE_PATH="${REMOTE_PATH:-}"
SSH_PORT="${SSH_PORT:-22}"
SSH_PASSWORD="${SSH_PASSWORD:-}"
SSH_IDENTITY_FILE="${SSH_IDENTITY_FILE:-}"

if ! command -v rsync >/dev/null 2>&1; then
  echo "[push] rsync is required" >&2
  exit 1
fi

SSH_BASE_OPTS=(
  -o "StrictHostKeyChecking=accept-new"
  -o "ConnectTimeout=15"
  -p "$SSH_PORT"
)
if [[ -n "$SSH_IDENTITY_FILE" ]]; then
  SSH_BASE_OPTS+=(-i "$SSH_IDENTITY_FILE")
fi

USE_SSHPASS=0
if [[ -n "$SSH_PASSWORD" ]]; then
  if command -v sshpass >/dev/null 2>&1; then
    USE_SSHPASS=1
    export SSHPASS="$SSH_PASSWORD"
  else
    echo "[push] SSH_PASSWORD is set but sshpass is not installed." >&2
    echo "[push] Install: brew install hudochenkov/sshpass/sshpass" >&2
    echo "[push] Or use SSH keys: ssh-copy-id -p ${SSH_PORT} ${REMOTE_USER}@${REMOTE_HOST}" >&2
    exit 1
  fi
fi

ssh_cmd() {
  if [[ "$USE_SSHPASS" -eq 1 ]]; then
    sshpass -e ssh "${SSH_BASE_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "$@"
  else
    ssh "${SSH_BASE_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" "$@"
  fi
}

rsync_rsh() {
  if [[ "$USE_SSHPASS" -eq 1 ]]; then
    printf '%s\n' "sshpass -e ssh ${SSH_BASE_OPTS[*]}"
  else
    printf '%s\n' "ssh ${SSH_BASE_OPTS[*]}"
  fi
}

detect_remote_path() {
  local out rc
  set +e
  out="$(ssh_cmd 'bash -s' 2>&1 <<'REMOTE'
set -euo pipefail
candidates=(
  "/root/stream-music"
  "/opt/stream-music"
  "/var/www/stream-music"
  "$HOME/stream-music"
)
for d in "${candidates[@]}"; do
  if [[ -f "${d}/docker-compose.prod.yml" && -f "${d}/deploy/up.sh" ]]; then
    echo "$d"
    exit 0
  fi
done
found="$(find /root /opt /var/www -maxdepth 4 -path '*/deploy/up.sh' 2>/dev/null | head -1 || true)"
if [[ -n "$found" ]]; then
  dirname "$(dirname "$found")"
  exit 0
fi
exit 2
REMOTE
)"
  rc=$?
  set -e
  if [[ "$rc" -eq 0 && -n "$out" ]]; then
    echo "$out" | tail -1
    return 0
  fi
  if [[ "$rc" -ne 0 ]]; then
    echo "$out" >&2
    if grep -qiE 'timed out|connection refused|no route|could not resolve' <<<"$out"; then
      echo "[push] SSH failed — check REMOTE_HOST, SSH_PORT, firewall (port 22), and server uptime." >&2
    else
      echo "[push] Project not found on server. Set REMOTE_PATH in deploy/sync.env (e.g. /root/stream-music)." >&2
    fi
    return 1
  fi
  return 1
}

if [[ -z "$REMOTE_PATH" ]]; then
  echo "[push] REMOTE_PATH not set — detecting on server…"
  REMOTE_PATH="$(detect_remote_path)" || exit 1
  echo "[push] Detected REMOTE_PATH=${REMOTE_PATH}"
fi

REMOTE="${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PATH}/"

RSYNC_EXCLUDES=(
  --exclude '.git/'
  --exclude 'node_modules/'
  --exclude 'apps/web/node_modules/'
  --exclude 'apps/web/.next/'
  --exclude '__pycache__/'
  --exclude '*.pyc'
  --exclude '.venv/'
  --exclude 'venv/'
  --exclude '.env'
  --exclude '.env.production'
  --exclude 'media/'
  --exclude '.DS_Store'
  --exclude '.cursor/'
  --exclude 'infra/nginx/ssl/*.crt'
  --exclude 'infra/nginx/ssl/*.key'
  # Root symlinks (deploy→platform/deploy, …) — exclude name entirely; synced below as dirs.
  --exclude 'deploy'
  --exclude 'infra'
  --exclude 'scripts'
)

DEPLOY_RSYNC_EXCLUDES=(
  --exclude 'sync.env'
  --exclude '.env.generated'
  --exclude '.env.runtime.merged'
  --exclude 'nginx.generated.conf'
)

ensure_remote_dir() {
  local name="$1"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    return 0
  fi
  ssh_cmd "bash -s" "$REMOTE_PATH" "$name" <<'REMOTE'
set -euo pipefail
root="$1"
name="$2"
path="${root}/${name}"
if [[ -L "$path" ]]; then
  target="$(readlink "$path")"
  if [[ "$target" != /* ]]; then
    target="${root}/${target}"
  fi
  rm "$path"
  if [[ -d "$target" && "$target" != "$path" ]]; then
    mv "$target" "$path"
  else
    mkdir -p "$path"
  fi
elif [[ -f "$path" ]]; then
  rm -f "$path"
  mkdir -p "$path"
else
  mkdir -p "$path"
fi
REMOTE
}

echo "[push] Target: ${REMOTE}"
echo "[push] Testing SSH…"
ssh_cmd "test -d $(printf '%q' "$REMOTE_PATH") || mkdir -p $(printf '%q' "$REMOTE_PATH")"

for remote_name in deploy infra scripts; do
  echo "[push] Ensuring remote ${remote_name}/ is a directory…"
  ensure_remote_dir "$remote_name"
done

RSYNC_OPTS=(
  -az
  --human-readable
  --delete
  "${RSYNC_EXCLUDES[@]}"
)

if [[ "$DRY_RUN" -eq 1 ]]; then
  RSYNC_OPTS+=(--dry-run)
fi

# shellcheck disable=SC2046
rsync "${RSYNC_OPTS[@]}" \
  -e "$(rsync_rsh)" \
  "${ROOT}/" \
  "$REMOTE"

for remote_name in deploy infra scripts; do
  echo "[push] Ensuring remote ${remote_name}/ is a directory…"
  ensure_remote_dir "$remote_name"
done

# Sync platform/* paths into server dirs (avoid replacing deploy/ with a symlink).
for pair in deploy:platform/deploy infra:platform/infra scripts:platform/scripts; do
  remote_name="${pair%%:*}"
  local_dir="${pair##*:}"
  echo "[push] Syncing ${local_dir}/ → ${remote_name}/"
  rsync_args=("${RSYNC_OPTS[@]}")
  if [[ "$remote_name" == deploy ]]; then
    rsync_args+=("${DEPLOY_RSYNC_EXCLUDES[@]}")
  fi
  # shellcheck disable=SC2046
  rsync "${rsync_args[@]}" \
    -e "$(rsync_rsh)" \
    "${ROOT}/${local_dir}/" \
    "${REMOTE}${remote_name}/"
done

if [[ "$WITH_ENV" -eq 1 ]]; then
  echo "[push] Uploading .env.production…"
  env_rsync_opts=(-az --human-readable)
  if [[ "$DRY_RUN" -eq 1 ]]; then
    env_rsync_opts+=(--dry-run)
  fi
  # shellcheck disable=SC2046
  rsync "${env_rsync_opts[@]}" \
    -e "$(rsync_rsh)" \
    "${ROOT}/.env.production" \
    "${REMOTE}.env.production"
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[push] Dry run complete (no deploy)."
  exit 0
fi

if [[ "$SYNC_ONLY" -eq 1 ]]; then
  echo "[push] Sync complete (--sync-only; skipped deploy)."
  exit 0
fi

echo "[push] Deploying on server (./deploy/up.sh)…"
ssh_cmd "cd $(printf '%q' "$REMOTE_PATH") && chmod +x deploy/up.sh deploy/down.sh deploy/*.sh deploy/lib/*.sh 2>/dev/null || true && ./deploy/up.sh"

echo "[push] Done. Site: https://${REMOTE_HOST}/"
