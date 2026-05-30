# Structure audit (2026-05-28)

Audit after URL-mirror API layout and removal of `apps/<domain>/api/` packages.

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Repo layout (`apps/api`, `apps/web`, `platform/`) | OK | Legacy `backend-django` / `frontend-next` removed |
| Backend domain apps | OK | `core`, `accounts`, `discovery`, `social`, `support`, `channels`, … |
| HTTP layout | OK | URL segments → folders; `*_api.py` + `*_serializers.py`; `urls/` per app |
| `common` app | Minimal | `urls.py` aggregator + migrations + `tasks` + tests — **no `api/` package** |
| Channel API | OK | `channel/`, `join/`, `playback/`, `queue/`, `room/` + `serializers/` + `services/` |
| Playlists API | OK | `playlists/`, `playlist_items/`, `share/` + selectors |
| Frontend `shared/` + `features/` | OK | `src/components/` empty (README only) |
| OpenAPI codegen | Deferred | [ADR-003](./adr/003-openapi-types-deferred.md); `make openapi-export` for snapshot |

## Backend — canonical locations

| Concern | Canonical module |
|---------|------------------|
| Auth / health / metrics / OpenAPI | `apps.core.auth.*`, `apps.core.health.health_api`, … |
| Web Push | `apps.core.services.webpush` |
| Badges / premium | `apps.accounts.models`, `user_badges`, `premium_limits` |
| Favorites ORM | `apps.accounts.models` |
| Favorites queries | `apps.accounts.selectors` |
| Social ORM | `apps.social.models` |
| Support tickets | `apps.support.services.ticket_service` |
| Support WS | `apps.support.consumers` |
| Party recap | `apps.channels.services.party_recap` |
| Channel permissions | `apps.channels.permissions` |
| Playlist visibility | `apps.playlists.selectors` |
| Channel HTTP | `apps.channels.<url_mirror>.*_api` (see `channels/urls/__init__.py`) |
| Shared channel JSON | `apps.channels.serializers.channel_serializers` |
| Playback session JSON | `apps.playback.serializers.playback_serializers` |
| Admin API | `apps.admin_panel.admin.admin_api` |
| Discovery / dashboard / moderation | `apps.<domain>.<path>.*_api` |

## URL router

`apps/common/urls.py` includes `apps.<domain>.urls` (package `urls/__init__.py`), not `apps.<domain>.api.urls`.

## `apps.common` imports in application code

**0** — no `apps.common.*` view/serializer/service imports. Use domain modules only.

## Selectors / services layout (API)

| App | `selectors.py` | `services/` |
|-----|----------------|-------------|
| `accounts` | favorites, profile stats | `public_profile.py` |
| `tracks` | list/filter queryset | `share_permissions.py` |
| `playlists` | visibility, list qs | `playlist_mutations.py` |
| `channels` | membership queries | `channel_queue`, `playback_control`, `party_recap` |
| `discovery` | explore/search | `explore_feed`, `global_search` |
| `dashboard` | channel ids, pending counts | `me_channels.py` |
| `social` | follow helpers | `following_feed.py` |
| `support` | — | `ticket_service.py` |
| `playback` | — | queue/state/sync |
| `core` | — | `webpush` |

Views in `*_api.py` should call selectors (reads) and services (writes).

## Channels — leaf endpoints (`channel_id/`)

Dynamic URL segment `<channel_id>` → پوشه `channel_id/` (نه نام پارامتر Django). مثال‌ها:

| URL | Module |
|-----|--------|
| `channels/join-from-link` | `join_from_link/join_from_link_api.py` |
| `channels/<id>/join` | `channel_id/join/join_api.py` |
| `channels/<id>/join-requests/<id>/approve` | `channel_id/join_requests/request_id/approve/approve_api.py` |
| `channels/<id>/queue/<item_id>/upvote` | `channel_id/queue/item_id/upvote/upvote_api.py` |
| `channels/<id>/control` | `channel_id/control/control_api.py` |

## `common` app contents

```
common/
  urls.py          # API router (include domain urls)
  apps.py
  tasks.py
  migrations/
  tests/
  management/
  README.md
```

## Quality gate status (2026-05-28)

| Check | Status |
|-------|--------|
| `manage.py check` | OK |
| `ruff check` + `ruff format --check` | OK |
| `manage.py test apps` | OK (54 tests; local Postgres `localhost:5431`, creds from `apps/api/.env`) |
| `npm run lint` | OK (هشدارهای `no-restricted-imports` باقی در feature→feature) |
| `npm test` (Vitest) | OK برای `explore-utils`; یک تست قدیمی `api-utils` به env وابسته است |
| `tsc --noEmit` | OK |
| `make check-quality` | pre-commit + Makefile |

## Completed follow-ups

1. ~~Split channel `helpers.py`~~ → `apps/channels/services/channel_{join,room,audit,playback_events,queue_broadcast,ws_broadcast}.py` + shim در `helpers.py`.
2. ~~Relocate `common/tests/`~~ → `core/tests/`, `support/tests/`, `playlists/tests/`.
3. ~~`config/api_urls.py`~~ + shim `apps/common/urls.py`.
4. API tests: `tracks/tests/`, `playlists/tests/test_playlist_api.py`, channel tests موجود.
5. Frontend: `features/dashboard/index.ts` barrel؛ layoutهای shared از `@/features/dashboard` و `@/features/player`.
6. `docs/api-endpoints.md` — جدول مسیرهای اصلی.

## Recommended follow-ups (optional)

1. حذف `common` از `INSTALLED_APPS` و انتقال badges به `accounts` (تغییر بزرگ).
2. `make openapi-export` در CI وقتی API بالا است؛ تایپ‌های `lib/api/types`.
3. E2E کامل با `docker compose up` + `npm run test:e2e:all`.
4. PR/commit — فقط با درخواست صریح.

## Verification commands

```bash
make ensure-env
cd apps/api && POSTGRES_HOST=localhost POSTGRES_PORT=5431 \
  POSTGRES_USER=stream_music POSTGRES_PASSWORD=stream_music POSTGRES_DB=stream_music \
  .venv/bin/python manage.py test apps
cd apps/web && npm run lint && npm test
make check-quality
find apps/api/apps -type d -name api | wc -l   # expect 0
```
