#!/usr/bin/env bash
# Writes deploy/.env.generated — sourced by Docker Compose after deploy/up.sh.
# Args: PRIMARY_IP [SITE_DOMAIN]

set -euo pipefail

PRIMARY_IP="${1:?primary ip}"
SITE_DOMAIN="${2:-}"

ORIGINS="http://${PRIMARY_IP},https://${PRIMARY_IP}"
ALLOWED="${PRIMARY_IP},127.0.0.1,localhost,backend,caddy"

if [[ -n "$SITE_DOMAIN" ]]; then
  PUBLIC_HOST="$SITE_DOMAIN"
  ORIGINS="${ORIGINS},https://${SITE_DOMAIN},http://${SITE_DOMAIN}"
  ALLOWED="${ALLOWED},${SITE_DOMAIN}"
else
  PUBLIC_HOST="$PRIMARY_IP"
fi

PUBLIC_IPV4=""
if command -v curl >/dev/null 2>&1; then
  PUBLIC_IPV4="$(curl -fsS --max-time 3 https://ifconfig.me/ip 2>/dev/null || true)"
fi

{
  echo "PRIMARY_IP=${PRIMARY_IP}"
  echo "PUBLIC_HOST=${PUBLIC_HOST}"
  echo "DETECTED_PUBLIC_IPV4=${PUBLIC_IPV4}"
  echo "ALLOWED_HOSTS=${ALLOWED}"
  echo "CORS_EXTRA_ORIGINS=${ORIGINS}"
  # LAN regex keeps phones / mixed networks workable when using raw IPs.
  echo "TRUST_LAN_CSRF=1"
}
