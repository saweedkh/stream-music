#!/usr/bin/env bash
# Bring up LAN edge proxy (nginx + on-disk /audio/ cache → UPSTREAM_URL).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ROOT}/.env.edge"
ENV_EXAMPLE="${ROOT}/env.example"
TEMPLATE="${ROOT}/nginx.conf.template"
OUT_CONF="${ROOT}/nginx.generated.conf"
DETECT_IP="${ROOT}/../lib/detect-primary-ip.sh"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[edge] Missing .env.edge — copying env.example"
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "[edge] Edit ${ENV_FILE} (set UPSTREAM_URL) then re-run ./deploy/edge-proxy/up.sh"
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

UPSTREAM_URL="${UPSTREAM_URL:?Set UPSTREAM_URL in .env.edge}"
EDGE_PORT="${EDGE_PORT:-9080}"
CACHE_MAX_SIZE="${CACHE_MAX_SIZE:-50g}"
CACHE_INACTIVE="${CACHE_INACTIVE:-30d}"
PROXY_SSL_VERIFY="${PROXY_SSL_VERIFY:-0}"

case "$PROXY_SSL_VERIFY" in
  0|false|no|off) PROXY_SSL_VERIFY_NGINX="off" ;;
  *) PROXY_SSL_VERIFY_NGINX="on" ;;
esac

# Normalize origin (scheme + host[:port], no path).
if [[ "$UPSTREAM_URL" =~ ^(https?)://([^/:]+)(:([0-9]+))?(/.*)?$ ]]; then
  UPSTREAM_SCHEME="${BASH_REMATCH[1]}"
  UPSTREAM_HOST="${BASH_REMATCH[2]}"
  UPSTREAM_PORT="${BASH_REMATCH[4]:-}"
else
  echo "[edge] UPSTREAM_URL must look like https://host or http://host:8080"
  exit 1
fi

if [[ -n "$UPSTREAM_PORT" ]]; then
  UPSTREAM_ORIGIN="${UPSTREAM_SCHEME}://${UPSTREAM_HOST}:${UPSTREAM_PORT}"
else
  UPSTREAM_ORIGIN="${UPSTREAM_SCHEME}://${UPSTREAM_HOST}"
fi

sed \
  -e "s|__UPSTREAM_ORIGIN__|${UPSTREAM_ORIGIN}|g" \
  -e "s|__UPSTREAM_HOST__|${UPSTREAM_HOST}|g" \
  -e "s|__CACHE_MAX_SIZE__|${CACHE_MAX_SIZE}|g" \
  -e "s|__CACHE_INACTIVE__|${CACHE_INACTIVE}|g" \
  -e "s|__PROXY_SSL_VERIFY__|${PROXY_SSL_VERIFY_NGINX}|g" \
  "$TEMPLATE" >"$OUT_CONF"

export EDGE_PORT
docker compose -f "${ROOT}/docker-compose.yml" --env-file "$ENV_FILE" up -d --remove-orphans "$@"

LAN_IP=""
if [[ -x "$DETECT_IP" ]]; then
  LAN_IP="$("$DETECT_IP" 2>/dev/null || true)"
fi

echo ""
echo "[edge] Running."
echo "  Upstream: ${UPSTREAM_ORIGIN}"
echo "  LAN URL:  http://${LAN_IP:-<this-host-ip>}:${EDGE_PORT}/"
echo "  Cache:    /audio/ on volume audio_cache (max ${CACHE_MAX_SIZE})"
echo ""
echo "  Share http://${LAN_IP:-YOUR_LAN_IP}:${EDGE_PORT}/ with colleagues on the same Wi‑Fi."
echo "  First play of each track hits the internet; repeats are served from local cache."
echo ""
echo "  Server checklist (central deploy):"
echo "    - TRUST_LAN_CSRF=1 is set by deploy/render-env-generated.sh (private LAN origins)."
echo "    - For http:// login via edge, set SESSION_COOKIE_SECURE=0 on the server if needed."
echo ""
echo "  Logs: docker compose -f deploy/edge-proxy/docker-compose.yml logs -f"
