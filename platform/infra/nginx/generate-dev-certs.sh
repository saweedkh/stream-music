#!/usr/bin/env bash
# Local HTTPS: small dev CA + server cert (phones must trust the CA for Service Worker / push).
# Usage:
#   ./generate-dev-certs.sh
#   LAN_IP=172.20.10.2 ./generate-dev-certs.sh
# Phone: http://<LAN-IP>:8080/dev-ssl.crt  → install CA → enable trust → https://<LAN-IP>:8443

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="${ROOT}/ssl"
mkdir -p "${SSL_DIR}"

CA_KEY="${SSL_DIR}/dev-ca.key"
CA_CRT="${SSL_DIR}/dev-ca.crt"
KEY="${SSL_DIR}/dev.key"
CRT="${SSL_DIR}/dev.crt"
CSR="${SSL_DIR}/dev.csr"
LAN_IP="${LAN_IP:-}"

if [[ -n "${LAN_IP}" ]]; then
  if ! [[ "${LAN_IP}" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
    echo "LAN_IP must be a real IPv4 address (four numbers), e.g. 172.20.10.2"
    echo "You passed: ${LAN_IP}"
    echo "Tip: on macOS run \`ipconfig getifaddr en0\` (or check System Settings → Wi‑Fi → Details)."
    exit 1
  fi
fi

if ! command -v openssl &>/dev/null; then
  echo "openssl not found. Install OpenSSL or place dev.key + dev.crt into ${SSL_DIR} yourself."
  exit 1
fi

# --- Dev root CA (install this on phones) ---
openssl genrsa -out "${CA_KEY}" 2048
CA_CFG="$(mktemp)"
{
  echo "[req]"
  echo "distinguished_name = dn"
  echo "x509_extensions = v3_ca"
  echo "prompt = no"
  echo "[dn]"
  echo "CN = Stream Music Dev CA"
  echo "[v3_ca]"
  echo "basicConstraints = critical,CA:TRUE"
  echo "keyUsage = critical,keyCertSign,cRLSign"
  echo "subjectKeyIdentifier = hash"
  echo "authorityKeyIdentifier = keyid:always,issuer"
} >"${CA_CFG}"

openssl req -x509 -new -nodes -key "${CA_KEY}" -sha256 -days 825 \
  -out "${CA_CRT}" -config "${CA_CFG}" -extensions v3_ca
rm -f "${CA_CFG}"

# --- Server leaf cert (nginx TLS) ---
openssl genrsa -out "${KEY}" 2048
SRV_CFG="$(mktemp)"
{
  echo "[req]"
  echo "default_bits = 2048"
  echo "distinguished_name = dn"
  echo "req_extensions = v3_req"
  echo "prompt = no"
  echo "[dn]"
  echo "CN = stream-music-dev"
  echo "[v3_req]"
  echo "basicConstraints = CA:FALSE"
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
} >"${SRV_CFG}"

openssl req -new -key "${KEY}" -out "${CSR}" -config "${SRV_CFG}"
openssl x509 -req -in "${CSR}" -CA "${CA_CRT}" -CAkey "${CA_KEY}" -CAcreateserial \
  -out "${CRT}" -days 825 -sha256 -extensions v3_req -extfile "${SRV_CFG}"
rm -f "${SRV_CFG}" "${CSR}" "${SSL_DIR}/dev-ca.srl" 2>/dev/null || true

echo "Wrote:"
echo "  ${CA_CRT}  (install on phone — http://<LAN-IP>:8080/dev-ssl.crt)"
echo "  ${CRT} + ${KEY}  (nginx TLS)"
echo "Restart nginx:  docker compose restart nginx"
echo "Then https://<your-LAN-IP>:8443 and set CORS_EXTRA_ORIGINS=https://<your-LAN-IP>:8443"
