#!/usr/bin/env bash
# One-shot production bring-up: detect IP, render TLS + Django extras, build & start stack.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_MAIN="${ROOT}/.env.production"
ENV_GEN="${ROOT}/deploy/.env.generated"
ENV_MERGED="${ROOT}/deploy/.env.runtime.merged"
CADDY_OUT="${ROOT}/deploy/Caddyfile.generated"
DETECT_IP="${ROOT}/deploy/lib/detect-primary-ip.sh"

if [[ ! -f "$ENV_MAIN" ]]; then
  echo "[deploy] Missing .env.production — copying deploy/env.production.example"
  cp "${ROOT}/deploy/env.production.example" "$ENV_MAIN"
  echo "[deploy] Edit $ENV_MAIN (SECRET_KEY, POSTGRES_PASSWORD, …) then re-run ./deploy/up.sh"
  exit 1
fi

if ! grep -qE '^SECRET_KEY=.+' "$ENV_MAIN"; then
  echo "[deploy] Set SECRET_KEY in .env.production"
  exit 1
fi
if grep -qiE '^SECRET_KEY=.*change-me' "$ENV_MAIN"; then
  new_key="$(openssl rand -hex 64)"
  # macOS BSD sed requires `sed -i '' …`; GNU sed accepts `sed -i …` only.
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

# SITE_DOMAIN: if .env.production defines SITE_DOMAIN=... (even empty), that wins — avoids stale `export SITE_DOMAIN` in the shell.
_site_domain_shell="${SITE_DOMAIN:-}"
SITE_DOMAIN=""
SITE_DOMAIN_SOURCE=""
if grep -qE '^SITE_DOMAIN=' "$ENV_MAIN" 2>/dev/null; then
  _sd_line="$(grep '^SITE_DOMAIN=' "$ENV_MAIN" | head -1)"
  SITE_DOMAIN="${_sd_line#SITE_DOMAIN=}"
  SITE_DOMAIN="${SITE_DOMAIN//$'\r'/}"
  SITE_DOMAIN_SOURCE=".env.production"
else
  SITE_DOMAIN="${_site_domain_shell}"
  [[ -n "${SITE_DOMAIN:-}" ]] && SITE_DOMAIN_SOURCE="environment"
fi

# PRIMARY_IP: shell env wins, then .env.production PRIMARY_IP=..., else route-based detect.
PRIMARY_IP_SOURCE="detected"
if [[ -n "${PRIMARY_IP:-}" ]]; then
  PRIMARY_IP_SOURCE="environment"
elif [[ -f "$ENV_MAIN" ]]; then
  _line="$(grep -E '^PRIMARY_IP=[^[:space:]]+' "$ENV_MAIN" 2>/dev/null | head -1 || true)"
  if [[ -n "$_line" ]]; then
    PRIMARY_IP="${_line#PRIMARY_IP=}"
    PRIMARY_IP="${PRIMARY_IP//$'\r'/}"
    PRIMARY_IP_SOURCE=".env.production"
  fi
fi
if [[ -z "${PRIMARY_IP:-}" ]]; then
  PRIMARY_IP="$("$DETECT_IP")"
fi

echo "[deploy] Primary IPv4 (${PRIMARY_IP_SOURCE}): ${PRIMARY_IP}"
if [[ -n "$SITE_DOMAIN" ]]; then
  echo "[deploy] SITE_DOMAIN=${SITE_DOMAIN} (${SITE_DOMAIN_SOURCE:-set}) — automatic HTTPS via Let's Encrypt"
else
  echo "[deploy] No SITE_DOMAIN (${SITE_DOMAIN_SOURCE:-unset}) — using IP ${PRIMARY_IP} with tls internal (browser warning OK)"
fi

bash "${ROOT}/deploy/render-env-generated.sh" "$PRIMARY_IP" "$SITE_DOMAIN" >"$ENV_GEN"
bash "${ROOT}/deploy/render-caddyfile.sh" "$PRIMARY_IP" "$SITE_DOMAIN" >"$CADDY_OUT"

cat "$ENV_MAIN" "$ENV_GEN" >"$ENV_MERGED"

echo "[deploy] Wrote $ENV_GEN"
echo "[deploy] Wrote $ENV_MERGED"
echo "[deploy] Wrote $CADDY_OUT"

docker compose \
  --env-file "$ENV_MERGED" \
  -f "${ROOT}/docker-compose.prod.yml" \
  up -d --build --remove-orphans "$@"

echo ""
echo "[deploy] Running."
if [[ -n "$SITE_DOMAIN" ]]; then
  echo "  HTTPS:  https://${SITE_DOMAIN}/  |  https://${SITE_DOMAIN}:8443/"
  echo "  HTTP:   http://${PRIMARY_IP}:8080/  (plain HTTP on LAN — works when HTTPS tools/proxies fail)"
else
  echo "  HTTPS:  https://${PRIMARY_IP}/  |  https://${PRIMARY_IP}:8443/"
  echo "  HTTP:   http://${PRIMARY_IP}:8080/  (plain HTTP on LAN — works when HTTPS tools/proxies fail)"
fi
echo "  Stack:  Caddy — publish 80→redirect, 443/8443→HTTPS, 8080→HTTP (same paths as dev nginx :8080)."
echo "  Hint:   For login via http://…:8080 set SESSION_COOKIE_SECURE=0 and CSRF_COOKIE_SECURE=0 in .env.production."
echo "  Hint:   If curl/browser HTTPS breaks, disable system proxy or add ${PRIMARY_IP} to NO_PROXY (http_proxy/all_proxy tunnel TLS incorrectly)."
if grep -q '^DETECTED_PUBLIC_IPV4=[0-9]' "$ENV_GEN" 2>/dev/null; then
  pub="$(grep '^DETECTED_PUBLIC_IPV4=' "$ENV_GEN" | cut -d= -f2-)"
  echo "  Public: ${pub} (if behind NAT, open 80/443/8443/8080 to this host)"
fi
echo ""
echo "  Logs:   docker compose --env-file deploy/.env.runtime.merged -f docker-compose.prod.yml logs -f"
