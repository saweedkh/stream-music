"use client";

import { Headphones, ListMusic, SkipForward } from "lucide-react";
import { useContext } from "react";
import { ChannelQueueContext } from "@/features/channels/channel-queue-context";
import { ChannelQueuePanel } from "@/features/channels/channel-queue-panel";
import { UpNextStrip, type UpNextItem } from "@/components/room/up-next-strip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { QueueItemSummary } from "@/lib/api";

type Props = {
  channelId: string;
  canManage: boolean;
  sendSocketMessage?: (payload: Record<string, unknown>) => boolean;
  nowPlayingTitle?: string | null;
};

function toUpNext(queue: QueueItemSummary[], currentTrackId?: number | null): UpNextItem[] {
  let start = 0;
  if (currentTrackId != null) {
    const idx = queue.findIndex((q) => q.track === currentTrackId);
    if (idx >= 0) start = idx + 1;
  }
  return queue.slice(start, start + 3).map((q) => ({
    id: q.id,
    title: q.track_detail?.title ?? `Track #${q.track}`,
    artist: q.track_detail?.artist,
  }));
}

export function DjBoothPanel({ channelId, canManage, sendSocketMessage, nowPlayingTitle }: Props) {
  const queueCtx = useContext(ChannelQueueContext);
  const queue = queueCtx?.queue ?? [];
  const upNext = toUpNext(queue);

  return (
    <div className="space-y-4">
      <Card className="border-emerald-900/40 bg-gradient-to-br from-zinc-950 via-emerald-950/20 to-zinc-950">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Headphones className="size-5 text-emerald-400" />
            DJ booth
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-400">
            Compact view for hosts — queue, skip, and what plays next.
          </p>
          {nowPlayingTitle ? (
            <p className="truncate text-base font-medium text-white">{nowPlayingTitle}</p>
          ) : (
            <p className="text-sm text-zinc-500">Nothing playing</p>
          )}
          <UpNextStrip items={upNext} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1.5"
              disabled={!canManage}
              onClick={() => sendSocketMessage?.({ action: "next" })}
            >
              <SkipForward className="size-4" />
              Skip
            </Button>
            <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-zinc-400" asChild>
              <a href={`#channel-queue-panel`}>
                <ListMusic className="size-4" />
                Full queue
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
      <div id="channel-queue-panel">
        <ChannelQueuePanel channelId={channelId} readOnly={!canManage} />
      </div>
    </div>
  );
}
