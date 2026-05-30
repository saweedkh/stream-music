/** Auto-generated from openapi.snapshot.json — do not edit by hand. */
export const OPENAPI_PATHS = [
  "/auth/login",
  "/auth/me",
  "/auth/register",
  "/channels/",
  "/channels/{channel_id}/audit-log",
  "/channels/{channel_id}/control",
  "/channels/{channel_id}/history",
  "/channels/{channel_id}/queue",
  "/channels/{channel_id}/queue/{item_id}/upvote",
  "/channels/{channel_id}/state",
  "/channels/{channel_id}/suggestions",
  "/health",
  "/metrics",
  "/time",
  "/tracks/upload/init",
  "/tracks/upload/{upload_id}/chunk",
  "/tracks/upload/{upload_id}/finalize",
  "/tracks/upload/{upload_id}/status",
] as const;

export type OpenApiPath = (typeof OPENAPI_PATHS)[number];
