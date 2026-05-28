import { getApiBase } from "@/lib/api";

/** Normalize track path or absolute media URL from the API into a fetchable audio URL. */
export function resolveTrackMediaSrc(trackPath: string | undefined | null): string | null {
  if (!trackPath) return null;
  const trimmed = trackPath.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = getApiBase().replace(/\/$/, "");
  return `${base}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}
