"use client";

import { ChevronDown, ChevronUp, ListMusic, Loader2, Play, Radio, RefreshCw, ThumbsUp, Trash2 } from "lucide-react";
import { useCallback, useContext, useEffect, useState } from "react";
import { ChannelQueueContext } from "@/features/channels/channel-queue-context";
import { listenerItemClass } from "@/features/channels/channel-listener-panel-styles";
import { useTranslations } from "@/components/providers/locale-provider";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast-provider";
import {
  ChannelClosedError,
  jumpToChannelQueueItem,
  listChannelQueue,
  listTracks,
  normalizeTrackList,
  removeChannelQueueItem,
  removeQueueUpvote,
  reorderChannelQueueItem,
  upvoteChannelQueueItem,
  type QueueItemSummary,
  type TrackSummary,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  channelId: string;
  readOnly?: boolean;
  variant?: "admin" | "listener";
  /** Currently playing track id (from playback sync). */
  currentTrackId?: number | null;
  /** Admin channel tab — full-bleed layout aligned with playlist panel. */
  embedded?: boolean;
};

const rowBtn =
  "h-8 w-8 shrink-0 text-muted-foreground hover:bg-muted/50 hover:text-foreground";

export function ChannelQueuePanel({
  channelId,
  readOnly = false,
  variant = "admin",
  embedded = false,
  currentTrackId = null,
}: Props) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const queueCtx = useContext(ChannelQueueContext);
  const [queue, setQueue] = useState<QueueItemSummary[]>([]);
  const [trackMap, setTrackMap] = useState<Record<number, TrackSummary>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [upvotingId, setUpvotingId] = useState<number | null>(null);
  const isListener = variant === "listener";

  const loadListenerQueue = useCallback(async () => {
    setLoading(true);
    try {
      const [queueData, tracksRaw] = await Promise.all([listChannelQueue(channelId), listTracks()]);
      const tracks = normalizeTrackList(tracksRaw);
      setQueue(queueData.results);
      setTrackMap(Object.fromEntries(tracks.map((tr) => [tr.id, tr])));
      setStatus(null);
    } catch (error) {
      if (error instanceof ChannelClosedError) {
        setQueue([]);
        setTrackMap({});
        setStatus(null);
        return;
      }
      const message = error instanceof Error ? error.message : t("room.queue.loadFailed");
      setStatus(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [channelId, showToast]);

  const toggleUpvote = useCallback(
    async (item: QueueItemSummary) => {
      if (upvotingId != null) return;
      const wasVoted = Boolean(item.user_upvoted);
      setUpvotingId(item.id);
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                user_upvoted: !wasVoted,
                upvote_count: Math.max(0, (q.upvote_count ?? 0) + (wasVoted ? -1 : 1)),
              }
            : q,
        ),
      );
      try {
        if (wasVoted) await removeQueueUpvote(channelId, item.id);
        else await upvoteChannelQueueItem(channelId, item.id);
        const data = await listChannelQueue(channelId);
        setQueue(data.results);
        await queueCtx?.refreshQueue();
      } catch (error) {
        showToast(error instanceof Error ? error.message : t("room.queue.upvoteFailed"), "error");
        await loadListenerQueue();
      } finally {
        setUpvotingId(null);
      }
    },
    [channelId, loadListenerQueue, queueCtx, showToast, upvotingId],
  );

  async function refresh() {
    if (isListener) {
      await loadListenerQueue();
      return;
    }
    if (readOnly) {
      setQueue([]);
      setTrackMap({});
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [queueData, tracksRaw] = await Promise.all([listChannelQueue(channelId), listTracks()]);
      const tracks = normalizeTrackList(tracksRaw);
      setQueue(queueData.results);
      setTrackMap(Object.fromEntries(tracks.map((t) => [t.id, t])));
    } catch (error) {
      if (error instanceof ChannelClosedError) {
        setQueue([]);
        setTrackMap({});
        setStatus(null);
        return;
      }
      const message = error instanceof Error ? error.message : t("room.queue.loadFailed");
      setStatus(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isListener) return;
    if (queueCtx?.queue) setQueue(queueCtx.queue);
  }, [queueCtx?.queue, isListener]);

  useEffect(() => {
    void refresh();
  }, [channelId, readOnly, isListener, loadListenerQueue]);

  useEffect(() => {
    if (!isListener) return;
    function onPlayback(ev: Event) {
      const e = ev as CustomEvent<{ channelId?: string }>;
      if (String(e.detail?.channelId ?? "") !== String(channelId)) return;
      void loadListenerQueue();
    }
    window.addEventListener("channel-playback-updated", onPlayback);
    return () => window.removeEventListener("channel-playback-updated", onPlayback);
  }, [channelId, isListener, loadListenerQueue]);

  useEffect(() => {
    if (isListener) return;
    function onPlayback(ev: Event) {
      const e = ev as CustomEvent<{ channelId?: string }>;
      if (String(e.detail?.channelId ?? "") !== String(channelId)) return;
      void refresh();
    }
    window.addEventListener("channel-playback-updated", onPlayback);
    return () => window.removeEventListener("channel-playback-updated", onPlayback);
  }, [channelId, isListener]);

  const listContent = (
    <div className="space-y-2">
      {!isListener && readOnly ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("room.admin.queue.reopenHint")}</p>
      ) : null}
      {loading ? <ListSkeleton rows={6} className="py-2" /> : null}
      {!loading &&
        queue.map((item) => {
          const isNowPlaying = currentTrackId != null && item.track === currentTrackId;
          return (
          <div
            key={item.id}
            data-testid={isNowPlaying ? "queue-item-now-playing" : undefined}
            className={cn(
              "group relative flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3",
              isListener
                ? listenerItemClass
                : "rounded-lg border border-border/80 bg-card/40 transition-colors duration-200 hover:border-border/90 hover:bg-card/35",
              isNowPlaying &&
                "border-brand/70 bg-gradient-to-r from-brand/20 via-brand/10 to-transparent shadow-[0_0_0_1px_rgba(var(--brand-rgb,34,197,94),0.35),0_0_24px_-4px_rgba(var(--brand-rgb,34,197,94),0.25)] ring-2 ring-brand/40",
            )}
          >
            {isNowPlaying ? (
              <span className="absolute end-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
                <Radio className="size-3 animate-pulse" aria-hidden />
                {t("room.queue.nowPlaying")}
              </span>
            ) : null}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span
                className={cn(
                  "inline-flex min-w-9 shrink-0 justify-center rounded-md border px-2 py-1 font-mono text-xs",
                  isListener
                    ? "border-brand/25 bg-brand/10 text-brand"
                    : "border-border/80 bg-card/80 text-muted-foreground",
                )}
              >
                #{item.position}
              </span>
              <span className="min-w-0 truncate text-sm font-medium text-foreground">
                {trackMap[item.track]?.title ?? `Track ${item.track}`}
                {item.added_by_username ? (
                  <span className="ms-2 text-xs font-normal text-muted-foreground">· {item.added_by_username}</span>
                ) : null}
                {item.premium_boosted ? (
                  <span className="ms-2 text-xs font-medium text-amber-500/90">{t("room.queue.premiumBoost")}</span>
                ) : null}
              </span>
              {isListener && (item.upvote_count ?? 0) > 0 ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t("room.listener.queue.upvoteCount", { count: item.upvote_count ?? 0 })}
                </span>
              ) : null}
              {!isListener && (item.upvote_count ?? 0) > 0 ? (
                <span className="shrink-0 text-xs text-muted-foreground">{item.upvote_count} up</span>
              ) : null}
            </div>
            {!isListener && !readOnly ? (
              <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
                <Button
                  variant={item.user_upvoted ? "default" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  title="Upvote"
                  onClick={async () => {
                    try {
                      if (item.user_upvoted) await removeQueueUpvote(channelId, item.id);
                      else await upvoteChannelQueueItem(channelId, item.id);
                      await refresh();
                      await queueCtx?.refreshQueue();
                    } catch (error) {
                      showToast(error instanceof Error ? error.message : t("room.queue.upvoteFailed"), "error");
                    }
                  }}
                >
                  <ThumbsUp className="size-4" />
                </Button>
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
                      showToast(error instanceof Error ? error.message : "Cannot move queue item up.", "error");
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
                      showToast(error instanceof Error ? error.message : "Cannot move queue item down.", "error");
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
                      showToast(error instanceof Error ? error.message : "Cannot jump to selected queue item.", "error");
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
                      showToast(error instanceof Error ? error.message : "Cannot remove queue item.", "error");
                    }
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Remove
                </Button>
              </div>
            ) : isListener ? (
              <div className="flex shrink-0 items-center sm:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-9 gap-1.5 rounded-lg border px-2.5 transition-colors",
                    item.user_upvoted
                      ? "border-brand/40 bg-brand/15 text-brand hover:bg-brand/20"
                      : "border-border/60 bg-background/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                  disabled={upvotingId === item.id}
                  aria-pressed={Boolean(item.user_upvoted)}
                  onClick={() => void toggleUpvote(item)}
                >
                  <ThumbsUp className={cn("size-4 shrink-0", item.user_upvoted && "fill-current")} aria-hidden />
                  <span className="text-xs font-medium">
                    {item.user_upvoted ? t("room.listener.queue.upvoted") : t("room.listener.queue.upvote")}
                  </span>
                </Button>
              </div>
            ) : null}
          </div>
        );
        })}
      {!loading && queue.length === 0 ? (
        <EmptyState
          title="Queue is empty"
          description={
            isListener
              ? "Tracks will appear here when the DJ adds them to the lineup."
              : "Add tracks from the Listen tab or let listeners suggest songs."
          }
        />
      ) : null}
    </div>
  );

  if (isListener) {
    return (
      <div className="space-y-3">
        {listContent}
        {status ? <Alert>{status}</Alert> : null}
      </div>
    );
  }

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-brand/25 bg-[var(--brand-subtle)] text-brand">
              <ListMusic className="size-5" aria-hidden />
            </div>
            <div>
              <h2 className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
                {t("room.admin.tab.queue.title")}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("room.admin.queue.count", { count: queue.length })}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 shrink-0 gap-2"
            disabled={readOnly || loading}
            onClick={() => void refresh()}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {t("room.admin.queue.refresh")}
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-2 py-3 sm:px-3">
          {readOnly ? (
            <p className="px-3 py-12 text-center text-sm text-muted-foreground">{t("room.admin.queue.reopenHint")}</p>
          ) : loading ? (
            <div className="space-y-1.5 px-2 py-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : !queue.length ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <ListMusic className="size-10 text-muted-foreground/50" aria-hidden />
              <p className="text-sm font-medium text-foreground">{t("room.admin.queue.empty")}</p>
              <p className="max-w-sm text-xs text-muted-foreground">{t("room.admin.queue.emptyHint")}</p>
            </div>
          ) : (
            <ul className="space-y-0.5 px-1">
              {queue.map((item) => {
                const isNowPlaying = currentTrackId != null && item.track === currentTrackId;
                return (
                <li
                  key={item.id}
                  data-testid={isNowPlaying ? "queue-item-now-playing" : undefined}
                  className={cn(
                    "relative flex flex-col gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center",
                    isNowPlaying &&
                      "border border-brand/60 bg-gradient-to-r from-brand/15 to-transparent ring-2 ring-brand/35",
                  )}
                >
                  {isNowPlaying ? (
                    <span className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                      <Radio className="size-3 animate-pulse" aria-hidden />
                      {t("room.queue.nowPlaying")}
                    </span>
                  ) : null}
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="w-7 shrink-0 text-center font-mono text-xs text-muted-foreground">{item.position}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {trackMap[item.track]?.title ?? `Track ${item.track}`}
                      </p>
                      {item.added_by_username ? (
                        <p className="truncate text-xs text-muted-foreground">{item.added_by_username}</p>
                      ) : null}
                    </div>
                    {(item.upvote_count ?? 0) > 0 ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {t("room.admin.queue.upvotes", { count: item.upvote_count ?? 0 })}
                      </span>
                    ) : null}
                  </div>
                  {!readOnly ? (
                    <div className="flex shrink-0 flex-wrap items-center gap-0.5 sm:justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(rowBtn, item.user_upvoted && "text-brand")}
                        title={t("room.admin.queue.tip.upvote")}
                        onClick={async () => {
                          try {
                            if (item.user_upvoted) await removeQueueUpvote(channelId, item.id);
                            else await upvoteChannelQueueItem(channelId, item.id);
                            await refresh();
                            await queueCtx?.refreshQueue();
                          } catch (error) {
                            showToast(error instanceof Error ? error.message : t("room.queue.upvoteFailed"), "error");
                          }
                        }}
                      >
                        <ThumbsUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={rowBtn}
                        title={t("room.admin.queue.tip.moveUp")}
                        onClick={async () => {
                          try {
                            await reorderChannelQueueItem(channelId, item.id, Math.max(0, item.position - 1));
                            refresh();
                          } catch (error) {
                            showToast(error instanceof Error ? error.message : "Cannot move queue item up.", "error");
                          }
                        }}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={rowBtn}
                        title={t("room.admin.queue.tip.moveDown")}
                        onClick={async () => {
                          try {
                            await reorderChannelQueueItem(channelId, item.id, item.position + 1);
                            refresh();
                          } catch (error) {
                            showToast(error instanceof Error ? error.message : "Cannot move queue item down.", "error");
                          }
                        }}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(rowBtn, "text-brand")}
                        title={t("room.admin.queue.tip.play")}
                        onClick={async () => {
                          try {
                            await jumpToChannelQueueItem(channelId, item.id);
                            setStatus("Jumped to selected queue item.");
                            showToast("Jumped to selected queue item.", "success");
                          } catch (error) {
                            showToast(error instanceof Error ? error.message : "Cannot jump to selected queue item.", "error");
                          }
                        }}
                      >
                        <Play className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(rowBtn, "hover:text-destructive")}
                        title={t("room.admin.queue.tip.remove")}
                        onClick={async () => {
                          try {
                            await removeChannelQueueItem(channelId, item.id);
                            showToast(t("room.queue.removed"), "success");
                            await refresh();
                          } catch (error) {
                            showToast(error instanceof Error ? error.message : t("room.queue.removeFailed"), "error");
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
              })}
            </ul>
          )}
        </ScrollArea>

        {status ? (
          <div className="shrink-0 border-t border-border/40 px-4 py-2.5">
            <p className="text-xs text-muted-foreground">{status}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden border-border/90 transition-shadow duration-300 hover:shadow-lg hover:shadow-black/20">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 border-b border-border/80 pb-4">
        <CardTitle className="text-lg">{t("room.admin.playlist.queue")}</CardTitle>
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => void refresh()} disabled={readOnly}>
          <RefreshCw className="size-3.5" />
          {t("common.refresh")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <div className="max-h-[min(380px,45vh)] overflow-y-auto">{listContent}</div>
        {status ? (
          <>
            <Separator />
            <Alert>{status}</Alert>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
