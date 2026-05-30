/**
 * OpenAPI contract types — snapshot from `make openapi-export`.
 * Regenerate: `make openapi-export` → `openapi.snapshot.json`
 */
import type snapshot from "../openapi.snapshot.json";

export type OpenApiSnapshot = typeof snapshot;

export type OpenApiPaths = keyof OpenApiSnapshot["paths"];
