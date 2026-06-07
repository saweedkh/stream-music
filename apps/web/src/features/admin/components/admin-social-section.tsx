"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminDataTable, AdminTableShell } from "@/features/admin/components/admin-table-shell";
import { AdminStatCard } from "@/features/admin/components/admin-stat-card";
import { useAdminPaginatedList } from "@/features/admin/hooks/use-admin-paginated-list";
import {
  getAdminSocialOverview,
  listAdminActivityEvents,
  listAdminReferrals,
  listAdminSocialChannelFollows,
  listAdminSocialProfiles,
  listAdminSocialUserFollows,
  patchAdminSocialProfile,
} from "@/lib/api/admin";
import type { AdminSocialOverview } from "@/lib/api/types/admin";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { Skeleton } from "@/shared/ui/skeleton";
import { useToast } from "@/shared/ui/toast-provider";
import { Link2, UserCircle, Users } from "lucide-react";

type SocialTab = "profiles" | "channelFollows" | "userFollows" | "referrals" | "activity";

export function AdminSocialSection() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [tab, setTab] = useState<SocialTab>("profiles");
  const [overview, setOverview] = useState<AdminSocialOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [profileFilter, setProfileFilter] = useState("all");
  const [activityKind, setActivityKind] = useState("all");
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const profilesFetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) =>
      listAdminSocialProfiles({ ...opts, is_public: profileFilter }),
    [profileFilter],
  );
  const channelFollowsFetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminSocialChannelFollows(opts),
    [],
  );
  const userFollowsFetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminSocialUserFollows(opts),
    [],
  );
  const referralsFetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) => listAdminReferrals(opts),
    [],
  );
  const activityFetcher = useCallback(
    (opts: { search: string; limit: number; offset: number }) =>
      listAdminActivityEvents({ ...opts, kind: activityKind }),
    [activityKind],
  );

  const profiles = useAdminPaginatedList(profilesFetcher);
  const channelFollows = useAdminPaginatedList(channelFollowsFetcher);
  const userFollows = useAdminPaginatedList(userFollowsFetcher);
  const referrals = useAdminPaginatedList(referralsFetcher);
  const activity = useAdminPaginatedList(activityFetcher);

  useEffect(() => {
    void getAdminSocialOverview()
      .then(setOverview)
      .catch(() => showToast(t("admin.loadFailed"), "error"))
      .finally(() => setLoadingOverview(false));
  }, [showToast, t]);

  const tabs: { id: SocialTab; label: string }[] = [
    { id: "profiles", label: t("admin.social.tab.profiles") },
    { id: "channelFollows", label: t("admin.social.tab.channelFollows") },
    { id: "userFollows", label: t("admin.social.tab.userFollows") },
    { id: "referrals", label: t("admin.social.tab.referrals") },
    { id: "activity", label: t("admin.social.tab.activity") },
  ];

  const profileRows = useMemo(
    () =>
      profiles.rows.map((row) => ({
        user: (
          <div>
            <p className="font-medium">@{row.username}</p>
            <p className="truncate text-xs text-muted-foreground">{row.bio || "—"}</p>
          </div>
        ),
        visibility: (
          <Badge variant={row.is_public ? "success" : "secondary"}>
            {row.is_public ? t("admin.social.public") : t("admin.social.private")}
          </Badge>
        ),
        stats: (
          <span className="text-xs text-muted-foreground">
            {row.follower_count} / {row.following_channels_count}
          </span>
        ),
        actions: (
          <Switch
            checked={row.is_public}
            disabled={busyUserId === row.user_id}
            onCheckedChange={async (checked) => {
              setBusyUserId(row.user_id);
              try {
                await patchAdminSocialProfile(row.user_id, { is_public: checked });
                await profiles.reload();
                showToast(t("admin.social.profileUpdated"), "success");
              } catch (e) {
                showToast(e instanceof Error ? e.message : t("admin.loadFailed"), "error");
              } finally {
                setBusyUserId(null);
              }
            }}
          />
        ),
      })),
    [busyUserId, profiles, showToast, t],
  );

  if (loadingOverview && !overview) return <Skeleton className="h-80 w-full rounded-2xl" />;

  return (
    <div className="space-y-4">
      {overview ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard label={t("admin.social.profiles")} value={overview.profiles.total} sub={`${overview.profiles.public} ${t("admin.social.public")}`} icon={UserCircle} />
          <AdminStatCard label={t("admin.social.channelFollows")} value={overview.follows.channel_follows_total} icon={Users} accent="amber" />
          <AdminStatCard label={t("admin.social.userFollows")} value={overview.follows.user_follows_total} icon={Users} accent="emerald" />
          <AdminStatCard label={t("admin.social.referrals")} value={overview.referrals.codes_total} sub={t("admin.social.signups", { count: overview.referrals.total_signups })} icon={Link2} accent="violet" />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={tab === item.id ? "default" : "outline"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {tab === "profiles" ? (
        <AdminTableShell
          title={t("admin.social.profilesTitle")}
          description={t("admin.social.profilesDescription", { total: String(profiles.total) })}
          searchPlaceholder={t("admin.searchUsers")}
          search={profiles.search}
          onSearchChange={profiles.setSearch}
          onSearchSubmit={profiles.submitSearch}
          onRefresh={() => void profiles.reload()}
          loading={profiles.loading}
          total={profiles.total}
          page={profiles.page}
          pageCount={profiles.pageCount}
          onPrevPage={profiles.prevPage}
          onNextPage={profiles.nextPage}
          toolbarExtra={
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={profileFilter}
              onChange={(e) => {
                setProfileFilter(e.target.value);
                void profiles.reload();
              }}
            >
              <option value="all">{t("admin.filterAll")}</option>
              <option value="true">{t("admin.social.public")}</option>
              <option value="false">{t("admin.social.private")}</option>
            </select>
          }
        >
          <AdminDataTable
            loading={profiles.loading}
            emptyMessage={t("admin.emptySocialProfiles")}
            columns={[
              { key: "user", header: t("admin.col.user") },
              { key: "visibility", header: t("admin.col.visibility") },
              { key: "stats", header: t("admin.social.followStats") },
              { key: "actions", header: t("admin.social.makePublic") },
            ]}
            rows={profileRows}
          />
        </AdminTableShell>
      ) : null}

      {tab === "channelFollows" ? (
        <AdminTableShell
          title={t("admin.social.channelFollowsTitle")}
          searchPlaceholder={t("admin.searchSocial")}
          search={channelFollows.search}
          onSearchChange={channelFollows.setSearch}
          onSearchSubmit={channelFollows.submitSearch}
          onRefresh={() => void channelFollows.reload()}
          loading={channelFollows.loading}
          total={channelFollows.total}
          page={channelFollows.page}
          pageCount={channelFollows.pageCount}
          onPrevPage={channelFollows.prevPage}
          onNextPage={channelFollows.nextPage}
        >
          <AdminDataTable
            loading={channelFollows.loading}
            emptyMessage={t("admin.empty")}
            columns={[
              { key: "user", header: t("admin.col.user") },
              { key: "channel", header: t("channels.name") },
              { key: "notify", header: t("admin.social.notifyLive") },
              { key: "date", header: t("admin.col.date") },
            ]}
            rows={channelFollows.rows.map((row) => ({
              user: `@${row.username}`,
              channel: row.channel_name,
              notify: row.notify_live ? t("admin.active") : t("admin.inactive"),
              date: row.created_at ? new Date(row.created_at).toLocaleDateString() : "—",
            }))}
          />
        </AdminTableShell>
      ) : null}

      {tab === "userFollows" ? (
        <AdminTableShell
          title={t("admin.social.userFollowsTitle")}
          searchPlaceholder={t("admin.searchSocial")}
          search={userFollows.search}
          onSearchChange={userFollows.setSearch}
          onSearchSubmit={userFollows.submitSearch}
          onRefresh={() => void userFollows.reload()}
          loading={userFollows.loading}
          total={userFollows.total}
          page={userFollows.page}
          pageCount={userFollows.pageCount}
          onPrevPage={userFollows.prevPage}
          onNextPage={userFollows.nextPage}
        >
          <AdminDataTable
            loading={userFollows.loading}
            emptyMessage={t("admin.empty")}
            columns={[
              { key: "follower", header: t("admin.social.follower") },
              { key: "following", header: t("admin.social.following") },
              { key: "date", header: t("admin.col.date") },
            ]}
            rows={userFollows.rows.map((row) => ({
              follower: `@${row.follower_username}`,
              following: `@${row.following_username}`,
              date: row.created_at ? new Date(row.created_at).toLocaleDateString() : "—",
            }))}
          />
        </AdminTableShell>
      ) : null}

      {tab === "referrals" ? (
        <AdminTableShell
          title={t("admin.social.referralsTitle")}
          searchPlaceholder={t("admin.searchReferrals")}
          search={referrals.search}
          onSearchChange={referrals.setSearch}
          onSearchSubmit={referrals.submitSearch}
          onRefresh={() => void referrals.reload()}
          loading={referrals.loading}
          total={referrals.total}
          page={referrals.page}
          pageCount={referrals.pageCount}
          onPrevPage={referrals.prevPage}
          onNextPage={referrals.nextPage}
        >
          <AdminDataTable
            loading={referrals.loading}
            emptyMessage={t("admin.emptyReferrals")}
            columns={[
              { key: "user", header: t("admin.col.user") },
              { key: "code", header: t("admin.col.code") },
              { key: "signups", header: t("admin.social.signupsCol") },
              { key: "date", header: t("admin.col.date") },
            ]}
            rows={referrals.rows.map((row) => ({
              user: `@${row.username}`,
              code: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.code}</code>,
              signups: String(row.signup_count),
              date: row.created_at ? new Date(row.created_at).toLocaleDateString() : "—",
            }))}
          />
        </AdminTableShell>
      ) : null}

      {tab === "activity" ? (
        <AdminTableShell
          title={t("admin.social.activityTitle")}
          searchPlaceholder={t("admin.searchSocial")}
          search={activity.search}
          onSearchChange={activity.setSearch}
          onSearchSubmit={activity.submitSearch}
          onRefresh={() => void activity.reload()}
          loading={activity.loading}
          total={activity.total}
          page={activity.page}
          pageCount={activity.pageCount}
          onPrevPage={activity.prevPage}
          onNextPage={activity.nextPage}
          toolbarExtra={
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={activityKind}
              onChange={(e) => {
                setActivityKind(e.target.value);
                void activity.reload();
              }}
            >
              <option value="all">{t("admin.filterAll")}</option>
              <option value="channel_shuffle">{t("admin.social.kind.shuffle")}</option>
              <option value="channel_live">{t("admin.social.kind.live")}</option>
              <option value="playlist_created">{t("admin.social.kind.playlist")}</option>
            </select>
          }
        >
          <AdminDataTable
            loading={activity.loading}
            emptyMessage={t("admin.emptyActivity")}
            columns={[
              { key: "kind", header: t("admin.col.meta") },
              { key: "actor", header: t("admin.col.user") },
              { key: "channel", header: t("channels.name") },
              { key: "date", header: t("admin.col.date") },
            ]}
            rows={activity.rows.map((row) => ({
              kind: <Badge variant="secondary">{row.kind}</Badge>,
              actor: `@${row.actor_username}`,
              channel: row.channel_name ?? "—",
              date: row.created_at ? new Date(row.created_at).toLocaleString() : "—",
            }))}
          />
        </AdminTableShell>
      ) : null}
    </div>
  );
}
