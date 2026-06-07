"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, Headphones, Trophy, Users } from "lucide-react";
import { AdminStatCard } from "@/features/admin/components/admin-stat-card";
import { AdminDataTable, AdminTableShell } from "@/features/admin/components/admin-table-shell";
import { useAdminPaginatedList } from "@/features/admin/hooks/use-admin-paginated-list";
import {
  getAdminAnalyticsOverview,
  listAdminAnalyticsChannels,
  listAdminGamificationProfiles,
} from "@/lib/api/admin";
import type { AdminAnalyticsOverview } from "@/lib/api/types/admin";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { useToast } from "@/shared/ui/toast-provider";

export function AdminAnalyticsSection() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [overview, setOverview] = useState<AdminAnalyticsOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);

  const channelFetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminAnalyticsChannels(opts),
    [],
  );
  const gamificationFetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminGamificationProfiles(opts),
    [],
  );
  const channels = useAdminPaginatedList(channelFetcher);
  const gamification = useAdminPaginatedList(gamificationFetcher);

  useEffect(() => {
    void getAdminAnalyticsOverview()
      .then(setOverview)
      .catch(() => showToast(t("admin.loadFailed"), "error"))
      .finally(() => setLoadingOverview(false));
  }, [showToast, t]);

  const channelRows = useMemo(
    () =>
      channels.rows.map((row) => ({
        channel: (
          <Link href={`/channel/${row.channel_id}`} className="font-medium text-brand hover:underline">
            {row.channel_name}
          </Link>
        ),
        owner: row.owner_username ? `@${row.owner_username}` : "—",
        hours: `${row.total_listen_hours}h`,
        listeners: String(row.unique_listeners),
        plays: String(row.total_play_events),
      })),
    [channels.rows],
  );

  const gamificationRows = useMemo(
    () =>
      gamification.rows.map((row) => ({
        user: `@${row.username}`,
        points: String(row.points),
        level: String(row.level),
        streak: `${row.streak_days}d`,
        listen: `${row.lifetime_listen_hours}h`,
      })),
    [gamification.rows],
  );

  if (loadingOverview && !overview) return <Skeleton className="h-80 w-full rounded-2xl" />;

  return (
    <div className="space-y-4">
      {overview ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard
              label={t("admin.analytics.listenHours")}
              value={overview.listen.total_listen_hours}
              sub={t("admin.analytics.playEvents", { count: overview.listen.total_play_events })}
              icon={Headphones}
              accent="brand"
            />
            <AdminStatCard
              label={t("admin.analytics.uniqueListeners")}
              value={overview.listen.unique_listeners_platform}
              icon={Users}
              accent="emerald"
            />
            <AdminStatCard
              label={t("admin.analytics.gamificationProfiles")}
              value={overview.gamification.profiles_total}
              sub={t("admin.analytics.totalPoints", { count: overview.gamification.total_points_awarded })}
              icon={Trophy}
              accent="amber"
            />
            <AdminStatCard
              label={t("admin.analytics.pointEvents30d")}
              value={overview.gamification.point_events_30d}
              sub={t("admin.analytics.activeStreaks", { count: overview.gamification.active_streaks })}
              icon={BarChart3}
              accent="violet"
            />
          </div>

          {overview.top_channels.length > 0 ? (
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("admin.analytics.topChannels")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {overview.top_channels.map((ch, index) => (
                    <li
                      key={ch.channel_id}
                      className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="me-2 text-muted-foreground">#{index + 1}</span>
                        <Link href={`/channel/${ch.channel_id}`} className="font-medium text-brand hover:underline">
                          {ch.channel_name}
                        </Link>
                      </span>
                      <span className="text-muted-foreground">
                        {ch.total_listen_hours}h · {ch.unique_listeners} {t("admin.analytics.listeners")}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      <AdminTableShell
        title={t("admin.analytics.channelsTitle")}
        description={t("admin.analytics.channelsDescription", { total: String(channels.total) })}
        searchPlaceholder={t("admin.searchChannels")}
        search={channels.search}
        onSearchChange={channels.setSearch}
        onSearchSubmit={channels.submitSearch}
        onRefresh={() => void channels.reload()}
        loading={channels.loading}
        total={channels.total}
        page={channels.page}
        pageCount={channels.pageCount}
        onPrevPage={channels.prevPage}
        onNextPage={channels.nextPage}
      >
        <AdminDataTable
          loading={channels.loading}
          emptyMessage={t("admin.empty")}
          columns={[
            { key: "channel", header: t("channels.name") },
            { key: "owner", header: t("admin.col.owner") },
            { key: "hours", header: t("admin.analytics.listenHours") },
            { key: "listeners", header: t("admin.analytics.listeners") },
            { key: "plays", header: t("admin.analytics.plays") },
          ]}
          rows={channelRows}
        />
      </AdminTableShell>

      <AdminTableShell
        title={t("admin.analytics.gamificationTitle")}
        description={t("admin.analytics.gamificationDescription", { total: String(gamification.total) })}
        searchPlaceholder={t("admin.searchUsers")}
        search={gamification.search}
        onSearchChange={gamification.setSearch}
        onSearchSubmit={gamification.submitSearch}
        onRefresh={() => void gamification.reload()}
        loading={gamification.loading}
        total={gamification.total}
        page={gamification.page}
        pageCount={gamification.pageCount}
        onPrevPage={gamification.prevPage}
        onNextPage={gamification.nextPage}
      >
        <AdminDataTable
          loading={gamification.loading}
          emptyMessage={t("admin.empty")}
          columns={[
            { key: "user", header: t("admin.col.user") },
            { key: "points", header: t("admin.analytics.points") },
            { key: "level", header: t("admin.analytics.level") },
            { key: "streak", header: t("admin.analytics.streak") },
            { key: "listen", header: t("admin.analytics.listenHours") },
          ]}
          rows={gamificationRows}
        />
      </AdminTableShell>
    </div>
  );
}
