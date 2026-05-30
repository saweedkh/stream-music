# `apps.common` (migration shim)

This Django app has **no runtime models or views**. It remains in `INSTALLED_APPS` only so Django can apply the historical migration chain (`0001`–`0007`) that moved favorites, badges, support, and social tables into domain apps.

Do not add new code here. Use `apps.core`, `apps.accounts`, `apps.support`, etc.

Removing `apps.common` from `INSTALLED_APPS` requires squashing or rewiring migration dependencies across `accounts`, `support`, `social`, and `playlists` — see `docs/adr/003-common-migration-shim.md`.
