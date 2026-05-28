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
- Leave profile, playlist share, premium in `common` for a future `accounts` split.

## Consequences

- Clearer boundaries aligned with frontend `features/discovery`.
- `common/discovery_views.py` re-exports moved views for compatibility.
- Next step: move public profile + premium to `accounts` app.

## References

- [project-structure.md](../project-structure.md)
- [001-project-structure-and-domain-split.md](./001-project-structure-and-domain-split.md)
