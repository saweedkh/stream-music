"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveMediaCandidates } from "@/lib/media-url";
import { cn } from "@/lib/utils";

export type UserAvatarProps = {
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
};

function userInitial(username: string, displayName?: string) {
  const fromName = (displayName || "").trim();
  if (fromName) {
    const parts = fromName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return fromName.slice(0, 2).toUpperCase() || "?";
  }
  return (username || "?").slice(0, 1).toUpperCase();
}

export function UserAvatar({
  username,
  displayName,
  avatarUrl,
  className,
  imageClassName,
  fallbackClassName,
}: UserAvatarProps) {
  const candidates = useMemo(() => resolveMediaCandidates(avatarUrl), [avatarUrl]);
  const [attempt, setAttempt] = useState(0);
  const src = candidates[attempt] ?? null;

  useEffect(() => {
    setAttempt(0);
  }, [avatarUrl]);

  const initial = userInitial(username, displayName);

  return (
    <span className={cn("relative inline-flex shrink-0 overflow-hidden rounded-full bg-muted", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- GIF + multi-origin fallbacks
        <img
          src={src}
          alt=""
          className={cn("size-full object-cover", imageClassName)}
          onError={() => setAttempt((prev) => (prev + 1 < candidates.length ? prev + 1 : prev))}
        />
      ) : null}
      <span
        className={cn(
          "flex size-full items-center justify-center font-semibold uppercase text-brand",
          src && "sr-only",
          fallbackClassName,
        )}
        aria-hidden={Boolean(src)}
      >
        {initial}
      </span>
    </span>
  );
}
