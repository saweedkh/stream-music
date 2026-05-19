"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Award,
  Crown,
  LayoutGrid,
  Loader2,
  Music,
  Plus,
  Radio,
  Search,
  Server,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { UsernameWithBadges } from "@/components/ui/user-verified-badge";
import { useToast } from "@/components/ui/toast-provider";
import {
  createAdminBadge,
  deleteAdminBadge,
  getAdminHealth,
  getAdminOverview,
  listAdminBadges,
  listAdminChannels,
  listAdminUsers,
  patchAdminBadge,
  patchAdminUser,
  type AdminBadgeDefinition,
  type AdminChannelRow,
  type AdminOverview,
  type AdminUserRow,
} from "@/lib/api";
import type { MessageKey } from "@/lib/i18n/messages";
import { manualBadgeSlugsForUser } from "@/lib/user-badges";
import { cn } from "@/lib/utils";

const ADMIN_SECTIONS = ["overview", "users", "badges", "channels", "system"] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];

function isAdminSection(value: string | null): value is AdminSection {
  return value !== null && (ADMIN_SECTIONS as readonly string[]).includes(value);
}

const NAV: { id: AdminSection; labelKey: MessageKey; icon: typeof Activity }[] = [
  { id: "overview", labelKey: "admin.nav.overview", icon: Activity },
  { id: "users", labelKey: "admin.nav.users", icon: Users },
  { id: "badges", labelKey: "admin.nav.badges", icon: Award },
  { id: "channels", labelKey: "admin.nav.channels", icon: LayoutGrid },
  { id: "system", labelKey: "admin.nav.system", icon: Server },
];

const BADGE_ICONS = ["badge-check", "crown", "sparkles", "star", "shield", "music", "heart", "zap", "gem"] as const;
const BADGE_COLORS = ["sky", "amber", "violet", "emerald", "rose", "brand", "slate"] as const;

function isManualBadgeSlug(slug: string) {
  return slug !== "platform_superuser" && slug !== "platform_staff";
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: typeof Users;
}) {
  return (
    <Card className="border-border/60 bg-card/50">
      <CardContent className="flex items-start gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
          <p className="text-xs font-medium text-foreground">{label}</p>
          {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminPanelHub() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeSection = useMemo(() => {
    const raw = searchParams.get("adminSection");
    return isAdminSection(raw) ? raw : "overview";
  }, [searchParams]);

  const selectSection = useCallback(
    (section: AdminSection) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "admin");
      if (section === "overview") params.delete("adminSection");
      else params.set("adminSection", section);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [health, setHealth] = useState<{ status: string; db: boolean; redis: boolean } | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [channels, setChannels] = useState<AdminChannelRow[]>([]);
  const [channelsTotal, setChannelsTotal] = useState(0);
  const [userSearch, setUserSearch] = useState("");
  const [channelSearch, setChannelSearch] = useState("");
  const [badgeDefs, setBadgeDefs] = useState<AdminBadgeDefinition[]>([]);
  const [newBadge, setNewBadge] = useState({
    slug: "",
    label: "",
    description: "",
    icon: "star" as (typeof BADGE_ICONS)[number],
    color: "emerald" as (typeof BADGE_COLORS)[number],
    priority: "200",
  });
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [busyBadgeId, setBusyBadgeId] = useState<number | null>(null);

  const loadOverview = useCallback(async () => {
    const [ov, h] = await Promise.all([getAdminOverview(), getAdminHealth()]);
    setOverview(ov);
    setHealth(h);
  }, []);

  const loadUsers = useCallback(async (search: string) => {
    const data = await listAdminUsers({ search, limit: 50, offset: 0 });
    setUsers(data.results);
    setUsersTotal(data.total);
  }, []);

  const loadChannels = useCallback(async (search: string) => {
    const data = await listAdminChannels({ search, limit: 50, offset: 0 });
    setChannels(data.results);
    setChannelsTotal(data.total);
  }, []);

  const loadBadges = useCallback(async () => {
    const data = await listAdminBadges();
    setBadgeDefs(data.results);
  }, []);

  useEffect(() => {
    setLoading(true);
    const run = async () => {
      try {
        if (activeSection === "overview" || activeSection === "system") await loadOverview();
        if (activeSection === "users") {
          await Promise.all([loadUsers(userSearch), loadBadges()]);
        }
        if (activeSection === "badges") await loadBadges();
        if (activeSection === "channels") await loadChannels(channelSearch);
      } catch {
        showToast(t("admin.loadFailed"), "error");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [activeSection, channelSearch, loadBadges, loadChannels, loadOverview, loadUsers, showToast, t, userSearch]);

  async function toggleUserFlag(user: AdminUserRow, field: "is_active" | "is_staff" | "is_superuser") {
    setBusyUserId(user.id);
    try {
      const next = !user[field];
      await patchAdminUser(user.id, { [field]: next });
      await loadUsers(userSearch);
      showToast(t("admin.userUpdated"), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("admin.loadFailed"), "error");
    } finally {
      setBusyUserId(null);
    }
  }

  const manualBadgeDefs = useMemo(
    () => badgeDefs.filter((b) => isManualBadgeSlug(b.slug) && b.is_active),
    [badgeDefs],
  );

  async function toggleUserManualBadge(user: AdminUserRow, slug: string) {
    setBusyUserId(user.id);
    try {
      const current = manualBadgeSlugsForUser(manualBadgeDefs, user);
      const next = current.includes(slug) ? current.filter((s) => s !== slug) : [...current, slug];
      await patchAdminUser(user.id, { badge_slugs: next });
      await loadUsers(userSearch);
      showToast(t("admin.userUpdated"), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("admin.loadFailed"), "error");
    } finally {
      setBusyUserId(null);
    }
  }

  async function submitNewBadge() {
    const slug = newBadge.slug.trim().toLowerCase().replace(/\s+/g, "-");
    const label = newBadge.label.trim();
    if (!slug || !label) return;
    setBusyBadgeId(-1);
    try {
      await createAdminBadge({
        slug,
        label,
        description: newBadge.description.trim(),
        icon: newBadge.icon,
        color: newBadge.color,
        priority: Number(newBadge.priority) || 200,
      });
      setNewBadge({ slug: "", label: "", description: "", icon: "star", color: "emerald", priority: "200" });
      await loadBadges();
      showToast(t("admin.badgesCreated"), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("admin.loadFailed"), "error");
    } finally {
      setBusyBadgeId(null);
    }
  }

  async function removeBadge(defn: AdminBadgeDefinition) {
    if (defn.is_system) {
      showToast(t("admin.badgesCannotDeleteSystem"), "error");
      return;
    }
    setBusyBadgeId(defn.id);
    try {
      await deleteAdminBadge(defn.id);
      await loadBadges();
      showToast(t("admin.badgesDeleted"), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("admin.loadFailed"), "error");
    } finally {
      setBusyBadgeId(null);
    }
  }

  if (loading && !overview && users.length === 0 && channels.length === 0) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(220px,260px)_1fr]">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(220px,260px)_1fr]">
      <nav
        aria-label={t("admin.navAria")}
        className={cn(
          "flex h-fit flex-col gap-1 rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-500/[0.08] to-card/40 p-2 shadow-sm",
          "max-lg:flex-row max-lg:flex-wrap max-lg:overflow-x-auto",
        )}
      >
        <div className="mb-1 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5">
          <Crown className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
              {t("admin.panelEyebrow")}
            </p>
            <p className="truncate text-sm font-semibold text-foreground">{t("admin.panelTitle")}</p>
          </div>
        </div>
        {NAV.map(({ id, labelKey, icon: Icon }) => {
          const active = activeSection === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectSection(id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex w-full shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-start text-sm font-medium transition-colors",
                active
                  ? "border-amber-500/35 bg-amber-500/15 text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground",
                "max-lg:min-w-[9rem]",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {t(labelKey)}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 space-y-4">
        {activeSection === "overview" && overview ? (
          <>
            <div>
              <h3 className="text-base font-semibold tracking-tight">{t("admin.overviewTitle")}</h3>
              <p className="text-sm text-muted-foreground">{t("admin.overviewDescription")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard label={t("admin.stat.users")} value={overview.users.total} sub={t("admin.stat.usersActive", { count: overview.users.active })} icon={Users} />
              <StatCard label={t("admin.stat.channels")} value={overview.channels.total} sub={t("admin.stat.channelsLive", { count: overview.channels.playing })} icon={Radio} />
              <StatCard label={t("admin.stat.tracks")} value={overview.tracks_total} icon={Music} />
              <StatCard label={t("admin.stat.playlists")} value={overview.playlists_total} icon={LayoutGrid} />
              <StatCard label={t("admin.stat.staff")} value={overview.users.staff} sub={t("admin.stat.superusers", { count: overview.users.superuser })} icon={Shield} />
              <StatCard label={t("admin.stat.memberships")} value={overview.memberships_active} icon={Users} />
            </div>
            {health ? (
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t("admin.healthQuick")}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Badge variant={health.status === "ok" ? "success" : "warning"}>{health.status}</Badge>
                  <Badge variant={health.db ? "success" : "warning"}>DB {health.db ? "OK" : "—"}</Badge>
                  <Badge variant={health.redis ? "success" : "warning"}>Redis {health.redis ? "OK" : "—"}</Badge>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : null}

        {activeSection === "users" ? (
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">{t("admin.usersTitle")}</CardTitle>
              <CardDescription>{t("admin.usersDescription", { total: usersTotal })}</CardDescription>
              <div className="relative pt-2">
                <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  className="ps-9"
                  placeholder={t("admin.searchUsers")}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void loadUsers(userSearch);
                  }}
                />
              </div>
              <Button size="sm" className="w-fit" onClick={() => void loadUsers(userSearch)}>
                {t("common.refresh")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <UsernameWithBadges
                      username={u.username}
                      flags={u}
                      size="md"
                      usernameClassName="text-sm font-semibold text-foreground"
                    />
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{u.email || "—"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      ID {u.id}
                      {u.last_login ? ` · ${t("admin.lastLogin")}: ${new Date(u.last_login).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={u.is_active}
                        disabled={busyUserId === u.id}
                        onCheckedChange={() => void toggleUserFlag(u, "is_active")}
                      />
                      {t("admin.active")}
                    </label>
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={u.is_staff}
                        disabled={busyUserId === u.id}
                        onCheckedChange={() => void toggleUserFlag(u, "is_staff")}
                      />
                      {t("admin.staff")}
                    </label>
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={u.is_superuser}
                        disabled={busyUserId === u.id}
                        onCheckedChange={() => void toggleUserFlag(u, "is_superuser")}
                      />
                      {t("admin.superuser")}
                    </label>
                    {busyUserId === u.id ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                  </div>
                  {manualBadgeDefs.length > 0 ? (
                    <div className="w-full border-t border-border/40 pt-2">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("admin.userBadges")}
                      </p>
                      <p className="mb-2 text-[11px] text-muted-foreground">{t("admin.userBadgesHint")}</p>
                      <div className="flex flex-wrap gap-1.5">
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
                              onClick={() => void toggleUserManualBadge(u, defn.slug)}
                            >
                              {defn.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {activeSection === "badges" ? (
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">{t("admin.badgesTitle")}</CardTitle>
              <CardDescription>{t("admin.badgesDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-3">
                <p className="text-sm font-medium text-foreground">{t("admin.badgesCreate")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder={t("admin.badgesSlug")}
                    value={newBadge.slug}
                    onChange={(e) => setNewBadge((p) => ({ ...p, slug: e.target.value }))}
                  />
                  <Input
                    placeholder={t("admin.badgesLabel")}
                    value={newBadge.label}
                    onChange={(e) => setNewBadge((p) => ({ ...p, label: e.target.value }))}
                  />
                  <Input
                    className="sm:col-span-2"
                    placeholder={t("admin.badgesDescriptionField")}
                    value={newBadge.description}
                    onChange={(e) => setNewBadge((p) => ({ ...p, description: e.target.value }))}
                  />
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={newBadge.icon}
                    onChange={(e) =>
                      setNewBadge((p) => ({ ...p, icon: e.target.value as (typeof BADGE_ICONS)[number] }))
                    }
                  >
                    {BADGE_ICONS.map((icon) => (
                      <option key={icon} value={icon}>
                        {icon}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={newBadge.color}
                    onChange={(e) =>
                      setNewBadge((p) => ({ ...p, color: e.target.value as (typeof BADGE_COLORS)[number] }))
                    }
                  >
                    {BADGE_COLORS.map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    placeholder={t("admin.badgesPriority")}
                    value={newBadge.priority}
                    onChange={(e) => setNewBadge((p) => ({ ...p, priority: e.target.value }))}
                  />
                </div>
                <Button type="button" size="sm" disabled={busyBadgeId === -1} onClick={() => void submitNewBadge()}>
                  {busyBadgeId === -1 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 me-1" />}
                  {t("admin.badgesCreate")}
                </Button>
              </div>
              <div className="space-y-2">
                {badgeDefs.map((defn) => (
                  <div
                    key={defn.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {defn.label}{" "}
                        <span className="text-xs font-normal text-muted-foreground">({defn.slug})</span>
                      </p>
                      {defn.description ? <p className="text-xs text-muted-foreground">{defn.description}</p> : null}
                      <p className="text-[10px] text-muted-foreground">
                        {defn.icon} · {defn.color} · {t("admin.badgesPriority")}: {defn.priority}
                        {defn.is_system ? ` · ${t("admin.badgesSystem")}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs">
                        <Switch
                          checked={defn.is_active}
                          disabled={defn.is_system || busyBadgeId === defn.id}
                          onCheckedChange={async (checked) => {
                            setBusyBadgeId(defn.id);
                            try {
                              await patchAdminBadge(defn.id, { is_active: checked });
                              await loadBadges();
                              showToast(t("admin.badgesSaved"), "success");
                            } catch (e) {
                              showToast(e instanceof Error ? e.message : t("admin.loadFailed"), "error");
                            } finally {
                              setBusyBadgeId(null);
                            }
                          }}
                        />
                        {t("admin.badgesActive")}
                      </label>
                      {!defn.is_system ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          disabled={busyBadgeId === defn.id}
                          onClick={() => void removeBadge(defn)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("admin.badgesDelete")}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {activeSection === "channels" ? (
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">{t("admin.channelsTitle")}</CardTitle>
              <CardDescription>{t("admin.channelsDescription", { total: channelsTotal })}</CardDescription>
              <div className="relative pt-2">
                <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  className="ps-9"
                  placeholder={t("admin.searchChannels")}
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void loadChannels(channelSearch);
                  }}
                />
              </div>
              <Button size="sm" className="w-fit" onClick={() => void loadChannels(channelSearch)}>
                {t("common.refresh")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {channels.map((ch) => (
                <div
                  key={ch.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{ch.name}</p>
                    <p className="text-xs text-muted-foreground">
                      #{ch.id} · {ch.privacy}
                      {ch.owner_username ? ` · @${ch.owner_username}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {ch.is_playing ? <Badge variant="success">{t("channels.live")}</Badge> : null}
                    {!ch.is_active ? <Badge variant="warning">{t("channels.closed")}</Badge> : null}
                    <Badge variant="default">{t("admin.memberCount", { count: ch.member_count })}</Badge>
                    <Button size="sm" variant="secondary" asChild>
                      <Link href={`/channel/${ch.id}`}>{t("channels.enterRoom")}</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {activeSection === "system" ? (
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-lg">{t("admin.systemTitle")}</CardTitle>
              <CardDescription>{t("admin.systemDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {health ? (
                <ul className="space-y-2 text-sm">
                  <li className="flex justify-between gap-2 rounded-lg border border-border/50 px-3 py-2">
                    <span>{t("admin.healthStatus")}</span>
                    <Badge variant={health.status === "ok" ? "success" : "warning"}>{health.status}</Badge>
                  </li>
                  <li className="flex justify-between gap-2 rounded-lg border border-border/50 px-3 py-2">
                    <span>PostgreSQL</span>
                    <Badge variant={health.db ? "success" : "warning"}>{health.db ? "OK" : "FAIL"}</Badge>
                  </li>
                  <li className="flex justify-between gap-2 rounded-lg border border-border/50 px-3 py-2">
                    <span>Redis</span>
                    <Badge variant={health.redis ? "success" : "warning"}>{health.redis ? "OK" : "FAIL"}</Badge>
                  </li>
                </ul>
              ) : null}
              <Button variant="secondary" onClick={() => void loadOverview()}>
                {t("common.refresh")}
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
