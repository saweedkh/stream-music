"use client";

import { useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { ChannelQueuePanel } from "@/features/channels/channel-queue-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-provider";
import { importShareToChannelQueue } from "@/lib/api";

type Props = {
  channelId: string;
  readOnly?: boolean;
  currentTrackId?: number | null;
};

export function ChannelAdminQueuePanel({ channelId, readOnly, currentTrackId = null }: Props) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [shareToken, setShareToken] = useState("");
  const [importing, setImporting] = useState(false);

  async function handleImportShare() {
    const raw = shareToken.trim();
    const token = raw.includes("/share/playlist/") ? raw.split("/share/playlist/").pop()?.split(/[?#]/)[0] ?? raw : raw;
    if (!token) return;
    setImporting(true);
    try {
      const res = await importShareToChannelQueue(channelId, token);
      showToast(t("room.admin.queue.importShareDone", { count: res.added }), "success");
      setShareToken("");
      window.dispatchEvent(new CustomEvent("channel-playback-updated", { detail: { channelId } }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Import failed", "error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {!readOnly ? (
        <div className="shrink-0 rounded-xl border border-border/60 bg-card/40 p-3">
          <p className="text-sm font-medium text-foreground">{t("room.admin.queue.importShare")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("room.admin.queue.importShareHint")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Input
              value={shareToken}
              onChange={(e) => setShareToken(e.target.value)}
              placeholder="/share/playlist/…"
              className="min-w-[200px] flex-1 border-border bg-card/80"
            />
            <Button type="button" size="sm" disabled={importing || !shareToken.trim()} onClick={() => void handleImportShare()}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {t("room.admin.queue.importShare")}
            </Button>
          </div>
        </div>
      ) : null}
      <ChannelQueuePanel
        channelId={channelId}
        readOnly={readOnly}
        variant="admin"
        embedded
        currentTrackId={currentTrackId}
      />
    </div>
  );
}
