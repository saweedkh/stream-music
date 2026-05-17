"use client";

import { Download, History, Shield, ThumbsUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/toast-provider";
import {
  addTrackReaction,
  getAuditLogExportUrl,
  listChannelAuditLog,
  listPlaybackHistory,
  listTrackReactions,
  type ChannelAuditLogRow,
  type ChannelTrackReactionRow,
  type PlaybackHistoryRow,
} from "@/lib/api";

type Props = {
  channelId: string;
  canManage: boolean;
  currentTrackId?: number | null;
};

export function ChannelRoomInsights({ channelId, canManage, currentTrackId }: Props) {
  const { showToast } = useToast();
  const [history, setHistory] = useState<PlaybackHistoryRow[]>([]);
  const [audit, setAudit] = useState<ChannelAuditLogRow[]>([]);
  const [reactions, setReactions] = useState<ChannelTrackReactionRow[]>([]);
  const [reactionEmoji, setReactionEmoji] = useState("🔥");

  const load = useCallback(async () => {
    try {
      const [h, a] = await Promise.all([
        listPlaybackHistory(channelId),
        canManage ? listChannelAuditLog(channelId) : Promise.resolve({ results: [] }),
      ]);
      setHistory(h.results);
      setAudit(a.results);
      if (currentTrackId) {
        const r = await listTrackReactions(channelId, currentTrackId);
        setReactions(r.results);
      } else {
        setReactions([]);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not load insights.", "error");
    }
  }, [channelId, canManage, currentTrackId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function postReaction() {
    if (!currentTrackId) {
      showToast("Nothing is playing right now.", "info");
      return;
    }
    try {
      await addTrackReaction(channelId, { track_id: currentTrackId, emoji: reactionEmoji });
      showToast("Reaction saved.", "success");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Reaction failed.", "error");
    }
  }

  const recapTop = useMemo(() => {
    const counts = new Map<string, { title: string; count: number }>();
    for (const row of history) {
      const key = row.track_title ?? `track-${row.track ?? row.id}`;
      const prev = counts.get(key);
      counts.set(key, { title: row.track_title ?? key, count: (prev?.count ?? 0) + 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [history]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-brand/30 bg-gradient-to-br from-background to-[var(--brand-subtle)] lg:col-span-2">
        <CardHeader className="border-b border-border/80 pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="size-5 text-brand" />
            Party recap
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {recapTop.length === 0 ? (
            <p className="text-sm text-muted-foreground">Play some tracks to build tonight&apos;s recap.</p>
          ) : (
            <ol className="space-y-1 text-sm">
              {recapTop.map((t, i) => (
                <li key={t.title} className="flex justify-between gap-2">
                  <span>
                    {i + 1}. {t.title}
                  </span>
                  <span className="text-brand/90">×{t.count}</span>
                </li>
              ))}
            </ol>
          )}
          <Link href={`/party/${channelId}`} className="text-xs text-brand hover:underline">
            Public recap page →
          </Link>
        </CardContent>
      </Card>

      <Card className="border-border/90">
        <CardHeader className="border-b border-border/80 pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="size-5 text-sky-400" />
            Playback history
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ScrollArea className="h-56">
            <ul className="space-y-1 pr-3 font-mono text-xs text-muted-foreground">
              {history.map((row) => (
                <li key={row.id}>
                  {row.emitted_at?.slice(11, 19)} · {row.event_type}
                  {row.track_title ? ` · ${row.track_title}` : ""}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-border/90">
        <CardHeader className="border-b border-border/80 pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ThumbsUp className="size-5 text-rose-400" />
            Track reactions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="flex gap-2">
            <Input value={reactionEmoji} onChange={(e) => setReactionEmoji(e.target.value)} maxLength={8} className="w-20 border-border bg-card" />
            <Button type="button" size="sm" onClick={() => void postReaction()} disabled={!currentTrackId}>
              React to now playing
            </Button>
          </div>
          <ScrollArea className="h-40">
            <ul className="space-y-1 text-sm text-foreground/80">
              {reactions.map((r) => (
                <li key={r.id}>
                  {r.emoji} @{r.username}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      {canManage ? (
        <Card className="border-border/90 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/80 pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="size-5 text-violet-400" />
              Audit log
            </CardTitle>
            <a href={getAuditLogExportUrl(channelId)} download>
              <Button type="button" size="sm" variant="secondary" className="gap-1">
                <Download className="size-3.5" />
                Export CSV
              </Button>
            </a>
          </CardHeader>
          <CardContent className="pt-4">
            <ScrollArea className="h-48">
              <ul className="space-y-1 pr-3 font-mono text-xs text-muted-foreground">
                {audit.map((row) => (
                  <li key={row.id}>
                    {row.created_at?.slice(0, 19)} · {row.action} · {row.actor_username ?? "?"}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
