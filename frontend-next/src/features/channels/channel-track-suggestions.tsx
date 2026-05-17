"use client";

import { Lightbulb } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-provider";
import { useChannelQueue } from "@/features/channels/channel-queue-context";
import {
  createChannelSuggestion,
  listChannelSuggestions,
  listTracks,
  reviewChannelSuggestion,
  type ChannelPlaylistSuggestion,
  type TrackSummary,
} from "@/lib/api";

type Props = {
  channelId: string;
  canManage: boolean;
};

export function ChannelTrackSuggestions({ channelId, canManage }: Props) {
  const { showToast } = useToast();
  const { refreshQueue } = useChannelQueue();
  const [suggestions, setSuggestions] = useState<ChannelPlaylistSuggestion[]>([]);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [suggestTrackId, setSuggestTrackId] = useState("");
  const [suggestNote, setSuggestNote] = useState("");
  const [suggestionFilter, setSuggestionFilter] = useState<"" | "pending" | "approved" | "rejected">("pending");

  const load = useCallback(async () => {
    const [s, t] = await Promise.all([
      listChannelSuggestions(channelId, suggestionFilter || undefined),
      listTracks(),
    ]);
    setSuggestions(s.results);
    setTracks(t);
  }, [channelId, suggestionFilter]);

  useEffect(() => {
    void load().catch((e) => showToast(e instanceof Error ? e.message : "Could not load suggestions.", "error"));
  }, [load, showToast]);

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
      await refreshQueue();
      showToast(action === "approve" ? "Queued as next up after the current track." : "Suggestion rejected.", "success");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Review failed.", "error");
    }
  }

  return (
    <Card className="border-border/90">
      <CardHeader className="border-b border-border/80 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="size-5 text-amber-400" />
          Track suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap gap-2">
          <Select
            value={suggestionFilter}
            onChange={(e) => setSuggestionFilter(e.target.value as typeof suggestionFilter)}
            className="w-40 border-border bg-card"
          >
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
          <Select
            value={suggestTrackId}
            onChange={(e) => setSuggestTrackId(e.target.value)}
            className="min-w-[200px] flex-1 border-border bg-card"
          >
            <option value="">Pick a track to suggest…</option>
            {tracks.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.title}
                {t.artist ? ` — ${t.artist}` : ""}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Note (optional)"
            value={suggestNote}
            onChange={(e) => setSuggestNote(e.target.value)}
            className="max-w-xs border-border bg-card"
            maxLength={280}
          />
          <Button type="button" onClick={() => void submitSuggestion()} disabled={!suggestTrackId}>
            Suggest
          </Button>
        </div>
        <ScrollArea className="max-h-56">
          <ul className="space-y-2 pr-3 text-sm">
            {suggestions.length === 0 ? <li className="text-muted-foreground">No suggestions in this filter.</li> : null}
            {suggestions.map((s) => {
              const title = tracks.find((t) => t.id === s.track)?.title ?? `Track #${s.track}`;
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-card/40 px-3 py-2"
                >
                  <span>
                    {title}
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
              );
            })}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
