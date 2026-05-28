#!/bin/sh
set -e
rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
exec /docker-entrypoint.sh nginx -g "daemon off;"
