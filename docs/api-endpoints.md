# REST API

Base path: `/api/` (aggregated in `apps/api/config/api_urls.py`).

Trailing slashes: many routes work with or without; the Next.js client follows existing path conventions per module in `lib/api/`.

## Quick reference

| Area | Base paths |
|------|------------|
| System | `/api/health`, `/api/metrics`, `/api/time`, `/api/schema` |
| Auth | `/api/auth/csrf`, `register`, `login`, `logout`, `me`, … |
| Channels | `/api/channels/`, `/api/channels/{id}/…` |
| Tracks | `/api/tracks/`, upload under `/api/tracks/upload/…` |
| Playlists | `/api/playlists/`, `/api/playlist-items/` |
| Discovery | `/api/explore`, `/api/search/global` |
| Social | `/api/users/{username}/follow`, `/api/channels/{id}/follow` |
| Dashboard | `/api/me/channels-online`, … |
| Support | `/api/support/tickets`, … |
| Admin | `/api/admin/…` |

## Auth

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/health` | Liveness (`db`, `redis`) |
| GET/PATCH | `/api/auth/me/` | Current user |
| POST | `/api/auth/password/` | Change password |
| POST | `/api/auth/register` | CSRF required |
| POST | `/api/auth/login` | Session cookie |

## Tracks

| Method | Path | Notes |
|--------|------|--------|
| GET, POST | `/api/tracks/` | List; create (multipart) |
| GET, PATCH, DELETE | `/api/tracks/{id}/` | Detail |
| POST, DELETE | `/api/tracks/{id}/favorite/` | Favorite toggle |
| POST | `/api/tracks/upload/init` | Chunked upload start |
| GET | `/api/tracks/upload/{id}/status` | Resume status |
| PUT | `/api/tracks/upload/{id}/chunk` | Chunk body |
| POST | `/api/tracks/upload/{id}/finalize` | Finish upload |

## Playlists

| Method | Path | Notes |
|--------|------|--------|
| GET, POST | `/api/playlists/` | |
| GET, PATCH, DELETE | `/api/playlists/{id}/` | |
| POST, DELETE | `/api/playlists/{id}/favorite/` | |
| POST | `/api/playlists/{id}/add-tracks/` | Body: `{ "track_ids": [1,2] }` |
| GET, POST | `/api/playlist-items/` | |
| GET, PATCH, DELETE | `/api/playlist-items/{id}/` | |

Channel actions (copy, assign, queue, import-share) live under `/api/channels/{id}/…` — mirror tree in `apps/channels/urls/`.

## Channels (selection)

| Method | Path | Notes |
|--------|------|--------|
| GET, POST | `/api/channels/` | |
| GET, PATCH, DELETE | `/api/channels/{id}/` | |
| POST | `/api/channels/{id}/join` | |
| POST | `/api/channels/{id}/leave` | 204 |
| GET | `/api/channels/{id}/queue` | Queue snapshot |
| POST | `/api/channels/{id}/control` | Playback control |
| POST | `/api/join/public/{slug}/` | Public join |

Full layout: one folder per URL segment under `apps/channels/` (e.g. `channel_id/queue/item_id/upvote/`).

## OpenAPI snapshot

```bash
make openapi-export
# → apps/web/src/lib/api/openapi.snapshot.json
# → apps/web/src/lib/api/types/schema-paths.ts
```

Live schema: `GET /api/schema` or `GET /api/schema/openapi.json`.

CI verifies the snapshot matches `apps/core/schema/schema_api.py` ([ADR-004](./adr/004-api-contract-snapshot.md)).

## WebSocket

Room events: `ws/channel/{id}/` — see [realtime-contracts.md](./realtime-contracts.md).

## Deploy & ops

| Topic | Doc |
|--------|-----|
| Production | [production-deployment.md](./production-deployment.md) |
| Deploy scripts | [platform/deploy/README.md](../platform/deploy/README.md) |
| Backups | `.github/workflows/backup.yml` → `platform/scripts/backup.sh` |

`apps.common` stays in Django only for migrations ([ADR-003](./adr/003-common-migration-shim.md)).
