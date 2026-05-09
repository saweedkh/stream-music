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
  echo "[deploy] Replace the example SECRET_KEY with a long random value"
  exit 1
fi

if ! grep -qE '^POSTGRES_PASSWORD=.+' "$ENV_MAIN"; then
  echo "[deploy] Set POSTGRES_PASSWORD in .env.production"
  exit 1
fi

PRIMARY_IP="$("$DETECT_IP")"
SITE_DOMAIN="${SITE_DOMAIN:-}"

echo "[deploy] Detected primary IPv4: ${PRIMARY_IP}"
if [[ -n "$SITE_DOMAIN" ]]; then
  echo "[deploy] SITE_DOMAIN=${SITE_DOMAIN} (automatic HTTPS via Let's Encrypt)"
else
  echo "[deploy] No SITE_DOMAIN — using IP ${PRIMARY_IP} with tls internal (browser warning OK)"
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
  up -d --build "$@"

echo ""
echo "[deploy] Running."
if [[ -n "$SITE_DOMAIN" ]]; then
  echo "  App:    https://${SITE_DOMAIN}"
else
  echo "  App:    https://${PRIMARY_IP}"
fi
if grep -q '^DETECTED_PUBLIC_IPV4=[0-9]' "$ENV_GEN" 2>/dev/null; then
  pub="$(grep '^DETECTED_PUBLIC_IPV4=' "$ENV_GEN" | cut -d= -f2-)"
  echo "  Public: ${pub} (if behind NAT, open 80/443 to this host)"
fi
echo ""
echo "  Logs:   docker compose --env-file deploy/.env.runtime.merged -f docker-compose.prod.yml logs -f"
