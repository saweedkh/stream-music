#!/usr/bin/env bash
# Generate VAPID keys and write them into apps/api/.env.example + apps/web/.env.example
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

read -r PUBLIC_KEY PRIVATE_KEY < <(node -e "
const crypto = require('crypto');
function urlBase64(buf) {
  return buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
const ecdh = crypto.createECDH('prime256v1');
ecdh.generateKeys();
process.stdout.write(urlBase64(ecdh.getPublicKey()) + ' ' + urlBase64(ecdh.getPrivateKey()));
")

BACKEND_ENV="${ROOT}/apps/api/.env.example"
FRONTEND_ENV="${ROOT}/apps/web/.env.example"

patch_env() {
  local file="$1"
  local key="$2"
  local val="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    if [[ "$(uname)" == Darwin ]]; then
      sed -i '' "s|^${key}=.*|${key}=${val}|" "$file"
    else
      sed -i "s|^${key}=.*|${key}=${val}|" "$file"
    fi
  else
    echo "${key}=${val}" >> "$file"
  fi
}

patch_env "$BACKEND_ENV" "WEBPUSH_VAPID_PUBLIC_KEY" "$PUBLIC_KEY"
patch_env "$BACKEND_ENV" "WEBPUSH_VAPID_PRIVATE_KEY" "$PRIVATE_KEY"

if [[ ! -f "$FRONTEND_ENV" ]]; then
  echo "# Next.js — copy to .env.local for local npm dev" > "$FRONTEND_ENV"
fi
patch_env "$FRONTEND_ENV" "NEXT_PUBLIC_WEBPUSH_VAPID_PUBLIC_KEY" "$PUBLIC_KEY"

echo "VAPID keys updated:"
echo "  $BACKEND_ENV"
echo "  $FRONTEND_ENV"
echo "Public:  $PUBLIC_KEY"
