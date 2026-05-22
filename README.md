# Stream Music (LAN Sync)

Advanced LAN synchronized group music playback with:

- Next.js frontend (`frontend-next`)
- Django + Channels backend (`backend-django`)
- Redis pub/sub and PostgreSQL
- Nginx static audio serving

## Import audio from disk (CLI)

Bulk-register files from a folder on the server into `MEDIA_ROOT` as tracks (default: **`public_lan`** for all users). See **[docs/import-audio-cli.md](docs/import-audio-cli.md)**.

Quick example:

```bash
docker compose exec backend python manage.py import_audio /path/inside/container/to/music --owner yourusername
```

## Run

1. Copy env files (includes **Web Push VAPID** keys for dev):
   - `cp backend-django/.env.example backend-django/.env`
   - `cp frontend-next/.env.example frontend-next/.env.local` *(optional for local `npm run dev`; Docker reads `.env.example` automatically)*
2. Start stack:
   - `docker compose up --build`
3. Apply migrations:
   - `docker compose exec backend python manage.py migrate`
   - if tables already exist from prior sync mode: `docker compose exec backend python manage.py migrate --fake-initial`
4. Open **http://localhost:8080** (nginx), log in, go to **Dashboard → Notifications → Enable push on this device**.

### Web Push (free, built-in)

Uses **Web Push + VAPID** (no Firebase/OneSignal required). Keys are pre-filled in `backend-django/.env.example`.

| Variable | Where |
|----------|--------|
| `WEBPUSH_VAPID_PUBLIC_KEY` / `WEBPUSH_VAPID_PRIVATE_KEY` | Django (`backend-django/.env` or `.env.example`) |
| `NEXT_PUBLIC_WEBPUSH_VAPID_PUBLIC_KEY` | Next (`frontend-next/.env.local` or `.env.example`) |
| `FRONTEND_BASE_URL` | Django — base URL for notification click links (`http://localhost:8080` in Docker) |

Rotate keys: `bash scripts/generate-vapid-keys.sh` then restart backend + frontend.

Production: set the same variables in `.env.production` (see `deploy/env.production.example`); `deploy/up.sh` sets `FRONTEND_BASE_URL` from your host/IP.

## Production (central server, Docker + TLS)

Full guide (Persian): **[docs/production-deployment.md](docs/production-deployment.md)**.

Quick start:

```bash
cp deploy/env.production.example .env.production
# edit SECRET_KEY and POSTGRES_PASSWORD
./deploy/up.sh
# edit SITE_DOMAIN + TLS_CERT_NAME in .env.production, then ./deploy/up.sh
```

## Mirrors

- Python packages are installed via `https://pypi.devneeds.ir/simple/`.
- Frontend npm packages are installed via `https://npm.devneeds.ir/`.
- Docker images should use a daemon registry mirror (do not prefix image names in `docker-compose.yml` or `Dockerfile`).
  - Mirror: `https://docker.devneeds.ir`
  - Docker Desktop: Settings -> Docker Engine -> add:
    - `"registry-mirrors": ["https://docker.devneeds.ir"]`

## Key Endpoints

- `GET /api/time`
- `GET /api/auth/csrf`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/channels/{id}/state`
- `POST /api/channels/{id}/control`
- `POST /api/channels/{id}/join`
- `POST /api/channels/{id}/invite`
- `GET /api/channels/{id}/invite`
- `POST /api/channels/{id}/invite/rotate`
- `POST /api/channels/{id}/public-link/rotate`
- `PATCH /api/channels/{id}/settings`
- `GET /api/channels/{id}/members`
- `PATCH /api/channels/{id}/members/{memberId}`
- `DELETE /api/channels/{id}/members/{memberId}`
- `GET/POST /api/playlist-items/`
- `POST /api/channels/{channelId}/playlists/{playlistId}/play`
- `GET /api/auth/users`
- `GET/POST/DELETE /api/tracks/{trackId}/share-permissions`
- `PATCH /api/playlist-items/{id}` (reorder by `position`)
- `WS /ws/channels/{id}` (playback + control)
- `WS /ws/channels/{id}/chat` (text chat: `send`, `edit`, `delete`, `react`, `history`, staff-only `purge_all`; client fullscreen is UI-only)

## Control + Sync Contract

- UI control actions go to `POST /api/channels/{id}/control`.
- Backend now updates playback state and emits a matching WS event to `channel_{id}`.
- WS payload contract includes:
  - `type` (`PLAY`, `PAUSE`, `SEEK`, `NEXT`, `PREV`)
  - `action` (lowercase version)
  - `server_time`, `started_at_server_time`, `position`, `is_playing`, `queue_version`
- Player clients consume this single contract for realtime updates and drift correction feedback.
