"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, LayoutGrid, Music, Radio, Shield, Users } from "lucide-react";
import { AdminStatCard } from "@/features/admin/components/admin-stat-card";
import { getAdminHealth, getAdminOverview, type AdminSystemHealth } from "@/lib/api/admin";
import type { AdminOverview } from "@/lib/api/types/admin";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { useToast } from "@/shared/ui/toast-provider";

export function AdminOverviewSection() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [health, setHealth] = useState<AdminSystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, h] = await Promise.all([getAdminOverview(), getAdminHealth()]);
      setOverview(ov);
      setHealth(h);
    } catch {
      showToast(t("admin.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !overview) return <Skeleton className="h-80 w-full rounded-2xl" />;
  if (!overview) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <AdminStatCard label={t("admin.stat.users")} value={overview.users.total} sub={t("admin.stat.usersActive", { count: overview.users.active })} icon={Users} />
        <AdminStatCard label={t("admin.stat.channels")} value={overview.channels.total} sub={t("admin.stat.channelsLive", { count: overview.channels.playing })} icon={Radio} accent="amber" />
        <AdminStatCard label={t("admin.stat.tracks")} value={overview.tracks_total} icon={Music} accent="emerald" />
        <AdminStatCard label={t("admin.stat.playlists")} value={overview.playlists_total} icon={LayoutGrid} accent="violet" />
        <AdminStatCard label={t("admin.stat.staff")} value={overview.users.staff} sub={t("admin.stat.superusers", { count: overview.users.superuser })} icon={Shield} />
        <AdminStatCard label={t("admin.stat.memberships")} value={overview.memberships_active} icon={Users} accent="amber" />
      </div>
      {health ? (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-brand" aria-hidden />
              {t("admin.healthQuick")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant={health.status === "ok" ? "success" : "warning"}>{health.status}</Badge>
            <Badge variant={health.db ? "success" : "warning"}>DB</Badge>
            <Badge variant={health.redis ? "success" : "warning"}>Redis</Badge>
            <Badge variant="secondary">{t("admin.metric.listeners")}: {health.realtime.listeners_in_presence}</Badge>
            <Badge variant="secondary">{t("admin.metric.mediaGb")}: {health.media_audio_gb}</Badge>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
