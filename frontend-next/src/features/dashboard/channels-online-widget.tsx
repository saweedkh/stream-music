"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Radio, Users } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-provider";
import { getMeChannelsOnline, type ChannelsOnlineRow } from "@/lib/api";

export function ChannelsOnlineWidget() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [rows, setRows] = useState<ChannelsOnlineRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMeChannelsOnline();
      setRows(data.results);
      setTotal(data.total_online);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("dashboard.online.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <Card className="border-border/90 bg-card/60" data-testid="dashboard-channels-online">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-brand" />
          {t("dashboard.online.title")}
        </CardTitle>
        {total > 0 ? (
          <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand">
            {t("dashboard.online.total", { count: total })}
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("dashboard.online.empty")}</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.channel.id}
                className="rounded-xl border border-border/70 bg-background/40 px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/channel/${row.channel.id}`}
                    className="truncate font-medium text-foreground hover:text-brand"
                  >
                    {row.channel.name}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    {(row.pending_suggestions ?? 0) > 0 ? (
                      <Link
                        href={`/channel/${row.channel.id}?tab=suggestions`}
                        className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
                      >
                        {t("room.admin.suggestions.pendingBadge", { count: row.pending_suggestions ?? 0 })}
                      </Link>
                    ) : null}
                    <span className="text-xs text-brand">
                      {t("dashboard.online.inRoom", { count: row.online_count })}
                    </span>
                  </div>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {row.members.map((m) => `@${m.username}`).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
