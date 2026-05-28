# ADR-003: Defer OpenAPI → TypeScript codegen

## Status

Accepted

## Date

2026-05-28

## Context

`docs/project-structure.md` lists OpenAPI-driven API types as a phase-4 goal. The API already exposes `/api/schema` and hand-maintained types live under `apps/web/src/lib/api/types/`.

## Decision

Keep hand-maintained domain types for now. Revisit codegen when:

- API surface stabilizes after the `common` split, and
- CI can run schema diff on every PR.

## Consequences

- No new build dependency in phase 4.
- Types stay aligned via PR discipline and `lib/api/modules/` exports.

## References

- [project-structure.md](../project-structure.md)
