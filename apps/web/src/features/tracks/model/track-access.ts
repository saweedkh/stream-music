import type { TrackSummary } from "@/lib/api";
import type { MessageKey } from "@/lib/i18n/messages";

/** Simplified access shown in upload & library UI. */
export type TrackAccess = "public" | "private";

export const TRACK_ACCESS_LABEL_KEYS: Record<TrackAccess, MessageKey> = {
  public: "tracks.accessPublic",
  private: "tracks.accessPrivate",
};

export const TRACK_ACCESS_HINT_KEYS: Record<TrackAccess, MessageKey> = {
  public: "tracks.accessPublicHint",
  private: "tracks.accessPrivateHint",
};

export function toBackendVisibility(access: TrackAccess): TrackSummary["visibility"] {
  return access === "public" ? "public_lan" : "private";
}

export function fromBackendVisibility(visibility: TrackSummary["visibility"]): TrackAccess {
  return visibility === "private" ? "private" : "public";
}
