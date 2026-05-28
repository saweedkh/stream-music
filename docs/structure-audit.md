# Structure audit (2026-05-28)

Audit after completing the target layout in `docs/project-structure.md`.

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Repo layout (`apps/api`, `apps/web`, `platform/`) | OK | Legacy `backend-django` / `frontend-next` removed |
| Backend domain apps | OK | `core`, `accounts`, `discovery`, `social`, `support`, `channels`, … |
| `common` app | Shim hub | URLs router + badge ORM registration + backward-compat re-exports |
| Channel API | OK | Split under `channels/api/views/` + `channels/services/` |
| Frontend `shared/` + `features/` | OK | `src/components/` empty (README only) |
| OpenAPI codegen | Deferred | [ADR-003](./adr/003-openapi-types-deferred.md); `make openapi-export` for snapshot |

## Backend — canonical locations

| Concern | Canonical module | `common` shim (compat) |
|---------|------------------|-------------------------|
| Auth / health / metrics / OpenAPI | `apps.core.api.*` | `health.py`, `metrics.py`, `openapi_schema.py` |
| Web Push | `apps.core.services.webpush` | `webpush_service.py` |
| Badges / premium | `apps.accounts.badge_models`, `user_badges`, `premium_limits` | `account_badges.py`, `user_badges.py`, `premium_limits.py` |
| Favorites ORM | `apps.accounts.models` | `favorites.py` |
| Social ORM | `apps.social.models` | `social_models.py` (+ `PlaylistShareLink` via `playlists.models`) |
| Support tickets | `apps.support.services.ticket_service` | `support_service.py` |
| Support WS | `apps.support.consumers` | `support_consumer.py` |
| Party recap | `apps.channels.services.party_recap` | `party_recap.py` |
| Channel views | `apps.channels.api.views` | `channel_views.py`, `common/views.py` |
| Serializers | `*/api/serializers.py` | `common/serializers.py` (re-export) |
| Admin API | `apps.admin_panel.api.views` | `common/admin_views.py` |
| Discovery / dashboard / moderation | `apps.<domain>.api.views` | `discovery_views.py`, … |

## Remaining direct `apps.common.*` imports (~20)

Most are **`common.serializers`** and **`common.admin_views`** in view layers. These are valid during transition (shims re-export domain code). Prefer domain imports in new code:

```python
# Prefer
from apps.channels.api.serializers import ChannelSerializer
# Avoid in new code
from apps.common.serializers import ChannelSerializer
```

## Dead / redundant code

| Item | Verdict |
|------|---------|
| `common/urls.py` | **Keep** — API mount aggregator |
| `common/models.py` | **Keep** — registers badge tables under `common` app label (migrations) |
| `common/*_views.py` one-liner shims | **Keep** until all imports updated; safe to remove later |
| `common/views.py` | **Keep** — test/backward re-exports |
| `channel_views.py` (3 lines) | **Keep** — backward compat |
| Duplicate view classes that were in `helpers.py` | **Removed** (were copy-paste bugs) |
| `src/components/` (web) | **Empty by design** — aliases point to `shared/` |
| `backups/` (git untracked) | **Not code** — exclude from repo or add to `.gitignore` |

## Bugs fixed in this pass

- `_ALLOWED_EXPERIENCE_KEYS` used in `room.py` but not imported → import from `helpers`
- `_parse_external_source` wrong name → `parse_external_source` from `room_tools`
- `helpers.py` contained duplicate join **view classes** and duplicate import blocks
- `auth_views.py` carried ~90 lines of unused imports from old monolith
- `PlaylistShareLink` incorrectly imported from `social.models` after bulk sed

## Recommended follow-ups (optional)

1. Replace remaining `common.serializers` imports with domain serializers (mechanical PR).
2. Move badge ORM from `common` app label to `accounts` (state-only migration).
3. Extract `channels/services/room_settings.py` from `ChannelSettingsView`.
4. Run `python manage.py migrate` on staging/production after deploy.

## Verification commands

```bash
cd apps/api && .venv/bin/python manage.py check
cd apps/web && npm run build
grep -r 'apps\.common' apps/api --include='*.py' | wc -l   # expect ~20 (mostly serializers shims)
```
