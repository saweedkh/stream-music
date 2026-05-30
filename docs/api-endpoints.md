# REST API endpoints (overview)

Base path: `/api/` (see `apps/api/config/api_urls.py` for aggregation).

Trailing slashes are required on most routes (DRF + Next.js client).

## Core & auth

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/health/` | Liveness |
| GET/PATCH | `/api/auth/me/` | Current user profile |
| POST | `/api/auth/password/` | Change password |

## Tracks

| Method | Path | Notes |
|--------|------|--------|
| GET, POST | `/api/tracks/` | List (auth); create multipart |
| GET, PATCH, DELETE | `/api/tracks/<id>/` | Owner-scoped detail |
| POST, DELETE | `/api/tracks/<id>/favorite/` | Toggle favorite |
| GET, POST | `/api/tracks/<id>/share-permissions/` | LAN/share rules |

## Playlists

| Method | Path | Notes |
|--------|------|--------|
| GET, POST | `/api/playlists/` | User playlists |
| GET, PATCH, DELETE | `/api/playlists/<id>/` | Detail |
| POST, DELETE | `/api/playlists/<id>/favorite/` | Toggle favorite |
| POST | `/api/playlists/<id>/add-tracks/` | Body: `{ "track_ids": [1,2] }` |
| GET, POST | `/api/playlist-items/` | Global items (legacy) |
| GET, PATCH, DELETE | `/api/playlist-items/<id>/` | Item CRUD |

Channel-scoped playlist actions (copy, assign, queue) live under `/api/channels/<id>/…` — see `apps/channels/urls/`.

## Channels (selection)

| Method | Path | Notes |
|--------|------|--------|
| GET, POST | `/api/channels/` | List/create rooms |
| GET, PATCH, DELETE | `/api/channels/<id>/` | Room detail |
| POST | `/api/channels/<id>/join/` | Join room |
| POST | `/api/channels/<id>/leave/` | Leave (204) |
| GET | `/api/channels/<id>/members/` | Paginated members |
| GET | `/api/channels/<id>/queue/` | Queue snapshot |
| POST | `/api/join/public/<slug>/` | Public join by slug |

Full tree mirrors `apps/channels/**/urls` and `*_api.py` file layout.

## Discovery, social, dashboard, support, admin

- Discovery: `/api/discovery/…` (`apps/discovery/urls/`)
- Social: `/api/social/…` (`apps/social/urls/`)
- Dashboard stats: `/api/dashboard/…`
- Support tickets: `/api/support/…`
- Admin panel: `/api/admin/…` (staff)

## OpenAPI snapshot

With API running on port 8000:

```bash
make openapi-export
# writes apps/web/src/lib/api/openapi.snapshot.json
```

Use for contract checks and future typed client generation (`apps/web/src/lib/api/types/`).

## WebSocket

Room events: `ws/channel/<channel_id>/` — payload contracts in `docs/realtime-contracts.md`.

## Deploy & backup

| Topic | Doc / command |
|--------|----------------|
| Production Docker + TLS | [production-deployment.md](./production-deployment.md) |
| Deploy scripts | `deploy/README.md`, `make dev` / `./deploy/up.sh` |
| DB backup (scheduled) | `.github/workflows/backup.yml` → remote `scripts/backup.sh` |
| OpenAPI snapshot | `make openapi-export` → `apps/web/src/lib/api/openapi.snapshot.json` |

`apps.common` stays in `INSTALLED_APPS` only for the Django migration graph (`0001`–`0007`); runtime code uses `core`, `accounts`, `support`, etc.
