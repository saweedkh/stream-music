/** Auto-generated operation keys (METHOD path) — do not edit by hand. */
export const OPENAPI_OPERATIONS = {
  "POST /auth/login": "POST /auth/login",
  "GET /auth/me": "GET /auth/me",
  "POST /auth/register": "POST /auth/register",
  "GET /channels/": "GET /channels/",
  "POST /channels/": "POST /channels/",
  "GET /channels/{channel_id}/audit-log": "GET /channels/{channel_id}/audit-log",
  "POST /channels/{channel_id}/control": "POST /channels/{channel_id}/control",
  "GET /channels/{channel_id}/history": "GET /channels/{channel_id}/history",
  "GET /channels/{channel_id}/queue": "GET /channels/{channel_id}/queue",
  "POST /channels/{channel_id}/queue/{item_id}/upvote": "POST /channels/{channel_id}/queue/{item_id}/upvote",
  "DELETE /channels/{channel_id}/queue/{item_id}/upvote": "DELETE /channels/{channel_id}/queue/{item_id}/upvote",
  "GET /channels/{channel_id}/state": "GET /channels/{channel_id}/state",
  "GET /channels/{channel_id}/suggestions": "GET /channels/{channel_id}/suggestions",
  "POST /channels/{channel_id}/suggestions": "POST /channels/{channel_id}/suggestions",
  "PATCH /channels/{channel_id}/suggestions": "PATCH /channels/{channel_id}/suggestions",
  "GET /health": "GET /health",
  "GET /metrics": "GET /metrics",
  "GET /time": "GET /time",
  "POST /tracks/upload/init": "POST /tracks/upload/init",
  "PUT /tracks/upload/{upload_id}/chunk": "PUT /tracks/upload/{upload_id}/chunk",
  "POST /tracks/upload/{upload_id}/finalize": "POST /tracks/upload/{upload_id}/finalize",
  "GET /tracks/upload/{upload_id}/status": "GET /tracks/upload/{upload_id}/status",
} as const;

export type OpenApiOperation = keyof typeof OPENAPI_OPERATIONS;
