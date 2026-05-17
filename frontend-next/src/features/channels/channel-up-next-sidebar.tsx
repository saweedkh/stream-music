"use client";

import { ChevronRight, ListMusic } from "lucide-react";
import { useContext, useMemo } from "react";
import { ChannelQueueContext } from "@/features/channels/channel-queue-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QueueItemSummary } from "@/lib/api";

type UpcomingItem = {
  id: number;
  title: string;
  artist: string | null;
  upvotes: number;
};

function upcomingItems(queue: QueueItemSummary[], currentTrackId?: number | null, limit = 6): UpcomingItem[] {
  let start = 0;
  if (currentTrackId != null) {
    const idx = queue.findIndex((q) => q.track === currentTrackId);
    if (idx >= 0) start = idx + 1;
  }
  return queue.slice(start, start + limit).map((q) => ({
    id: q.id,
    title: q.track_detail?.title?.trim() || `Track #${q.track}`,
    artist: q.track_detail?.artist?.trim() || q.added_by_username || null,
    upvotes: q.upvote_count ?? 0,
  }));
}

type Props = {
  currentTrackId?: number | null;
  canManage?: boolean;
  onOpenQueue?: () => void;
  className?: string;
};

export function ChannelUpNextSidebar({
  currentTrackId,
  canManage = false,
  onOpenQueue,
  className,
}: Props) {
  const queueCtx = useContext(ChannelQueueContext);
  const queue = queueCtx?.queue ?? [];
  const items = useMemo(() => upcomingItems(queue, currentTrackId), [queue, currentTrackId]);

  const upcomingCount = useMemo(() => {
    if (currentTrackId == null) return queue.length;
    const idx = queue.findIndex((q) => q.track === currentTrackId);
    return idx >= 0 ? Math.max(0, queue.length - idx - 1) : queue.length;
  }, [queue, currentTrackId]);

  const [next, ...rest] = items;
  const moreCount = Math.max(0, upcomingCount - items.length);

  return (
    <aside className={cn("sticky top-4 w-full max-w-[15.5rem]", className)} aria-label="Up next">
      <div className="surface-card overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <ListMusic className="size-4 shrink-0 text-brand" aria-hidden />
            <span className="text-sm font-semibold text-foreground">Coming up</span>
          </div>
          {upcomingCount > 0 ? (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {upcomingCount}
            </span>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">Nothing queued</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground/80">
              {canManage ? "Add tracks from Playlist or Queue." : "Tracks show here when queued."}
            </p>
          </div>
        ) : (
          <>
            {next ? (
              <div className="border-b border-border/60 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-brand">Next</p>
                <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-foreground">{next.title}</p>
                {next.artist ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{next.artist}</p> : null}
                {next.upvotes > 0 ? (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    {next.upvotes} upvote{next.upvotes === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            ) : null}

            {rest.length > 0 ? (
              <ul className="divide-y divide-border/50 px-1 py-1">
                {rest.map((item, i) => (
                  <li key={item.id} className="flex items-start gap-2 px-2 py-2">
                    <span className="mt-0.5 w-4 shrink-0 text-right text-[10px] font-medium tabular-nums text-muted-foreground">
                      {i + 2}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground/90">{item.title}</p>
                      {item.artist ? (
                        <p className="truncate text-[10px] text-muted-foreground">{item.artist}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}

        {(canManage && onOpenQueue) || moreCount > 0 ? (
          <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2">
            {moreCount > 0 ? <span className="text-[10px] text-muted-foreground">+{moreCount} more</span> : <span />}
            {canManage && onOpenQueue ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-0.5 px-2 text-xs text-brand hover:text-brand"
                onClick={onOpenQueue}
              >
                Queue
                <ChevronRight className="size-3.5" aria-hidden />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
