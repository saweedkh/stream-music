#!/usr/bin/env bash
# Renders Caddy config: Let's Encrypt when SITE_DOMAIN is set; tls internal for IP-only.
# Args: PRIMARY_IP [SITE_DOMAIN]

set -euo pipefail

PRIMARY_IP="${1:?primary ip}"
SITE_DOMAIN="${2:-}"

if [[ -n "$SITE_DOMAIN" ]]; then
  BLOCK_HOST="$SITE_DOMAIN"
  TLS_DIRECTIVE="# Automatic HTTPS (Let's Encrypt) — ports 80/443 must reach this host."
else
  BLOCK_HOST="$PRIMARY_IP"
  TLS_DIRECTIVE=$'tls internal\n\t# Self-signed for IP / quick prod; browsers will warn unless you trust the cert.'
fi

cat <<EOF
${BLOCK_HOST} {
	${TLS_DIRECTIVE}

	encode gzip zstd

	handle_path /audio/* {
		root * /srv/media
		file_server
	}

	handle /api/* {
		reverse_proxy backend:8000
	}

	handle /ws/* {
		reverse_proxy backend:8000 {
			flush_interval -1
		}
	}

	handle {
		reverse_proxy frontend:3000
	}
}
EOF
