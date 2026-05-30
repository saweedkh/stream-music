/**
 * OpenAPI contract types — regenerate with `make openapi-export`.
 */
import type snapshot from "../openapi.snapshot.json";

export type { OpenApiPath } from "./schema-paths";
export { OPENAPI_PATHS } from "./schema-paths";

export type OpenApiSnapshot = typeof snapshot;

export type OpenApiPaths = keyof OpenApiSnapshot["paths"];

export type OpenApiHttpMethod = "get" | "post" | "put" | "patch" | "delete";

export type OpenApiOperation = {
  summary?: string;
  tags?: string[];
};

export type OpenApiPathOperations = OpenApiSnapshot["paths"][OpenApiPaths];
