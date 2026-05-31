"use client";

import { contentAccent } from "@/shared/model/content-accent";
import { cn } from "@/lib/utils";

type TrackArtworkProps = {
  title: string;
  className?: string;
};

/** Minimal track tile — first letter, no generic disc icon. */
export function TrackArtwork({ title, className }: TrackArtworkProps) {
  const accent = contentAccent(title);
  const initial = title.trim().charAt(0).toLocaleUpperCase() || "?";

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br font-display text-sm font-bold uppercase shadow-inner",
        accent.cover,
        accent.icon,
        className,
      )}
      aria-hidden
    >
      {initial}
    </span>
  );
}
