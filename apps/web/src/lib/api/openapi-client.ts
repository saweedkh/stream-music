/**
 * Typed OpenAPI fetch helper (paths from openapi-schema.ts when generated).
 * Regenerate: `bash tooling/scripts/generate-openapi-typescript.sh`
 */
import { getApiBase, withAuthHeaders, extractApiError } from "./client";

export type HttpMethod = "get" | "post" | "patch" | "put" | "delete";

export type OpenApiFetchOptions = {
  method?: HttpMethod;
  body?: unknown;
  auth?: boolean;
  params?: Record<string, string | number>;
};

function applyPathParams(path: string, params?: Record<string, string | number>): string {
  if (!params) return path;
  let out = path;
  for (const [key, value] of Object.entries(params)) {
    out = out.replace(`{${key}}`, encodeURIComponent(String(value)));
  }
  return out;
}

/** Call an OpenAPI path (e.g. `/api/health` or `/channels/{channel_id}/state`). */
export async function openApiFetch<T = unknown>(
  path: string,
  options: OpenApiFetchOptions = {},
): Promise<T> {
  const method = (options.method ?? "get").toUpperCase();
  const apiPath = path.startsWith("/api/") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  const resolved = applyPathParams(apiPath, options.params);
  const url = `${getApiBase()}${resolved}`;
  const init: RequestInit = { method, cache: "no-store" };
  if (options.body !== undefined) {
    const headers = options.auth
      ? (await withAuthHeaders({ method, body: JSON.stringify(options.body) })).headers
      : { "Content-Type": "application/json" };
    init.headers = headers;
    init.body = JSON.stringify(options.body);
  } else if (options.auth) {
    const authed = await withAuthHeaders({ method });
    init.headers = authed.headers;
    if (method !== "GET") init.credentials = authed.credentials;
  }
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(await extractApiError(res, `API ${method} ${resolved} failed`));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
