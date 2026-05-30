# ADR-002: Extract discovery and social Django apps

## Status

Accepted

## Date

2026-05-28

## Context

`apps/common` contained explore, global search, and follow endpoints mixed with profiles, admin, and support.

## Decision

- Add `apps.discovery` with `selectors/`, `services/`, `api/` for explore feed, global search, track facets.
- Add `apps.social` with follow user/channel and following channels feed.
- Register apps in `INSTALLED_APPS`; mount URLs via `include()` in `apps/common/urls.py`.
- Keep ORM models in `common.social_models` until a dedicated migration pass.
- Move public profile + premium to `apps.accounts`; playlist share to `apps.playlists.share`; room tools to `apps.channels.room`.
- Extract `core`, `support`, `moderation`, `admin_panel`, `dashboard` with domain `urls/` packages and `common/urls.py` includes.

## Consequences

- Clearer boundaries aligned with frontend `features/discovery`.
- `common/*_views.py` modules re-export moved views for backward compatibility.
- Channel CRUD/queue/auth remain in `common/views.py` until a dedicated channels API split.

## References

- [project-structure.md](../project-structure.md)
- [001-project-structure-and-domain-split.md](./001-project-structure-and-domain-split.md)
