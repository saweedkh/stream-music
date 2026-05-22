#!/usr/bin/env bash
# Renders production nginx config (HTTPS from host Certbot paths, HTTP :8080 for LAN).
# Args: PRIMARY_IP SITE_DOMAIN TLS_CERT_NAME [TLS_CERT_DIR]

set -euo pipefail

PRIMARY_IP="${1:?primary ip}"
SITE_DOMAIN="${2:-}"
TLS_CERT_NAME="${3:-}"
TLS_CERT_DIR="${4:-/etc/letsencrypt/live}"

PROXY_COMMON=$(
  cat <<'NGX'
    client_max_body_size 200M;

    location /audio/ {
        alias /media/;
        autoindex on;
        add_header Cache-Control "public, max-age=604800";
    }

    location /api/ {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 60s;
        proxy_buffering off;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://frontend:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
NGX
)

# Plain HTTP on :8080 (LAN / fallback — same paths as dev nginx :8080).
cat <<EOF
server {
    listen 8080;
    server_name ${PRIMARY_IP} _;
${PROXY_COMMON}
}
EOF

if [[ -n "$TLS_CERT_NAME" ]]; then
  CERT="${TLS_CERT_DIR}/${TLS_CERT_NAME}/fullchain.pem"
  KEY="${TLS_CERT_DIR}/${TLS_CERT_NAME}/privkey.pem"

  if [[ -n "$SITE_DOMAIN" ]]; then
    SERVER_NAMES="${SITE_DOMAIN} ${PRIMARY_IP}"
    HTTP_NAMES="${SITE_DOMAIN} ${PRIMARY_IP}"
  else
    SERVER_NAMES="${PRIMARY_IP} _"
    HTTP_NAMES="${PRIMARY_IP} _"
  fi

  cat <<EOF

server {
    listen 80;
    server_name ${HTTP_NAMES};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${SERVER_NAMES};

    ssl_certificate     ${CERT};
    ssl_certificate_key ${KEY};
    ssl_protocols       TLSv1.2 TLSv1.3;

${PROXY_COMMON}
}
EOF
fi
