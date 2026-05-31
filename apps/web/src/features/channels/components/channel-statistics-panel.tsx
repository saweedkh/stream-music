"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Clock, Users } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import {
  getChannelStatistics,
  getChannelStatisticsDetailed,
  type ChannelDetailedStatistics,
  type ChannelPublicStatistics,
} from "@/lib/api/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Loader2 } from "lucide-react";

type Props = {
  channelId: string;
  canViewDetailed?: boolean;
};

export function ChannelStatisticsPanel({ channelId, canViewDetailed = false }: Props) {
  const { t } = useTranslations();
  const [publicStats, setPublicStats] = useState<ChannelPublicStatistics | null>(null);
  const [detailed, setDetailed] = useState<ChannelDetailedStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPublicStats(await getChannelStatistics(channelId));
      if (canViewDetailed) {
        try {
          setDetailed(await getChannelStatisticsDetailed(channelId));
        } catch {
          setDetailed(null);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [channelId, canViewDetailed]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!publicStats) return null;

  return (
    <Card className="border-border/90" data-testid="channel-statistics-panel">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-brand" />
          {t("stats.channelTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {t("stats.listenHours")}
            </p>
            <p className="text-lg font-semibold tabular-nums">{publicStats.total_listen_hours}</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">{t("stats.playEvents")}</p>
            <p className="text-lg font-semibold tabular-nums">{publicStats.total_play_events}</p>
          </div>
          <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {t("stats.uniqueListeners")}
            </p>
            <p className="text-lg font-semibold tabular-nums">{publicStats.unique_listeners}</p>
          </div>
        </div>
        {detailed?.top_tracks?.length ? (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">{t("stats.topTracksPremium")}</p>
            <ul className="space-y-1">
              {detailed.top_tracks.slice(0, 5).map((tr) => (
                <li key={tr.track_id} className="truncate text-foreground/90">
                  {tr.title}
                  {tr.artist ? ` — ${tr.artist}` : ""}{" "}
                  <span className="text-muted-foreground">({Math.round(tr.listen_seconds / 60)}m)</span>
                </li>
              ))}
            </ul>
          </div>
        ) : canViewDetailed ? (
          <p className="text-xs text-muted-foreground">{t("stats.premiumDetailHint")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
