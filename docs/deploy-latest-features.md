# Deploy latest features

After pulling changes that include social, moderation, party heatmap, and E2E updates:

```bash
# Production stack
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend python manage.py migrate --noinput
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build backend frontend
```

Verify:

- `GET /api/metrics` includes `webpush.ready` and `pywebpush_installed`
- `GET /api/me/channels-online` (authenticated) lists rooms with live listeners
- `GET /api/channels/{id}/party-recap` includes `excitement_heatmap`

Ensure `pywebpush` is in the backend image (`requirements.txt`) and VAPID keys are set in production env.
