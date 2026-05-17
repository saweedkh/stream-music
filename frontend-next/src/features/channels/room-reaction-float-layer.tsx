"use client";

import type { RoomReactionFloater } from "@/features/channels/room-reaction-constants";
import { cn } from "@/lib/utils";

type Props = {
  floaters: RoomReactionFloater[];
  className?: string;
};

/**
 * Full-area reaction floaters — same `animate-room-reaction-float` as admin panel.
 */
export function RoomReactionFloatLayer({ floaters, className }: Props) {
  if (floaters.length === 0) return null;

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-visible", className)}
      aria-hidden
    >
      {floaters.map((f) => (
        <span
          key={f.id}
          className="pointer-events-none absolute text-2xl opacity-90 animate-room-reaction-float motion-reduce:animate-none"
          style={{ left: `${f.x}%`, bottom: `${f.y}%` }}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  );
}
