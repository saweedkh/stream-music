#!/bin/sh
set -e
# Replace baked-in default so only our blocks apply.
rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
cp /templates/01-http.conf /etc/nginx/conf.d/01-http.conf
if [ -r /etc/nginx/ssl/dev.crt ] && [ -r /etc/nginx/ssl/dev.key ]; then
  cp /templates/02-https.conf /etc/nginx/conf.d/02-https.conf
  echo "[nginx] HTTPS enabled — https://<this-machine-ip>:8443"
else
  echo "[nginx] TLS missing: put dev.crt + dev.key in infra/nginx/ssl (run generate-dev-certs.sh). HTTPS :8443 disabled until then."
fi
exec /docker-entrypoint.sh nginx -g "daemon off;"
