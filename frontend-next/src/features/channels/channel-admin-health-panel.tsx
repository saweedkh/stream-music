"use client";

import { Activity, HeartPulse, Server } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { ChannelAdminInlineShell } from "@/features/channels/channel-admin-inline-shell";
import { adminSectionLabel } from "@/features/channels/channel-admin-panel-styles";
import type { getApiMetrics } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  startedAtText: string;
  pausedAtText: string;
  rttMs: number | null;
  jitterMs: number | null;
  reconnectCount: number;
  clockOffsetMs: number | null;
  apiMetrics: Awaited<ReturnType<typeof getApiMetrics>> | null;
  embedded?: boolean;
};

export function ChannelAdminHealthPanel({
  startedAtText,
  pausedAtText,
  rttMs,
  jitterMs,
  reconnectCount,
  clockOffsetMs,
  apiMetrics,
  embedded = true,
}: Props) {
  const { t } = useTranslations();

  const sessionMetrics = [
    { labelKey: "room.admin.health.sessionStarted" as const, value: startedAtText },
    { labelKey: "room.admin.health.pausedAt" as const, value: pausedAtText },
    { labelKey: "room.admin.health.rtt" as const, value: rttMs != null ? `${rttMs}ms` : "—" },
    { labelKey: "room.admin.health.jitter" as const, value: jitterMs != null ? `${jitterMs}ms` : "—" },
    { labelKey: "room.admin.health.reconnects" as const, value: String(reconnectCount) },
    { labelKey: "room.admin.health.clockOffset" as const, value: clockOffsetMs != null ? `${clockOffsetMs}ms` : "—" },
  ];

  const body = (
    <div className="space-y-6 px-1 pb-2">
      <section>
        <p className={adminSectionLabel}>{t("room.admin.health.session")}</p>
        <ul className="mt-2 space-y-0.5">
          {sessionMetrics.map((row) => (
            <li
              key={row.labelKey}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/30"
            >
              <span className="text-sm text-muted-foreground">{t(row.labelKey)}</span>
              <span className="font-mono text-sm text-foreground">{row.value}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className={cn(adminSectionLabel, "flex items-center gap-2")}>
          <Server className="size-3.5" aria-hidden />
          {t("room.admin.health.server")}
        </p>
        {apiMetrics ? (
          <ul className="mt-2 space-y-0.5">
            {[
              { labelKey: "room.admin.health.activeChannels" as const, value: apiMetrics.channels_active },
              { labelKey: "room.admin.health.playing" as const, value: apiMetrics.channels_playing },
              { labelKey: "room.admin.health.tracks" as const, value: apiMetrics.tracks_total },
              { labelKey: "room.admin.health.users" as const, value: apiMetrics.users_active },
            ].map((row) => (
              <li
                key={row.labelKey}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/30"
              >
                <span className="text-sm text-muted-foreground">{t(row.labelKey)}</span>
                <span className="font-mono text-sm text-foreground">{row.value}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 flex items-center gap-2 rounded-lg px-2 py-6 text-sm text-muted-foreground">
            <Activity className="size-4 shrink-0" aria-hidden />
            {t("room.admin.health.serverUnavailable")}
          </p>
        )}
      </section>
    </div>
  );

  if (!embedded) {
    return body;
  }

  return (
    <ChannelAdminInlineShell
      icon={HeartPulse}
      title={t("room.admin.tab.health.title")}
      subtitle={t("room.admin.tab.health.description")}
    >
      {body}
    </ChannelAdminInlineShell>
  );
}
