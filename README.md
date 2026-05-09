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

1. Copy backend env:
   - `cp backend-django/.env.example backend-django/.env`
2. Start stack:
   - `docker compose up --build`
3. Apply migrations:
   - `docker compose exec backend python manage.py migrate`
   - if tables already exist from prior sync mode: `docker compose exec backend python manage.py migrate --fake-initial`

## Production (central server, Docker + TLS)

Full guide (Persian): **[docs/production-deployment.md](docs/production-deployment.md)**.

Quick start:

```bash
cp deploy/env.production.example .env.production
# edit SECRET_KEY and POSTGRES_PASSWORD
./deploy/up.sh
# or: SITE_DOMAIN=music.example.com ./deploy/up.sh
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
- `WS /ws/channels/{id}`

## Control + Sync Contract

- UI control actions go to `POST /api/channels/{id}/control`.
- Backend now updates playback state and emits a matching WS event to `channel_{id}`.
- WS payload contract includes:
  - `type` (`PLAY`, `PAUSE`, `SEEK`, `NEXT`, `PREV`)
  - `action` (lowercase version)
  - `server_time`, `started_at_server_time`, `position`, `is_playing`, `queue_version`
- Player clients consume this single contract for realtime updates and drift correction feedback.
