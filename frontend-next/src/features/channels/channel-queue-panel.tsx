"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function ChannelQueuePanel({ channelId }: { channelId: string }) {
  const { showToast } = useToast();
  const [queue, setQueue] = useState<QueueItemSummary[]>([]);
  const [trackMap, setTrackMap] = useState<Record<number, TrackSummary>>({});
  const [status, setStatus] = useState<string | null>(null);

  async function refresh() {
    try {
      const [queueData, tracks] = await Promise.all([listChannelQueue(channelId), listTracks()]);
      setQueue(queueData.results);
      setTrackMap(Object.fromEntries(tracks.map((t) => [t.id, t])));
    } catch {
      setStatus("Cannot load queue.");
      showToast("Cannot load queue.", "error");
    }
  }

  useEffect(() => {
    refresh();
  }, [channelId]);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Channel Queue</CardTitle>
        <Button variant="secondary" onClick={refresh}>
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {queue.map((item) => (
          <div key={item.id} className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900/60 p-2 text-sm">
            <div className="min-w-8 rounded bg-slate-800 px-2 py-1 text-center text-xs text-slate-300">#{item.position}</div>
            <div className="flex-1 font-medium">{trackMap[item.track]?.title ?? `Track ${item.track}`}</div>
            <Button
              variant="ghost"
              className="px-2 py-1"
              onClick={async () => {
                try {
                  await reorderChannelQueueItem(channelId, item.id, Math.max(0, item.position - 1));
                  refresh();
                } catch {
                  showToast("Cannot move queue item up.", "error");
                }
              }}
            >
              Up
            </Button>
            <Button
              variant="ghost"
              className="px-2 py-1"
              onClick={async () => {
                try {
                  await reorderChannelQueueItem(channelId, item.id, item.position + 1);
                  refresh();
                } catch {
                  showToast("Cannot move queue item down.", "error");
                }
              }}
            >
              Down
            </Button>
            <Button
              variant="secondary"
              className="px-2 py-1"
              onClick={async () => {
                try {
                  await jumpToChannelQueueItem(channelId, item.id);
                  setStatus("Jumped to selected queue item.");
                } catch {
                  showToast("Cannot jump to selected queue item.", "error");
                }
              }}
            >
              Play
            </Button>
            <Button
              variant="danger"
              className="px-2 py-1"
              onClick={async () => {
                try {
                  await removeChannelQueueItem(channelId, item.id);
                  refresh();
                } catch {
                  showToast("Cannot remove queue item.", "error");
                }
              }}
            >
              Remove
            </Button>
          </div>
        ))}
        {queue.length === 0 ? <p className="text-sm text-slate-400">Queue is empty.</p> : null}
        {status ? <Alert>{status}</Alert> : null}
      </CardContent>
    </Card>
  );
}
