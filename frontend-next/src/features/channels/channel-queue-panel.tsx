"use client";

import { ChevronDown, ChevronUp, Play, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast-provider";
import {
  jumpToChannelQueueItem,
  listChannelQueue,
  listTracks,
  removeChannelQueueItem,
  reorderChannelQueueItem,
  type QueueItemSummary,
  type TrackSummary,
} from "@/lib/api";

export function ChannelQueuePanel({ channelId, readOnly = false }: { channelId: string; readOnly?: boolean }) {
  const { showToast } = useToast();
  const [queue, setQueue] = useState<QueueItemSummary[]>([]);
  const [trackMap, setTrackMap] = useState<Record<number, TrackSummary>>({});
  const [status, setStatus] = useState<string | null>(null);

  async function refresh() {
    if (readOnly) {
      setQueue([]);
      setTrackMap({});
      setStatus(null);
      return;
    }
    try {
      const [queueData, tracks] = await Promise.all([listChannelQueue(channelId), listTracks()]);
      setQueue(queueData.results);
      setTrackMap(Object.fromEntries(tracks.map((t) => [t.id, t])));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cannot load queue.";
      setStatus(message);
      showToast(message, "error");
    }
  }

  useEffect(() => {
    void refresh();
  }, [channelId, readOnly]);

  return (
    <Card className="overflow-hidden border-zinc-800/90 transition-shadow duration-300 hover:shadow-lg hover:shadow-black/20">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 border-b border-zinc-800/80 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-lg">Queue</CardTitle>
        </div>
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => void refresh()} disabled={readOnly}>
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[min(420px,50vh)]">
          <div className="space-y-2 p-5 pr-3">
            {readOnly ? (
              <p className="py-6 text-center text-sm text-zinc-500">Reopen the channel to load or edit the queue.</p>
            ) : null}
            {!readOnly &&
              queue.map((item) => (
              <div
                key={item.id}
                className="group flex flex-col gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-3 transition-colors duration-200 hover:border-zinc-700/90 hover:bg-zinc-900/35 sm:flex-row sm:items-center sm:gap-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="inline-flex min-w-9 justify-center rounded-md border border-zinc-700/80 bg-zinc-900/80 px-2 py-1 font-mono text-xs text-zinc-400">
                    #{item.position}
                  </span>
                  <span className="truncate text-sm font-medium text-zinc-100">
                    {trackMap[item.track]?.title ?? `Track ${item.track}`}
                  </span>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Move up"
                    onClick={async () => {
                      try {
                        await reorderChannelQueueItem(channelId, item.id, Math.max(0, item.position - 1));
                        refresh();
                      } catch (error) {
                        const message = error instanceof Error ? error.message : "Cannot move queue item up.";
                        showToast(message, "error");
                      }
                    }}
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Move down"
                    onClick={async () => {
                      try {
                        await reorderChannelQueueItem(channelId, item.id, item.position + 1);
                        refresh();
                      } catch (error) {
                        const message = error instanceof Error ? error.message : "Cannot move queue item down.";
                        showToast(message, "error");
                      }
                    }}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                  <Separator orientation="vertical" className="hidden h-6 sm:block" />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1"
                    onClick={async () => {
                      try {
                        await jumpToChannelQueueItem(channelId, item.id);
                        setStatus("Jumped to selected queue item.");
                        showToast("Jumped to selected queue item.", "success");
                      } catch (error) {
                        const message = error instanceof Error ? error.message : "Cannot jump to selected queue item.";
                        showToast(message, "error");
                      }
                    }}
                  >
                    <Play className="size-3.5" />
                    Play
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1"
                    onClick={async () => {
                      try {
                        await removeChannelQueueItem(channelId, item.id);
                        showToast("Queue item removed.", "success");
                        await refresh();
                      } catch (error) {
                        const message = error instanceof Error ? error.message : "Cannot remove queue item.";
                        showToast(message, "error");
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Remove
                  </Button>
                </div>
              </div>
              ))}
            {!readOnly && queue.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">Queue is empty — add tracks from the Listen tab.</p>
            ) : null}
          </div>
        </ScrollArea>
        {status ? (
          <>
            <Separator />
            <div className="px-5 pb-5 pt-3">
              <Alert>{status}</Alert>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
