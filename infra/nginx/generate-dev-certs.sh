#!/usr/bin/env bash
# Self-signed certs for local HTTPS (camera / geolocation need a secure context).
# Usage:
#   ./generate-dev-certs.sh
#   LAN_IP=192.168.1.42 ./generate-dev-certs.sh   # add your phone-reachable LAN IP to SAN
# Use the real IPv4 of this machine on Wi‑Fi/LAN (e.g. 172.20.10.2) — not placeholders like 192.168.x.x

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="${ROOT}/ssl"
mkdir -p "${SSL_DIR}"

KEY="${SSL_DIR}/dev.key"
CRT="${SSL_DIR}/dev.crt"
LAN_IP="${LAN_IP:-}"

if [[ -n "${LAN_IP}" ]]; then
  if ! [[ "${LAN_IP}" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
    echo "LAN_IP must be a real IPv4 address (four numbers), e.g. 172.20.10.2"
    echo "You passed: ${LAN_IP}"
    echo "Tip: on macOS run \`ipconfig getifaddr en0\` (or check System Settings → Wi‑Fi → Details)."
    exit 1
  fi
fi

if command -v openssl &>/dev/null; then
  TMPCFG="$(mktemp)"
  {
    echo "[req]"
    echo "default_bits       = 2048"
    echo "distinguished_name = req_distinguished_name"
    echo "x509_extensions    = v3_req"
    echo "prompt             = no"
    echo "[req_distinguished_name]"
    echo "CN = stream-music-dev"
    echo "[v3_req]"
    echo "basicConstraints = CA:FALSE"
    # Chrome requires digitalSignature + keyEncipherment for TLS server; omit dataEncipherment (fixes ERR_SSL_KEY_USAGE_INCOMPATIBLE).
    echo "keyUsage = digitalSignature, keyEncipherment"
    echo "extendedKeyUsage = serverAuth"
    echo "subjectAltName = @alt_names"
    echo "[alt_names]"
    echo "DNS.1 = localhost"
    echo "IP.1 = 127.0.0.1"
    i=2
    if [[ -n "${LAN_IP}" ]]; then
      echo "IP.${i} = ${LAN_IP}"
    fi
  } >"${TMPCFG}"

  openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout "${KEY}" -out "${CRT}" \
    -config "${TMPCFG}" -extensions v3_req

  rm -f "${TMPCFG}"
else
  echo "openssl not found. Install OpenSSL or place dev.key + dev.crt into ${SSL_DIR} yourself."
  exit 1
fi

echo "Wrote ${CRT} and ${KEY}"
echo "Restart nginx so TLS loads:  docker compose restart nginx"
echo "Then open https://<your-LAN-IP>:8443 — trust the self-signed cert once."
echo "Set Django CORS_EXTRA_ORIGINS=https://<your-LAN-IP>:8443"
