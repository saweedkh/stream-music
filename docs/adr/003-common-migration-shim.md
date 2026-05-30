# ADR 003: Keep `apps.common` as migration-only shim

## Status

Accepted (2026-05-28)

## Context

Early project history stored several domains under `apps.common`. Migrations `0001`–`0007` transferred ORM state to `accounts`, `support`, `social`, `playlists`, and `channels`. Other apps still declare dependencies on `("common", "0005_user_follow")` etc.

## Decision

- Keep `apps.common.apps.CommonConfig` in `INSTALLED_APPS`.
- Do not add models, views, or services under `common/`.
- Celery tasks live in `apps.core.tasks`; URL aggregation in `config.api_urls`.

## Consequences

- Fresh installs run `common` migrations before domain apps (unchanged).
- Removing the app from `INSTALLED_APPS` is deferred until a dedicated migration-squash project rewrites dependency edges.

## Alternatives considered

- **Remove from INSTALLED_APPS now** — breaks `manage.py migrate` on empty DB without rewriting ~10 migration files.
- **Rename app label** — would desync `django_migrations` rows on existing databases.
