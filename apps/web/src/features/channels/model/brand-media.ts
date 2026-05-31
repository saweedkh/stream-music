export const BRAND_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const BRAND_VIDEO_MAX_BYTES = 20 * 1024 * 1024;

export const BRAND_LOGO_ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;

export function isBrandVideoFile(file: File): boolean {
  return VIDEO_TYPES.has(file.type) || VIDEO_EXT.test(file.name);
}

export function validateBrandLogoFile(
  file: File,
): "ok" | "invalid" | "too_large" | "video_too_large" {
  if (isBrandVideoFile(file)) {
    if (file.size > BRAND_VIDEO_MAX_BYTES) return "video_too_large";
    return "ok";
  }
  if (!IMAGE_TYPES.has(file.type)) return "invalid";
  if (file.size > BRAND_IMAGE_MAX_BYTES) return "too_large";
  return "ok";
}
