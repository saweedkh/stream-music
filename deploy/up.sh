#!/usr/bin/env bash
# One-shot production bring-up: detect IP, render nginx + Django extras, build & start stack.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_MAIN="${ROOT}/.env.production"
ENV_GEN="${ROOT}/deploy/.env.generated"
ENV_MERGED="${ROOT}/deploy/.env.runtime.merged"
NGINX_OUT="${ROOT}/deploy/nginx.generated.conf"
DETECT_IP="${ROOT}/deploy/lib/detect-primary-ip.sh"
RENDER_NGINX="${ROOT}/deploy/render-nginx-prod.sh"

if [[ ! -f "$ENV_MAIN" ]]; then
  echo "[deploy] Missing .env.production — copying deploy/env.production.example"
  cp "${ROOT}/deploy/env.production.example" "$ENV_MAIN"
  echo "[deploy] Edit $ENV_MAIN (SECRET_KEY, POSTGRES_PASSWORD, TLS_CERT_NAME, …) then re-run ./deploy/up.sh"
  exit 1
fi

if ! grep -qE '^SECRET_KEY=.+' "$ENV_MAIN"; then
  echo "[deploy] Set SECRET_KEY in .env.production"
  exit 1
fi
if grep -qiE '^SECRET_KEY=.*change-me' "$ENV_MAIN"; then
  new_key="$(openssl rand -hex 64)"
  case "$(uname -s)" in
    Darwin)
      sed -i '' "s/^SECRET_KEY=.*/SECRET_KEY=${new_key}/" "$ENV_MAIN"
      ;;
    *)
      sed -i "s/^SECRET_KEY=.*/SECRET_KEY=${new_key}/" "$ENV_MAIN"
      ;;
  esac
  echo "[deploy] Generated SECRET_KEY in .env.production (replaced example placeholder)"
fi

if ! grep -qE '^POSTGRES_PASSWORD=.+' "$ENV_MAIN"; then
  echo "[deploy] Set POSTGRES_PASSWORD in .env.production"
  exit 1
fi

# Parse ONLY ${ENV_MAIN} on this machine (push.sh never uploads it unless you pass --with-env).
_FILE_SITE_DOMAIN=""
_FILE_PRIMARY_IP=""
_FILE_TLS_CERT_NAME=""
_FILE_TLS_CERT_DIR=""
_FILE_TLS_CERT_HOST_DIR=""
_ENV_SITE_DOMAIN_LINES=""
_ENV_SITE_DOMAIN_COMMENTED=0
while IFS= read -r _line || [[ -n "$_line" ]]; do
  _line="${_line%$'\r'}"
  [[ -z "${_line//[[:space:]]/}" ]] && continue
  if [[ "$_line" =~ ^[[:space:]]*#.*SITE_DOMAIN ]]; then
    _ENV_SITE_DOMAIN_COMMENTED=1
    continue
  fi
  [[ "$_line" =~ ^[[:space:]]*# ]] && continue
  [[ "$_line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]] || continue
  _k="${BASH_REMATCH[1]}"
  _v="${BASH_REMATCH[2]}"
  _v="${_v#"${_v%%[![:space:]]*}"}"
  _v="${_v%"${_v##*[![:space:]]}"}"
  if [[ "$_v" =~ ^\"(.*)\"$ ]]; then _v="${BASH_REMATCH[1]}"; fi
  if [[ "$_v" =~ ^\'(.*)\'$ ]]; then _v="${BASH_REMATCH[1]}"; fi
  [[ -z "$_v" ]] && continue
  case "$_k" in
    SITE_DOMAIN)
      _FILE_SITE_DOMAIN="$_v"
      _ENV_SITE_DOMAIN_LINES+="${_line}"$'\n'
      ;;
    PRIMARY_IP) _FILE_PRIMARY_IP="$_v" ;;
    TLS_CERT_NAME) _FILE_TLS_CERT_NAME="$_v" ;;
    TLS_CERT_DIR) _FILE_TLS_CERT_DIR="$_v" ;;
    TLS_CERT_HOST_DIR) _FILE_TLS_CERT_HOST_DIR="$_v" ;;
  esac
done < "$ENV_MAIN"

_site_domain_shell="${SITE_DOMAIN:-}"
SITE_DOMAIN=""
SITE_DOMAIN_SOURCE=""
if [[ -n "$_FILE_SITE_DOMAIN" ]]; then
  SITE_DOMAIN="$_FILE_SITE_DOMAIN"
  SITE_DOMAIN_SOURCE=".env.production"
elif [[ -n "${_site_domain_shell:-}" ]]; then
  SITE_DOMAIN="${_site_domain_shell}"
  SITE_DOMAIN_SOURCE="environment"
fi

TLS_CERT_NAME="${TLS_CERT_NAME:-${_FILE_TLS_CERT_NAME:-saweedkh.ir}}"
TLS_CERT_DIR="${TLS_CERT_DIR:-${_FILE_TLS_CERT_DIR:-/etc/letsencrypt/live}}"
TLS_CERT_HOST_DIR="${TLS_CERT_HOST_DIR:-${_FILE_TLS_CERT_HOST_DIR:-/etc/letsencrypt}}"

PRIMARY_IP_SOURCE="detected"
if [[ -n "${PRIMARY_IP:-}" ]]; then
  PRIMARY_IP_SOURCE="environment"
elif [[ -n "$_FILE_PRIMARY_IP" ]]; then
  PRIMARY_IP="$_FILE_PRIMARY_IP"
  PRIMARY_IP_SOURCE=".env.production"
fi
if [[ -z "${PRIMARY_IP:-}" ]]; then
  PRIMARY_IP="$("$DETECT_IP")"
fi

_ENV_ABS="$(cd "$(dirname "$ENV_MAIN")" && pwd)/$(basename "$ENV_MAIN")"
echo "[deploy] Env source: server file only → ${_ENV_ABS}"
echo "[deploy] Expected project root: /root/stream-music (set REMOTE_PATH=/root/stream-music in deploy/sync.env)."
echo "[deploy] push.sh does not upload .env.production unless you pass --with-env."
if [[ -n "$_ENV_SITE_DOMAIN_LINES" ]]; then
  echo "[deploy] SITE_DOMAIN line(s) parsed: $(printf '%s' "$_ENV_SITE_DOMAIN_LINES" | tr '\n' ' ')"
elif [[ "$_ENV_SITE_DOMAIN_COMMENTED" -eq 1 ]]; then
  echo "[deploy] SITE_DOMAIN: found only as comment (# SITE_DOMAIN=…) — remove leading #"
else
  echo "[deploy] SITE_DOMAIN: no active line in file (expected: SITE_DOMAIN=music.saweedkh.ir)"
  echo "[deploy] Hint: ssh to server → nano ${_ENV_ABS}"
fi

echo "[deploy] Primary IPv4 (${PRIMARY_IP_SOURCE}): ${PRIMARY_IP}"
if [[ -n "$SITE_DOMAIN" ]]; then
  echo "[deploy] SITE_DOMAIN=${SITE_DOMAIN} (${SITE_DOMAIN_SOURCE:-set})"
else
  echo "[deploy] No SITE_DOMAIN (${SITE_DOMAIN_SOURCE:-unset}) — HTTPS uses server_name ${PRIMARY_IP}"
fi
if [[ -n "$TLS_CERT_NAME" ]]; then
  echo "[deploy] TLS cert: ${TLS_CERT_DIR}/${TLS_CERT_NAME} (host mount: ${TLS_CERT_HOST_DIR})"
else
  echo "[deploy] TLS_CERT_NAME unset — only HTTP :8080 (no :443 block)"
fi

bash "${ROOT}/deploy/render-env-generated.sh" "$PRIMARY_IP" "$SITE_DOMAIN" >"$ENV_GEN"
bash "$RENDER_NGINX" "$PRIMARY_IP" "$SITE_DOMAIN" "$TLS_CERT_NAME" "$TLS_CERT_DIR" >"$NGINX_OUT"

cat "$ENV_MAIN" "$ENV_GEN" >"$ENV_MERGED"

echo "[deploy] Wrote $ENV_GEN"
echo "[deploy] Wrote $ENV_MERGED"
echo "[deploy] Wrote $NGINX_OUT"

chmod +x "${ROOT}/deploy/nginx-prod-entrypoint.sh" "$RENDER_NGINX" 2>/dev/null || true

docker compose \
  --env-file "$ENV_MERGED" \
  -f "${ROOT}/docker-compose.prod.yml" \
  up -d --build --remove-orphans "$@"

echo ""
echo "[deploy] Running."
if [[ -n "$SITE_DOMAIN" ]]; then
  echo "  HTTPS:  https://${SITE_DOMAIN}/  |  https://${SITE_DOMAIN}:8443/"
  echo "  HTTP:   http://${PRIMARY_IP}:8080/  (plain HTTP on LAN)"
else
  echo "  HTTPS:  https://${PRIMARY_IP}/  |  https://${PRIMARY_IP}:8443/"
  echo "  HTTP:   http://${PRIMARY_IP}:8080/"
fi
echo "  Stack:  nginx — :80→redirect HTTPS, :443/:8443 TLS (Certbot files), :8080 plain HTTP."
echo "  Hint:   For login via http://…:8080 set SESSION_COOKIE_SECURE=0 and CSRF_COOKIE_SECURE=0 in .env.production."
echo "  Hint:   After certbot renew: docker compose --env-file deploy/.env.runtime.merged -f docker-compose.prod.yml exec nginx nginx -s reload"
if grep -q '^DETECTED_PUBLIC_IPV4=[0-9]' "$ENV_GEN" 2>/dev/null; then
  pub="$(grep '^DETECTED_PUBLIC_IPV4=' "$ENV_GEN" | cut -d= -f2-)"
  echo "  Public: ${pub} (if behind NAT, open 80/443/8443/8080 to this host)"
fi
echo ""
echo "  Logs:   docker compose --env-file deploy/.env.runtime.merged -f docker-compose.prod.yml logs -f nginx"
