"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, UserPlus, UserMinus } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { followChannel, getChannelFollow, unfollowChannel } from "@/lib/api";

type Props = {
  channelId: string;
  isPublic: boolean;
  isMember: boolean;
};

export function ChannelFollowButton({ channelId, isPublic, isMember }: Props) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [following, setFollowing] = useState(false);
  const [notifyLive, setNotifyLive] = useState(true);
  const [followerCount, setFollowerCount] = useState(0);

  const load = useCallback(async () => {
    if (!isPublic) {
      setLoading(false);
      return;
    }
    try {
      const res = await getChannelFollow(channelId);
      setFollowing(res.following);
      setNotifyLive(res.notify_live);
      setFollowerCount(res.follower_count);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [channelId, isPublic]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isPublic || isMember) return null;
  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;

  async function toggleFollow() {
    setBusy(true);
    try {
      if (following) {
        await unfollowChannel(channelId);
        setFollowing(false);
        setFollowerCount((c) => Math.max(0, c - 1));
        showToast(t("follow.unfollowed"), "success");
      } else {
        await followChannel(channelId, notifyLive);
        setFollowing(true);
        setFollowerCount((c) => c + 1);
        showToast(t("follow.followed"), "success");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("follow.failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleNotify() {
    if (!following) return;
    setBusy(true);
    try {
      const next = !notifyLive;
      await followChannel(channelId, next);
      setNotifyLive(next);
      showToast(next ? t("follow.notifyOn") : t("follow.notifyOff"), "success");
    } catch {
      showToast(t("follow.failed"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant={following ? "secondary" : "default"} disabled={busy} onClick={() => void toggleFollow()}>
        {following ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        {following ? t("follow.following") : t("follow.follow")}
        {followerCount > 0 ? <span className="ms-1 text-xs text-muted-foreground">({followerCount})</span> : null}
      </Button>
      {following ? (
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void toggleNotify()}>
          {notifyLive ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          {notifyLive ? t("follow.liveOn") : t("follow.liveOff")}
        </Button>
      ) : null}
    </div>
  );
}
