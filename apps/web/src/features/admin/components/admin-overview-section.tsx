"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, ChevronRight, Headphones, LayoutGrid, MessageSquareWarning, Music, Radio, Shield, Sparkles, UserPlus, Users } from "lucide-react";
import { AdminStatCard } from "@/features/admin/components/admin-stat-card";
import { ADMIN_NAV, adminSectionHref } from "@/features/admin/model/admin-nav";
import { getAdminHealth, getAdminOverview, type AdminSystemHealth } from "@/lib/api/admin";
import type { AdminOverview } from "@/lib/api/types/admin";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { useToast } from "@/shared/ui/toast-provider";
import { cn } from "@/lib/utils";

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

  const pending = overview.pending;
  const alertItems = pending
    ? [
        {
          key: "support",
          href: adminSectionHref("support"),
          icon: Headphones,
          label: t("admin.pending.support"),
          count: pending.support.open,
          urgent: pending.support.urgent,
        },
        {
          key: "moderation",
          href: adminSectionHref("moderation"),
          icon: MessageSquareWarning,
          label: t("admin.pending.moderation"),
          count: pending.chat_reports_open,
        },
        {
          key: "joinRequests",
          href: adminSectionHref("joinRequests"),
          icon: UserPlus,
          label: t("admin.pending.joinRequests"),
          count: pending.join_requests_pending,
        },
        {
          key: "suggestions",
          href: adminSectionHref("suggestions"),
          icon: Sparkles,
          label: t("admin.pending.suggestions"),
          count: pending.suggestions_pending,
        },
        {
          key: "live",
          href: adminSectionHref("live"),
          icon: Radio,
          label: t("admin.pending.live"),
          count: pending.channels_playing,
        },
      ].filter((item) => item.count > 0)
    : [];

  return (
    <div className="space-y-4">
      {alertItems.length > 0 ? (
        <Card className="border-amber-500/25 bg-gradient-to-br from-amber-500/[0.06] to-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
              {t("admin.pendingTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {alertItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-card/60 px-3 py-2.5 text-sm transition-colors hover:bg-amber-500/10"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-amber-600" aria-hidden />
                        {item.label}
                      </span>
                      <Badge variant={item.urgent ? "warning" : "secondary"}>{item.count}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

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

      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("admin.quickLinks")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {ADMIN_NAV.filter((item) => item.id !== "overview").map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <Link
                    href={adminSectionHref(item.id)}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl border border-border/60 bg-card/50 px-3 py-2.5 text-sm font-medium transition-colors hover:border-amber-500/30 hover:bg-amber-500/[0.06]",
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground group-hover:bg-amber-500/15 group-hover:text-amber-700 dark:group-hover:text-amber-300">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60 group-hover:text-amber-600" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
