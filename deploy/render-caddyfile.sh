#!/usr/bin/env bash
# Renders Caddy config: Let's Encrypt when SITE_DOMAIN is set; tls internal for IP-only.
# Plain HTTP on PRIMARY_IP:8080 is always emitted so LAN clients work even when TLS handshakes fail (proxies / local tooling).

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

# Shared handlers (HTTPS site + HTTP :8080 + optional HTTP hostname).
HANDLERS=$(
  cat <<'HAND'
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
HAND
)

cat <<EOF
http://${PRIMARY_IP}:8080 {
${HANDLERS}
}

${BLOCK_HOST} {
	${TLS_DIRECTIVE}

${HANDLERS}
}
EOF

if [[ -n "$SITE_DOMAIN" ]]; then
  cat <<EOF

http://${SITE_DOMAIN}:8080 {
${HANDLERS}
}
EOF
fi
