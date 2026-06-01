/** Pick playback file tier from network conditions. */

export type MediaTier = "low" | "standard";

export function pickMediaTier(): MediaTier {
  if (typeof navigator === "undefined") return "standard";
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } })
    .connection;
  if (conn?.saveData) return "low";
  const t = conn?.effectiveType ?? "";
  if (t === "slow-2g" || t === "2g" || t === "3g") return "low";
  return "standard";
}

export function resolveTrackFileForTier(
  track: { file?: string | null; file_low?: string | null },
  tier: MediaTier = pickMediaTier(),
): string | null {
  if (tier === "low" && track.file_low) return track.file_low;
  return track.file ?? null;
}
