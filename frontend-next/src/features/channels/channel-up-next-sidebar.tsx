"use client";

import { ListMusic, Music2 } from "lucide-react";
import { useContext, useMemo } from "react";
import { ChannelQueueContext } from "@/features/channels/channel-queue-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QueueItemSummary } from "@/lib/api";

const ACCENT: Record<string, { ring: string; badge: string; label: string; glow: string }> = {
  emerald: {
    ring: "border-emerald-500/30",
    badge: "bg-emerald-500/15 text-emerald-300",
    label: "text-emerald-400/90",
    glow: "shadow-[0_0_40px_-12px_rgba(16,185,129,0.35)]",
  },
  violet: {
    ring: "border-violet-500/30",
    badge: "bg-violet-500/15 text-violet-300",
    label: "text-violet-400/90",
    glow: "shadow-[0_0_40px_-12px_rgba(139,92,246,0.35)]",
  },
  rose: {
    ring: "border-rose-500/30",
    badge: "bg-rose-500/15 text-rose-300",
    label: "text-rose-400/90",
    glow: "shadow-[0_0_40px_-12px_rgba(244,63,94,0.3)]",
  },
  amber: {
    ring: "border-amber-500/30",
    badge: "bg-amber-500/15 text-amber-300",
    label: "text-amber-400/90",
    glow: "shadow-[0_0_40px_-12px_rgba(245,158,11,0.3)]",
  },
  sky: {
    ring: "border-sky-500/30",
    badge: "bg-sky-500/15 text-sky-300",
    label: "text-sky-400/90",
    glow: "shadow-[0_0_40px_-12px_rgba(14,165,233,0.3)]",
  },
};

function upcomingItems(queue: QueueItemSummary[], currentTrackId?: number | null, limit = 5) {
  let start = 0;
  if (currentTrackId != null) {
    const idx = queue.findIndex((q) => q.track === currentTrackId);
    if (idx >= 0) start = idx + 1;
  }
  return queue.slice(start, start + limit).map((q) => ({
    id: q.id,
    title: q.track_detail?.title ?? `Track #${q.track}`,
    artist: q.track_detail?.artist,
    addedBy: q.added_by_username,
    upvotes: q.upvote_count ?? 0,
  }));
}

type Props = {
  currentTrackId?: number | null;
  accent?: string;
  canManage?: boolean;
  onManageQueue?: () => void;
  className?: string;
};

export function ChannelUpNextSidebar({
  currentTrackId,
  accent = "emerald",
  canManage = false,
  onManageQueue,
  className,
}: Props) {
  const queueCtx = useContext(ChannelQueueContext);
  const queue = queueCtx?.queue ?? [];
  const items = useMemo(() => upcomingItems(queue, currentTrackId), [queue, currentTrackId]);
  const pal = ACCENT[(accent || "emerald").toLowerCase()] ?? ACCENT.emerald;
  const skipped = currentTrackId != null && queue.some((q) => q.track === currentTrackId) ? 1 : 0;
  const remaining = Math.max(0, queue.length - skipped - items.length);

  return (
    <aside className={cn("sticky top-4", className)} aria-label="Up next">
      <div
        className={cn(
          "overflow-hidden rounded-2xl border bg-gradient-to-b from-zinc-900/95 via-zinc-950/98 to-black/90 backdrop-blur-md",
          pal.ring,
          pal.glow,
        )}
      >
        <div className="flex items-center gap-2 border-b border-zinc-800/70 px-4 py-3">
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg border bg-zinc-950/60", pal.ring)}>
            <ListMusic className={cn("size-4", pal.label)} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-zinc-100">Up next</p>
            <p className="text-[11px] text-zinc-500">
              {queue.length === 0 ? "Queue empty" : `${items.length} track${items.length === 1 ? "" : "s"} queued`}
            </p>
          </div>
        </div>

        <div className="px-3 py-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-800/80 bg-zinc-950/50 px-4 py-8 text-center">
              <Music2 className="size-8 text-zinc-600" aria-hidden />
              <p className="text-sm font-medium text-zinc-400">Nothing queued yet</p>
              <p className="max-w-[200px] text-xs leading-relaxed text-zinc-600">
                {canManage ? "Add tracks from Playlist or open the full queue." : "Tracks will appear here when the DJ queues them."}
              </p>
            </div>
          ) : (
            <ol className="space-y-1">
              {items.map((item, i) => (
                <li
                  key={item.id}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-xl px-2 py-2 transition-colors",
                    i === 0 ? "bg-zinc-800/35 ring-1 ring-inset ring-zinc-700/40" : "hover:bg-zinc-800/25",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold tabular-nums",
                      i === 0 ? pal.badge : "bg-zinc-800/80 text-zinc-500",
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight text-zinc-100">{item.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                      {item.artist || item.addedBy || "Unknown artist"}
                      {item.upvotes > 0 ? ` · ${item.upvotes} vote${item.upvotes === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {(canManage || remaining > 0) && (
          <div className="flex items-center justify-between gap-2 border-t border-zinc-800/70 px-4 py-2.5">
            {remaining > 0 ? <p className="text-[11px] text-zinc-500">+{remaining} more in queue</p> : <span />}
            {canManage && onManageQueue ? (
              <Button type="button" variant="ghost" size="sm" className={cn("h-7 px-2 text-xs", pal.label)} onClick={onManageQueue}>
                Manage queue
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
