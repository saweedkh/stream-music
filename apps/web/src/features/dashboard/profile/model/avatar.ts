export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const AVATAR_ACCEPT = "image/jpeg,image/png,image/gif,image/webp";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function validateAvatarFile(file: File): "ok" | "invalid" | "too_large" {
  if (!ALLOWED_TYPES.has(file.type)) return "invalid";
  if (file.size > AVATAR_MAX_BYTES) return "too_large";
  return "ok";
}
