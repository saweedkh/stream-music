# Multi-region / CDN for audio files

When moving from LAN-only to a central server:

1. Serve `MEDIA_ROOT` tracks via nginx `location /media/` with long `Cache-Control` and optional CDN origin (Cloudflare, S3+CloudFront).
2. Set `CSRF_TRUSTED_ORIGINS` and `FRONTEND_BASE_URL` per region or single global domain.
3. Keep WebSocket on the same hostname as the API (or use a dedicated `wss://` subdomain with sticky sessions).
4. Redis and PostgreSQL stay single-primary; read replicas are optional for analytics only.

Audio files are large — CDN caching reduces origin load; invalidate on track delete/replace.
