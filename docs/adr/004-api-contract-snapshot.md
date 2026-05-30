# ADR-004: API contract snapshot (OpenAPI)

## Status

Accepted (2026-05-28)

## Context

Clients and CI need a stable, machine-readable summary of REST endpoints. Full codegen to TypeScript was deferred while the API surface was still moving.

## Decision

1. Expose minimal OpenAPI 3 JSON at `GET /api/schema` and `GET /api/schema/openapi.json`.
2. Export offline via `make openapi-export` → `apps/web/src/lib/api/openapi.snapshot.json`.
3. Generate `apps/web/src/lib/api/types/schema-paths.ts` from the snapshot.
4. Keep hand-maintained domain types in `lib/api/types/` for request/response shapes.
5. CI runs `tooling/scripts/check-openapi-snapshot.sh` after backend checks.

## Consequences

- PRs that change `build_openapi_dict()` must refresh the snapshot.
- Full OpenAPI coverage of every endpoint is incremental; snapshot lists primary routes first.

## References

- [api-endpoints.md](../api-endpoints.md)
- [apps/core/schema/schema_api.py](../../apps/api/apps/core/schema/schema_api.py)
