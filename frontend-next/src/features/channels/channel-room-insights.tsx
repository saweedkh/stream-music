"use client";

import { Download, History, Lightbulb, Shield, ThumbsUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-provider";
import {
  addTrackReaction,
  createChannelSuggestion,
  getAuditLogExportUrl,
  listChannelAuditLog,
  listChannelSuggestions,
  listPlaybackHistory,
  listTrackReactions,
  listTracks,
  reviewChannelSuggestion,
  type ChannelAuditLogRow,
  type ChannelPlaylistSuggestion,
  type ChannelTrackReactionRow,
  type PlaybackHistoryRow,
  type TrackSummary,
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
  const [suggestions, setSuggestions] = useState<ChannelPlaylistSuggestion[]>([]);
  const [reactions, setReactions] = useState<ChannelTrackReactionRow[]>([]);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [suggestTrackId, setSuggestTrackId] = useState("");
  const [suggestNote, setSuggestNote] = useState("");
  const [suggestionFilter, setSuggestionFilter] = useState<"" | "pending" | "approved" | "rejected">("pending");
  const [reactionEmoji, setReactionEmoji] = useState("🔥");

  const load = useCallback(async () => {
    try {
      const [h, a, s, t] = await Promise.all([
        listPlaybackHistory(channelId),
        canManage ? listChannelAuditLog(channelId) : Promise.resolve({ results: [] }),
        listChannelSuggestions(channelId, suggestionFilter || undefined),
        listTracks(),
      ]);
      setHistory(h.results);
      setAudit(a.results);
      setSuggestions(s.results);
      setTracks(t);
      if (currentTrackId) {
        const r = await listTrackReactions(channelId, currentTrackId);
        setReactions(r.results);
      } else {
        setReactions([]);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not load insights.", "error");
    }
  }, [channelId, canManage, currentTrackId, suggestionFilter, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitSuggestion() {
    if (!suggestTrackId) return;
    try {
      await createChannelSuggestion(channelId, { track_id: Number(suggestTrackId), note: suggestNote.trim() });
      setSuggestNote("");
      showToast("Suggestion sent to moderators.", "success");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Suggestion failed.", "error");
    }
  }

  async function review(id: number, action: "approve" | "reject") {
    try {
      await reviewChannelSuggestion(channelId, { suggestion_id: id, action });
      showToast(action === "approve" ? "Added to queue." : "Suggestion rejected.", "success");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Review failed.", "error");
    }
  }

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
      const key = row.track_title ?? `track-${row.track_id ?? row.id}`;
      const prev = counts.get(key);
      counts.set(key, { title: row.track_title ?? key, count: (prev?.count ?? 0) + 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [history]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-emerald-900/30 bg-gradient-to-br from-zinc-950 to-emerald-950/15 lg:col-span-2">
        <CardHeader className="border-b border-zinc-800/80 pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="size-5 text-emerald-400" />
            Party recap
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {recapTop.length === 0 ? (
            <p className="text-sm text-zinc-500">Play some tracks to build tonight&apos;s recap.</p>
          ) : (
            <ol className="space-y-1 text-sm">
              {recapTop.map((t, i) => (
                <li key={t.title} className="flex justify-between gap-2">
                  <span>
                    {i + 1}. {t.title}
                  </span>
                  <span className="text-emerald-400/90">×{t.count}</span>
                </li>
              ))}
            </ol>
          )}
          <Link href={`/party/${channelId}`} className="text-xs text-emerald-400 hover:underline">
            Public recap page →
          </Link>
        </CardContent>
      </Card>
      <Card className="border-zinc-800/90 lg:col-span-2">
        <CardHeader className="border-b border-zinc-800/80 pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="size-5 text-amber-400" />
            Track suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex flex-wrap gap-2">
            <Select value={suggestionFilter} onChange={(e) => setSuggestionFilter(e.target.value as typeof suggestionFilter)} className="w-40 border-zinc-800 bg-zinc-900">
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="">All</option>
            </Select>
            <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={suggestTrackId} onChange={(e) => setSuggestTrackId(e.target.value)} className="min-w-[200px] flex-1 border-zinc-800 bg-zinc-900">
              <option value="">Pick a track to suggest…</option>
              {tracks.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.title}
                  {t.artist ? ` — ${t.artist}` : ""}
                </option>
              ))}
            </Select>
            <Input placeholder="Note (optional)" value={suggestNote} onChange={(e) => setSuggestNote(e.target.value)} className="max-w-xs border-zinc-800 bg-zinc-900" maxLength={280} />
            <Button type="button" onClick={() => void submitSuggestion()} disabled={!suggestTrackId}>
              Suggest
            </Button>
          </div>
          <ScrollArea className="h-48">
            <ul className="space-y-2 pr-3 text-sm">
              {suggestions.length === 0 ? <li className="text-zinc-500">No suggestions in this filter.</li> : null}
              {suggestions.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2">
                  <span>
                    Track #{s.track}
                    {s.note ? ` — ${s.note}` : ""}
                    <Badge variant="secondary" className="ml-2">
                      {s.status}
                    </Badge>
                  </span>
                  {canManage && s.status === "pending" ? (
                    <span className="flex gap-1">
                      <Button type="button" size="sm" onClick={() => void review(s.id, "approve")}>
                        Approve
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => void review(s.id, "reject")}>
                        Reject
                      </Button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-zinc-800/90">
        <CardHeader className="border-b border-zinc-800/80 pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="size-5 text-sky-400" />
            Playback history
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ScrollArea className="h-56">
            <ul className="space-y-1 pr-3 font-mono text-xs text-zinc-400">
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

      <Card className="border-zinc-800/90">
        <CardHeader className="border-b border-zinc-800/80 pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ThumbsUp className="size-5 text-rose-400" />
            Track reactions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="flex gap-2">
            <Input value={reactionEmoji} onChange={(e) => setReactionEmoji(e.target.value)} maxLength={8} className="w-20 border-zinc-800 bg-zinc-900" />
            <Button type="button" size="sm" onClick={() => void postReaction()} disabled={!currentTrackId}>
              React to now playing
            </Button>
          </div>
          <ScrollArea className="h-40">
            <ul className="space-y-1 text-sm text-zinc-300">
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
        <Card className="border-zinc-800/90 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between border-b border-zinc-800/80 pb-3">
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
              <ul className="space-y-1 pr-3 font-mono text-xs text-zinc-400">
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
