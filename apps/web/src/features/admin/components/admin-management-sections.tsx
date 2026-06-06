"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Loader2, Plus, Radio, Server, Trash2 } from "lucide-react";
import { AdminDataTable, AdminTableShell } from "@/features/admin/components/admin-table-shell";
import { AdminStatCard } from "@/features/admin/components/admin-stat-card";
import { useAdminPaginatedList } from "@/features/admin/hooks/use-admin-paginated-list";
import {
  createAdminBadge,
  deleteAdminBadge,
  getAdminHealth,
  listAdminBadges,
  listAdminChannels,
  listAdminUsers,
  patchAdminBadge,
  patchAdminChannel,
  patchAdminUser,
  type AdminSystemHealth,
} from "@/lib/api/admin";
import type { AdminBadgeDefinition, AdminUserRow } from "@/lib/api/types/admin";
import { manualBadgeSlugsForUser } from "@/lib/user-badges";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { UsernameWithBadges } from "@/shared/ui/user-verified-badge";
import { useToast } from "@/shared/ui/toast-provider";

const BADGE_ICONS = ["badge-check", "crown", "sparkles", "star", "shield", "music", "heart", "zap", "gem"] as const;
const BADGE_COLORS = ["sky", "amber", "violet", "emerald", "rose", "brand", "slate"] as const;

function isManualBadgeSlug(slug: string) {
  return slug !== "platform_superuser" && slug !== "platform_staff";
}

export function AdminUsersSection() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [badgeDefs, setBadgeDefs] = useState<AdminBadgeDefinition[]>([]);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const fetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminUsers(opts),
    [],
  );
  const list = useAdminPaginatedList(fetcher);

  useEffect(() => {
    void listAdminBadges().then((d) => setBadgeDefs(d.results)).catch(() => {});
  }, []);

  const manualBadgeDefs = useMemo(
    () => badgeDefs.filter((b) => isManualBadgeSlug(b.slug) && b.is_active),
    [badgeDefs],
  );

  async function toggleUserFlag(user: AdminUserRow, field: "is_active" | "is_staff" | "is_superuser") {
    setBusyUserId(user.id);
    try {
      await patchAdminUser(user.id, { [field]: !user[field] });
      await list.reload();
      showToast(t("admin.userUpdated"), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("admin.loadFailed"), "error");
    } finally {
      setBusyUserId(null);
    }
  }

  const tableRows = useMemo(
    () =>
      list.rows.map((u) => ({
        user: (
          <div className="min-w-0">
            <UsernameWithBadges username={u.username} flags={u} size="sm" usernameClassName="text-sm font-semibold" />
            <p className="truncate text-xs text-muted-foreground">{u.email || "—"}</p>
            {u.is_premium ? <Badge variant="secondary" className="mt-1">{t("admin.premium")}</Badge> : null}
          </div>
        ),
        flags: (
          <div className="flex flex-col gap-2 text-xs">
            {(["is_active", "is_staff", "is_superuser"] as const).map((field) => (
              <label key={field} className="flex items-center gap-2">
                <Switch checked={u[field]} disabled={busyUserId === u.id} onCheckedChange={() => void toggleUserFlag(u, field)} />
                {field === "is_active" ? t("admin.active") : field === "is_staff" ? t("admin.staff") : t("admin.superuser")}
              </label>
            ))}
          </div>
        ),
        badges:
          manualBadgeDefs.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {manualBadgeDefs.map((defn) => {
                const active = manualBadgeSlugsForUser(manualBadgeDefs, u).includes(defn.slug);
                return (
                  <Button
                    key={defn.slug}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className="h-7 text-xs"
                    disabled={busyUserId === u.id}
                    onClick={async () => {
                      setBusyUserId(u.id);
                      try {
                        const current = manualBadgeSlugsForUser(manualBadgeDefs, u);
                        const next = active ? current.filter((s) => s !== defn.slug) : [...current, defn.slug];
                        await patchAdminUser(u.id, { badge_slugs: next });
                        await list.reload();
                      } finally {
                        setBusyUserId(null);
                      }
                    }}
                  >
                    {defn.label}
                  </Button>
                );
              })}
            </div>
          ) : (
            "—"
          ),
        meta: (
          <span className="text-xs text-muted-foreground">
            #{u.id}
            {u.last_login ? ` · ${new Date(u.last_login).toLocaleDateString()}` : ""}
          </span>
        ),
      })),
    [busyUserId, list.rows, manualBadgeDefs, t],
  );

  return (
    <AdminTableShell
      title={t("admin.usersTitle")}
      description={t("admin.usersDescription", { total: String(list.total) })}
      searchPlaceholder={t("admin.searchUsers")}
      search={list.search}
      onSearchChange={list.setSearch}
      onSearchSubmit={list.submitSearch}
      onRefresh={() => void list.reload()}
      loading={list.loading}
      total={list.total}
      page={list.page}
      pageCount={list.pageCount}
      onPrevPage={list.prevPage}
      onNextPage={list.nextPage}
    >
      <AdminDataTable
        loading={list.loading}
        emptyMessage={t("admin.emptyUsers")}
        columns={[
          { key: "user", header: t("admin.col.user") },
          { key: "flags", header: t("admin.col.permissions") },
          { key: "badges", header: t("admin.userBadges") },
          { key: "meta", header: t("admin.col.meta") },
        ]}
        rows={tableRows}
      />
    </AdminTableShell>
  );
}

export function AdminChannelsSection() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<number | null>(null);
  const fetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminChannels(opts),
    [],
  );
  const list = useAdminPaginatedList(fetcher);

  const tableRows = useMemo(
    () =>
      list.rows.map((ch) => ({
        name: (
          <div>
            <p className="font-medium">{ch.name}</p>
            <p className="text-xs text-muted-foreground">#{ch.id} · {ch.privacy}</p>
          </div>
        ),
        owner: ch.owner_username ? `@${ch.owner_username}` : "—",
        members: String(ch.member_count),
        status: (
          <div className="flex flex-wrap gap-1">
            {ch.is_playing ? <Badge variant="success">{t("channels.live")}</Badge> : null}
            {!ch.is_active ? <Badge variant="warning">{t("admin.channelSuspended")}</Badge> : null}
          </div>
        ),
        actions: (
          <div className="flex gap-2">
            <Switch checked={ch.is_active} disabled={busyId === ch.id} onCheckedChange={async () => {
              setBusyId(ch.id);
              try {
                await patchAdminChannel(ch.id, { is_active: !ch.is_active });
                await list.reload();
              } finally {
                setBusyId(null);
              }
            }} />
            <Button size="sm" variant="secondary" asChild>
              <Link href={`/channel/${ch.id}`}>{t("channels.enterRoom")}</Link>
            </Button>
          </div>
        ),
      })),
    [busyId, list.rows, t],
  );

  return (
    <AdminTableShell
      title={t("admin.channelsTitle")}
      description={t("admin.channelsDescription", { total: String(list.total) })}
      searchPlaceholder={t("admin.searchChannels")}
      search={list.search}
      onSearchChange={list.setSearch}
      onSearchSubmit={list.submitSearch}
      onRefresh={() => void list.reload()}
      loading={list.loading}
      total={list.total}
      page={list.page}
      pageCount={list.pageCount}
      onPrevPage={list.prevPage}
      onNextPage={list.nextPage}
    >
      <AdminDataTable
        loading={list.loading}
        columns={[
          { key: "name", header: t("channels.name") },
          { key: "owner", header: t("admin.col.owner") },
          { key: "members", header: t("admin.col.members") },
          { key: "status", header: t("admin.col.status") },
          { key: "actions", header: "" },
        ]}
        rows={tableRows}
      />
    </AdminTableShell>
  );
}

export function AdminBadgesSection() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [badgeDefs, setBadgeDefs] = useState<AdminBadgeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [newBadge, setNewBadge] = useState({ slug: "", label: "", description: "", icon: "star" as const, color: "emerald" as const, priority: "200" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBadgeDefs((await listAdminBadges()).results);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle>{t("admin.badgesCreate")}</CardTitle>
          <CardDescription>{t("admin.badgesDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Input placeholder={t("admin.badgesSlug")} value={newBadge.slug} onChange={(e) => setNewBadge((p) => ({ ...p, slug: e.target.value }))} />
          <Input placeholder={t("admin.badgesLabel")} value={newBadge.label} onChange={(e) => setNewBadge((p) => ({ ...p, label: e.target.value }))} />
          <Input className="sm:col-span-2" placeholder={t("admin.badgesDescriptionField")} value={newBadge.description} onChange={(e) => setNewBadge((p) => ({ ...p, description: e.target.value }))} />
          <Button type="button" disabled={busyId === -1} onClick={async () => {
            setBusyId(-1);
            try {
              await createAdminBadge({
                slug: newBadge.slug.trim().toLowerCase().replace(/\s+/g, "-"),
                label: newBadge.label.trim(),
                description: newBadge.description.trim(),
                icon: newBadge.icon,
                color: newBadge.color,
                priority: Number(newBadge.priority) || 200,
              });
              setNewBadge({ slug: "", label: "", description: "", icon: "star", color: "emerald", priority: "200" });
              await load();
              showToast(t("admin.badgesCreated"), "success");
            } catch (e) {
              showToast(e instanceof Error ? e.message : t("admin.loadFailed"), "error");
            } finally {
              setBusyId(null);
            }
          }}>
            <Plus className="h-4 w-4 me-1" /> {t("admin.badgesCreate")}
          </Button>
        </CardContent>
      </Card>
      <AdminTableShell title={t("admin.badgesTitle")} onRefresh={() => void load()} loading={loading}>
        <AdminDataTable
          loading={loading}
          columns={[
            { key: "label", header: t("admin.badgesLabel") },
            { key: "meta", header: t("admin.col.meta") },
            { key: "actions", header: "" },
          ]}
          rows={badgeDefs.map((defn) => ({
            label: <span className="font-medium">{defn.label} <span className="text-muted-foreground">({defn.slug})</span></span>,
            meta: `${defn.icon} · ${defn.color} · ${defn.priority}${defn.is_system ? ` · ${t("admin.badgesSystem")}` : ""}`,
            actions: (
              <div className="flex gap-2">
                <Switch checked={defn.is_active} disabled={defn.is_system || busyId === defn.id} onCheckedChange={async (checked) => {
                  setBusyId(defn.id);
                  try {
                    await patchAdminBadge(defn.id, { is_active: checked });
                    await load();
                  } finally {
                    setBusyId(null);
                  }
                }} />
                {!defn.is_system ? (
                  <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                    setBusyId(defn.id);
                    try {
                      await deleteAdminBadge(defn.id);
                      await load();
                    } finally {
                      setBusyId(null);
                    }
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            ),
          }))}
        />
      </AdminTableShell>
    </div>
  );
}

export function AdminSystemSection() {
  const { t } = useTranslations();
  const [health, setHealth] = useState<AdminSystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setHealth(await getAdminHealth());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!health && loading) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label={t("admin.metric.playing")} value={health?.channels_playing ?? 0} icon={Radio} accent="amber" />
        <AdminStatCard label={t("admin.metric.listeners")} value={health?.realtime.listeners_in_presence ?? 0} icon={Activity} />
        <AdminStatCard label={t("admin.metric.mediaGb")} value={health?.media_audio_gb ?? 0} icon={Server} accent="emerald" />
        <AdminStatCard label={t("admin.metric.celeryWorkers")} value={health?.celery.workers ?? 0} icon={Server} accent="violet" sub={health?.celery.reachable ? "OK" : "—"} />
      </div>
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("admin.systemTitle")}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void load()}>{t("common.refresh")}</Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between rounded-lg border px-3 py-2"><span>{t("admin.healthStatus")}</span><Badge variant={health?.status === "ok" ? "success" : "warning"}>{health?.status}</Badge></div>
          <div className="flex justify-between rounded-lg border px-3 py-2"><span>PostgreSQL</span><Badge variant={health?.db ? "success" : "warning"}>{health?.db ? "OK" : "FAIL"}</Badge></div>
          <div className="flex justify-between rounded-lg border px-3 py-2"><span>Redis</span><Badge variant={health?.redis ? "success" : "warning"}>{health?.redis ? "OK" : "FAIL"}</Badge></div>
          {health?.disk.used_percent != null ? (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">{t("admin.metric.disk")}</p>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-brand" style={{ width: `${Math.min(100, health.disk.used_percent)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{health.disk.free_gb} GB {t("admin.metric.free")}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
