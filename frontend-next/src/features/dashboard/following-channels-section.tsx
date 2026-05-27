"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Radio, UserMinus, UserPlus } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { WorkspaceList, WorkspaceListItem } from "@/components/layout/workspace";
import {
  followChannel,
  listFollowingChannels,
  unfollowChannel,
  type FollowingChannelRow,
} from "@/lib/api";

export function FollowingChannelsSection() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [rows, setRows] = useState<FollowingChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listFollowingChannels();
      setRows(data.results);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("dashboard.following.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleNotify(row: FollowingChannelRow) {
    setBusyId(row.channel.id);
    try {
      await followChannel(String(row.channel.id), !row.notify_live);
      setRows((prev) =>
        prev.map((r) => (r.channel.id === row.channel.id ? { ...r, notify_live: !row.notify_live } : r)),
      );
      showToast(row.notify_live ? t("follow.notifyOff") : t("follow.notifyOn"), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("dashboard.following.notifyFailed"), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function unfollow(row: FollowingChannelRow) {
    setBusyId(row.channel.id);
    try {
      await unfollowChannel(String(row.channel.id));
      setRows((prev) => prev.filter((r) => r.channel.id !== row.channel.id));
      showToast(t("follow.unfollowed"), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("dashboard.following.unfollowFailed"), "error");
    } finally {
      setBusyId(null);
    }
  }

  const live = rows.filter((r) => r.is_live);
  const idle = rows.filter((r) => !r.is_live);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {t("dashboard.following.empty")}{" "}
        <Link href="/explore" className="text-brand hover:underline">
          {t("dashboard.following.exploreLink")}
        </Link>
      </p>
    );
  }

  function renderRow(row: FollowingChannelRow) {
    const busy = busyId === row.channel.id;
    const href = row.is_member ? `/channel/${row.channel.id}` : `/join/public/${row.channel.public_join_slug ?? row.channel.public_slug}`;
    return (
      <WorkspaceListItem key={row.channel.id} accent={row.is_live ? "brand" : "none"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={href} className="truncate font-medium text-foreground hover:text-brand">
              {row.channel.name}
            </Link>
            {row.is_live ? <Badge variant="success">{t("channels.live")}</Badge> : null}
            {row.is_member ? <Badge variant="secondary">{t("dashboard.following.member")}</Badge> : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">@{row.channel.owner_username ?? "—"}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" size="sm" variant="default" asChild>
            <Link href={href}>{row.is_live ? t("dashboard.following.joinLive") : t("dashboard.following.open")}</Link>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void toggleNotify(row)}
            title={row.notify_live ? t("follow.notifyOff") : t("follow.notifyOn")}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : row.notify_live ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void unfollow(row)}>
            <UserMinus className="h-4 w-4" />
          </Button>
        </div>
        </div>
      </WorkspaceListItem>
    );
  }

  return (
    <div className="space-y-8">
      {live.length > 0 ? (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Radio className="h-4 w-4 text-brand" />
            {t("dashboard.following.liveNow", { count: live.length })}
          </h3>
          <WorkspaceList>{live.map(renderRow)}</WorkspaceList>
        </section>
      ) : null}
      {idle.length > 0 ? (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t("dashboard.following.all")}</h3>
          <WorkspaceList>{idle.map(renderRow)}</WorkspaceList>
        </section>
      ) : null}
      <p className="text-center text-xs text-muted-foreground">
        <Link href="/explore" className="text-brand hover:underline">
          {t("dashboard.following.discoverMore")}
        </Link>
      </p>
    </div>
  );
}
