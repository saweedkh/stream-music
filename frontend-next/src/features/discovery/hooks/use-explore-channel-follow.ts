"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  followChannel,
  getChannelFollow,
  unfollowChannel,
  type ChannelFollowState,
  type ChannelSummary,
} from "@/lib/api";

export type ExploreChannelFollowActions = {
  following: boolean;
  notifyLive: boolean;
  busy: boolean;
  onToggleFollow: () => void;
  onToggleNotify: () => void;
};

function canFollowChannel(channel: ChannelSummary) {
  return channel.privacy === "public" && channel.membership_is_active !== true;
}

export function useExploreChannelFollow(
  channels: ChannelSummary[],
  showToast: (message: string, variant: "success" | "error") => void,
  messages: { followed: string; unfollowed: string; notifyOn: string; notifyOff: string; failed: string },
) {
  const [state, setState] = useState<Record<string, ChannelFollowState>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const followableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const ch of channels) {
      if (canFollowChannel(ch)) ids.add(String(ch.id));
    }
    return Array.from(ids).sort();
  }, [channels]);

  const idsKey = followableIds.join(",");

  useEffect(() => {
    if (followableIds.length === 0) {
      setState({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const entries = await Promise.all(
        followableIds.map(async (id) => {
          try {
            const res = await getChannelFollow(id);
            return [id, res] as const;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      const next: Record<string, ChannelFollowState> = {};
      for (const entry of entries) {
        if (entry) next[entry[0]] = entry[1];
      }
      setState(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [idsKey, followableIds]);

  const toggleFollow = useCallback(
    async (channelId: string) => {
      const current = state[channelId];
      const following = current?.following === true;
      setBusy((prev) => ({ ...prev, [channelId]: true }));
      try {
        if (following) {
          await unfollowChannel(channelId);
          setState((prev) => ({
            ...prev,
            [channelId]: {
              following: false,
              notify_live: true,
              follower_count: Math.max(0, (prev[channelId]?.follower_count ?? 1) - 1),
            },
          }));
          showToast(messages.unfollowed, "success");
        } else {
          const res = await followChannel(channelId, true);
          setState((prev) => ({ ...prev, [channelId]: res }));
          showToast(messages.followed, "success");
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : messages.failed, "error");
      } finally {
        setBusy((prev) => ({ ...prev, [channelId]: false }));
      }
    },
    [messages.failed, messages.followed, messages.unfollowed, showToast, state],
  );

  const toggleNotify = useCallback(
    async (channelId: string) => {
      const current = state[channelId];
      if (!current?.following) return;
      setBusy((prev) => ({ ...prev, [channelId]: true }));
      try {
        const next = !current.notify_live;
        const res = await followChannel(channelId, next);
        setState((prev) => ({ ...prev, [channelId]: res }));
        showToast(next ? messages.notifyOn : messages.notifyOff, "success");
      } catch (e) {
        showToast(e instanceof Error ? e.message : messages.failed, "error");
      } finally {
        setBusy((prev) => ({ ...prev, [channelId]: false }));
      }
    },
    [messages.failed, messages.notifyOff, messages.notifyOn, showToast, state],
  );

  const forChannel = useCallback(
    (channel: ChannelSummary): ExploreChannelFollowActions | null => {
      if (!canFollowChannel(channel)) return null;
      const id = String(channel.id);
      const row = state[id];
      return {
        following: row?.following === true,
        notifyLive: row?.notify_live !== false,
        busy: busy[id] === true,
        onToggleFollow: () => void toggleFollow(id),
        onToggleNotify: () => void toggleNotify(id),
      };
    },
    [busy, state, toggleFollow, toggleNotify],
  );

  return { forChannel, loading };
}
