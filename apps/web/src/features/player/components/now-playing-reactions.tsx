"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { addTrackReaction, listTrackReactions, type ChannelTrackReactionRow } from "@/lib/api";
import { cn } from "@/lib/utils";

const QUICK = ["🔥", "❤️", "👏", "🎉", "😂"];

type Props = {
  channelId: string;
  trackId: number | null | undefined;
  compact?: boolean;
};

export function NowPlayingReactions({ channelId, trackId, compact = false }: Props) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [rows, setRows] = useState<ChannelTrackReactionRow[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!trackId) {
      setRows([]);
      return;
    }
    try {
      const res = await listTrackReactions(channelId, trackId);
      setRows(res.results);
    } catch {
      setRows([]);
    }
  }, [channelId, trackId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function react(emoji: string) {
    if (!trackId) return;
    setBusy(true);
    try {
      await addTrackReaction(channelId, { track_id: trackId, emoji });
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("reactions.failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  if (!trackId) return null;

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.emoji, (counts.get(row.emoji) ?? 0) + 1);
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1",
        compact ? "justify-center" : "mt-2",
      )}
      role="group"
      aria-label={t("reactions.nowPlaying")}
    >
      {QUICK.map((emoji) => (
        <button
          key={emoji}
          type="button"
          disabled={busy}
          className={cn(
            "rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-sm transition hover:bg-brand/10",
            compact && "px-1.5 text-xs",
          )}
          onClick={() => void react(emoji)}
        >
          {emoji}
          {counts.get(emoji) ? <span className="ms-0.5 text-[10px] text-muted-foreground">{counts.get(emoji)}</span> : null}
        </button>
      ))}
    </div>
  );
}
