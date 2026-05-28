"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Shield } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast-provider";
import { dismissModerationReport, listModerationReports } from "@/lib/api";
import { adminSectionLabel } from "@/features/channels/components/channel-admin-panel-styles";

type Props = { channelId: string };

export function ChannelModerationReports({ channelId }: Props) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [rows, setRows] = useState<
    Array<{
      id: number;
      message_id: number;
      message_body: string;
      message_username: string;
      reporter_username: string;
      reason: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listModerationReports(channelId);
      setRows(data.results);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!rows.length) return null;

  return (
    <div className="mt-6 space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4" data-testid="channel-moderation-reports">
      <p className={adminSectionLabel}>
        <Shield className="inline h-3.5 w-3.5 me-1" />
        {t("room.moderation.reports")}
      </p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-sm">
            <p className="text-foreground">
              <span className="text-muted-foreground">@{r.reporter_username}</span> → @{r.message_username}:{" "}
              {r.message_body || "…"}
            </p>
            {r.reason ? <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p> : null}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-2 h-7"
              onClick={async () => {
                try {
                  await dismissModerationReport(channelId, r.id);
                  showToast(t("room.moderation.dismiss"), "success");
                  void load();
                } catch (e) {
                  showToast(e instanceof Error ? e.message : "Failed", "error");
                }
              }}
            >
              {t("room.moderation.dismiss")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
