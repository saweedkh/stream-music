"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";

type Props = {
  isPlaying: boolean;
  isBuffering: boolean;
  socketState: string;
  syncDeltaMs: number;
  lastSyncAt: number | null;
  introRemainingSec: number | null;
  introCapSec: number;
  canControl: boolean;
  rehearsalMuted: boolean;
  rehearsalLiftActive: boolean;
  onRefreshSync?: () => void;
};

export function ChannelPlayerStatusBadges({
  isPlaying,
  isBuffering,
  socketState,
  syncDeltaMs,
  lastSyncAt,
  introRemainingSec,
  introCapSec,
  canControl,
  rehearsalMuted,
  rehearsalLiftActive,
  onRefreshSync,
}: Props) {
  const { t } = useTranslations();

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      <Badge variant={isPlaying ? "success" : "warning"}>{isPlaying ? t("player.status.playing") : t("player.status.paused")}</Badge>
      {isBuffering ? (
        <Badge variant="secondary" className="text-[10px] sm:text-xs">
          {t("player.status.buffering")}
        </Badge>
      ) : null}
      <Badge variant={socketState === "connected" ? "success" : "warning"}>{socketState}</Badge>
      <Badge
        className={cn("text-[10px] sm:text-xs", Math.abs(syncDeltaMs) > 240 && "border-amber-500/40 bg-[var(--warning-subtle)] text-amber-100")}
        title={t("player.status.syncDeltaTitle")}
      >
        Δ {syncDeltaMs}ms
      </Badge>
      {introRemainingSec != null ? (
        <Badge variant="secondary" className="max-w-[220px] truncate text-[10px] sm:text-xs">
          {t("player.status.introLeft", { seconds: introRemainingSec })}
        </Badge>
      ) : introCapSec > 0 && !canControl ? (
        <Badge variant="secondary" className="max-w-[220px] truncate text-[10px] sm:text-xs">
          {t("player.status.introEnded")}
        </Badge>
      ) : null}
      <Badge className="hidden max-w-full truncate sm:inline-flex sm:max-w-none">
        {lastSyncAt ? t("player.status.syncAt", { time: new Date(lastSyncAt).toLocaleTimeString() }) : t("player.status.syncPending")}
      </Badge>
      {rehearsalMuted ? <p className="w-full text-xs text-warning/90">{t("player.status.rehearsalMuted")}</p> : null}
      {!rehearsalMuted && rehearsalLiftActive ? (
        <p className="w-full text-xs text-brand/90">{t("player.status.rehearsalLift")}</p>
      ) : null}
      {canControl && onRefreshSync ? (
        <Button type="button" variant="secondary" className="h-9 w-full px-3 text-xs sm:h-8 sm:w-auto" onClick={onRefreshSync}>
          {t("player.status.refreshSync")}
        </Button>
      ) : null}
    </div>
  );
}
