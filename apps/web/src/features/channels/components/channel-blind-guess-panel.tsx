"use client";

import { Eye, Loader2, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import {
  listChannelBlindGuesses,
  submitChannelBlindGuess,
  type ChannelBlindGuessRow,
} from "@/lib/api";
import { listenerItemClass } from "@/features/channels/components/channel-listener-panel-styles";
import { cn } from "@/lib/utils";

type Props = {
  channelId: string;
  currentTrackId?: number | null;
  canReveal?: boolean;
};

export function ChannelBlindGuessPanel({ channelId, currentTrackId, canReveal = false }: Props) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ChannelBlindGuessRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!currentTrackId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const res = await listChannelBlindGuesses(channelId, currentTrackId);
      setRows(res.results);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [channelId, currentTrackId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(reveal = false) {
    if (!currentTrackId) {
      showToast(t("room.blindGuess.noTrack"), "info");
      return;
    }
    const text = guess.trim();
    if (!text && !reveal) return;
    setBusy(true);
    try {
      const res = await submitChannelBlindGuess(channelId, {
        track_id: currentTrackId,
        guess: text || "—",
        reveal,
      });
      if (reveal && res.score > 0) {
        showToast(t("room.blindGuess.revealedScore", { score: res.score }), "success");
      } else if (!reveal) {
        showToast(t("room.blindGuess.saved"), "success");
        setGuess("");
      } else {
        showToast(t("room.blindGuess.revealed"), "success");
      }
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("room.blindGuess.failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={cn("space-y-3", listenerItemClass, "p-4 sm:p-5")}
      data-testid="channel-blind-guess-panel"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand" aria-hidden />
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {t("room.blindGuess.title")}
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">{t("room.blindGuess.hint")}</p>
      <div className="flex flex-wrap gap-2">
        <Input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder={t("room.blindGuess.placeholder")}
          maxLength={255}
          disabled={!currentTrackId || busy}
          className="min-w-[12rem] flex-1 border-border bg-card/80"
          data-testid="blind-guess-input"
        />
        <Button
          type="button"
          size="sm"
          disabled={!currentTrackId || busy || !guess.trim()}
          onClick={() => void submit(false)}
          data-testid="blind-guess-submit"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {t("room.blindGuess.submit")}
        </Button>
        {canReveal ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!currentTrackId || busy}
            onClick={() => void submit(true)}
            data-testid="blind-guess-reveal"
          >
            <Eye className="h-4 w-4" />
            {t("room.blindGuess.reveal")}
          </Button>
        ) : null}
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : rows.length > 0 ? (
        <ol className="space-y-1 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/30">
              <span className="truncate">
                @{r.username}: {r.guess_text}
              </span>
              {r.revealed_at ? (
                <span className="shrink-0 font-medium text-brand">{r.score}</span>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">{t("room.blindGuess.hidden")}</span>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-muted-foreground">{t("room.blindGuess.empty")}</p>
      )}
    </section>
  );
}
