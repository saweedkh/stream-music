"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { saveLastChannelId } from "@/lib/last-channel-cache";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { ChannelBlindGuessPanel } from "@/features/channels/components/channel-blind-guess-panel";
import { ChannelAdminPanel } from "@/features/channels/components/channel-admin-panel";
import { ChannelChatPanel } from "@/features/channels/components/channel-chat-panel";
import { ChannelListenerMeta, ChannelRoomLoading } from "@/features/channels/components/channel-listener-view";
import { ChannelListenerPanelShell } from "@/features/channels/components/channel-listener-panel-shell";
import { ChannelListenerShell } from "@/features/channels/components/channel-listener-shell";
import { RoomReactionProvider } from "@/features/channels/components/room-reaction-context";
import { ChannelListenersPanel } from "@/features/channels/components/channel-listeners-panel";
import { ChannelAdminQueuePanel } from "@/features/channels/components/channel-admin-queue-panel";
import { ChannelAdminSuggestionsPanel } from "@/features/channels/components/channel-admin-suggestions-panel";
import { ChannelQueuePanel } from "@/features/channels/components/channel-queue-panel";
import { ChannelTrackSuggestions } from "@/features/channels/components/channel-track-suggestions";
import { ChannelQueueProvider } from "@/features/channels/components/channel-queue-context";
import { ChannelAdminHealthPanel } from "@/features/channels/components/channel-admin-health-panel";
import { ChannelAdminPageHeader } from "@/features/channels/components/channel-admin-page-header";
import { ChannelAdminPanelShell } from "@/features/channels/components/channel-admin-panel-shell";
import { ChannelAdminPlayerPanel } from "@/features/channels/components/channel-admin-player-panel";
import { ChannelAdminShell } from "@/features/channels/components/channel-admin-shell";
import { channelTabFromSearch, isAdminFlushTab, type ChannelTabId, type ListenerTabId } from "@/features/channels/components/channel-room-config";
import { ChannelRoomInsights } from "@/features/channels/components/channel-room-insights";
import { RoomOnboarding } from "@/shared/room/room-onboarding";
import { useRoomHotkeys } from "@/shared/hooks/use-room-hotkeys";
import type { ChannelExperience } from "@/features/experience";
import { useGlobalChannelPlayer } from "@/features/player";
import { useChannelPresence } from "@/shared/hooks/use-channel-presence";
import { usePendingSuggestionsCount } from "@/shared/hooks/use-pending-suggestions-count";
import { useReconnectingChannelSocket } from "@/shared/hooks/use-reconnecting-channel-socket";
import {
  closeChannel,
  getChannelMembers,
  getApiMetrics,
  getMe,
  joinChannel,
  leaveChannel,
  reopenChannel,
  type QueueItemSummary,
} from "@/lib/api";
import { channelChatHref, channelPlayerHref, useNotificationStore } from "@/lib/notifications/store";
import { cn } from "@/lib/utils";

type TabId = ChannelTabId;

function tabFromSearchValue(value: string | null): TabId | null {
  return channelTabFromSearch(value);
}

function readTabFromWindowSearch(): TabId | null {
  if (typeof window === "undefined") return null;
  return channelTabFromSearch(new URLSearchParams(window.location.search).get("tab"));
}

function deriveNowPlayingLabel(trackPath?: string, payload?: { track_file?: string | null } | null): string | null {
  const raw = payload?.track_file ?? trackPath;
  if (!raw?.trim()) return null;
  const base = decodeURIComponent(raw.split("/").pop() ?? "").replace(/\.[^/.]+$/i, "").trim();
  return base || null;
}

type Props = {
  channelId: string;
  /** Django user id of channel owner — leave is hidden for owners (must transfer/delete elsewhere). */
  channelOwnerId?: number;
  channelName: string;
  channelPrivacy: string;
  isPlaying: boolean;
  trackPath?: string;
  startedAt?: number;
  pausedAt?: number;
  initialDescription?: string;
  initialMemberLimit?: number;
  publicSlug?: string;
  publicJoinSlug?: string | null;
  initialJoinRequiresApproval?: boolean;
  /** When false, sync/listening is off until the owner reopens the room. */
  channelIsActive?: boolean;
  initialExperience?: Record<string, unknown> | null;
  brandLogoUrl?: string | null;
};

export function ChannelDashboardTabs(props: Props) {
  const {
    channelId,
    channelOwnerId,
    channelName,
    channelPrivacy,
    isPlaying,
    trackPath,
    startedAt,
    pausedAt,
    initialDescription,
    initialMemberLimit,
    publicSlug,
    publicJoinSlug,
    initialJoinRequiresApproval,
    channelIsActive = true,
    initialExperience,
    brandLogoUrl,
  } = props;
  const [experience, setExperience] = useState<ChannelExperience>((initialExperience as ChannelExperience) ?? {});
  const { t } = useTranslations();
  const { showToast } = useToast();
  const router = useRouter();
  const { upsertState: upsertGlobalPlayerState } = useGlobalChannelPlayer();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>(() => tabFromSearchValue(searchParams.get("tab")) ?? "chat");
  const [isChannelOnline, setIsChannelOnline] = useState(isPlaying);
  const [canManageChannel, setCanManageChannel] = useState(false);
  const [membershipLoaded, setMembershipLoaded] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [closeChannelDialogOpen, setCloseChannelDialogOpen] = useState(false);
  const [closeChannelBusy, setCloseChannelBusy] = useState(false);
  const [latestPlaybackPayload, setLatestPlaybackPayload] = useState<{
    action?: string;
    event_seq?: number;
    is_playing?: boolean;
    started_at_server_time?: number | null;
    position?: number | null;
    track_file?: string | null;
    playlist_id?: number;
    queue?: QueueItemSummary[];
  } | null>(null);
  const [rttMs, setRttMs] = useState<number | null>(null);
  const [jitterMs, setJitterMs] = useState<number | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [clockOffsetMs, setClockOffsetMs] = useState<number | null>(null);
  const [apiMetrics, setApiMetrics] = useState<Awaited<ReturnType<typeof getApiMetrics>> | null>(null);
  const [wsQueue, setWsQueue] = useState<QueueItemSummary[] | null>(null);
  const [chatTabUnread, setChatTabUnread] = useState(0);
  const [viewAsListener, setViewAsListener] = useState(false);
  const [listenerTab, setListenerTab] = useState<ListenerTabId>("chat");
  useEffect(() => {
    saveLastChannelId(channelId);
  }, [channelId]);

  const { onlineCount } = useChannelPresence(channelId);
  const pendingSuggestionsCount = usePendingSuggestionsCount(
    channelId,
    canManageChannel && !viewAsListener,
  );
  const pushNotification = useNotificationStore((s) => s.push);
  const rttSamplesRef = useRef<number[]>([]);
  const lastTrackKeyRef = useRef<string | null>(null);
  const offsetSamplesRef = useRef<number[]>([]);
  const prevSocketStateRef = useRef<string>("connecting");
  const latestSendMessageRef = useRef<((payload: Record<string, unknown>) => boolean) | undefined>(undefined);
  const startedAtText = startedAt == null ? "No active playback session yet" : `${startedAt}`;
  const pausedAtText = pausedAt == null ? (isChannelOnline ? "Not paused" : "No paused position available") : `${pausedAt}s`;

  function selectTab(tab: TabId) {
    setActiveTab(tab);
  }

  function shareChannel() {
    const url = `${window.location.origin}/channel/${channelId}`;
    void (async () => {
      try {
        if (navigator.share) await navigator.share({ title: channelName, url });
        else {
          await navigator.clipboard.writeText(url);
          showToast("Room link copied.", "success");
        }
      } catch {
        /* cancelled */
      }
    })();
  }

  useEffect(() => {
    setExperience((initialExperience as ChannelExperience) ?? {});
  }, [initialExperience]);

  const stableSendSocketMessage = useCallback((payload: Record<string, unknown>) => {
    return latestSendMessageRef.current?.(payload) ?? false;
  }, []);

  const handleSocketMessage = useCallback(
    (payload: unknown) => {
      const data = (payload ?? {}) as {
        type?: string;
        action?: string;
        event_seq?: number;
        is_playing?: boolean;
        started_at_server_time?: number | null;
        position?: number | null;
        track_file?: string | null;
        message?: string;
        queue?: QueueItemSummary[];
        server_time?: number;
        client_ts?: number;
      };
      const type = (data.type ?? "").toLowerCase();
      if (type === "pong_latency") {
        const serverTime = typeof data.server_time === "number" ? data.server_time : null;
        const clientTs = typeof data.client_ts === "number" ? data.client_ts : null;
        if (serverTime != null && clientTs != null) {
          const now = Date.now();
          const rtt = Math.max(0, now - clientTs);
          const offsetMs = serverTime * 1000 - (clientTs + rtt / 2);
          rttSamplesRef.current = [...rttSamplesRef.current.slice(-11), rtt];
          offsetSamplesRef.current = [...offsetSamplesRef.current.slice(-11), offsetMs];
          const avgRtt = rttSamplesRef.current.reduce((acc, n) => acc + n, 0) / Math.max(1, rttSamplesRef.current.length);
          const jitter =
            offsetSamplesRef.current.length > 1
              ? Math.round(
                  offsetSamplesRef.current
                    .slice(1)
                    .reduce((acc, val, idx) => acc + Math.abs(val - (offsetSamplesRef.current[idx] ?? val)), 0) /
                    Math.max(1, offsetSamplesRef.current.length - 1),
                )
              : 0;
          setRttMs(Math.round(avgRtt));
          setJitterMs(jitter);
          setClockOffsetMs(Math.round(offsetMs));
          window.dispatchEvent(
            new CustomEvent("channel-clock-sync", { detail: { channelId: String(channelId), offsetMs } }),
          );
        }
        return;
      }
      if (type === "social") {
        window.dispatchEvent(
          new CustomEvent("channel-social", {
            detail: { channelId: String(channelId), payload: data },
          }),
        );
        return;
      }
      if (type === "suggestions_updated") {
        const sug = data as {
          pending_count?: number;
          event?: string;
          actor_username?: string;
          collab_active_count?: number;
          collab_usernames?: string[];
          recent_pending?: Array<{ id: number; title: string; artist?: string; username: string }>;
        };
        const pending = typeof sug.pending_count === "number" ? sug.pending_count : null;
        window.dispatchEvent(
          new CustomEvent("channel-suggestions", {
            detail: { channelId: String(channelId), payload: sug },
          }),
        );
        if (pending != null) {
          window.dispatchEvent(
            new CustomEvent("channel-suggestions-changed", {
              detail: { channelId: String(channelId), pendingCount: pending },
            }),
          );
        }
        if (
          canManageChannel &&
          !viewAsListener &&
          sug.event === "created" &&
          sug.actor_username &&
          pending != null &&
          pending > 0
        ) {
          showToast(
            t("room.admin.suggestions.toastNewBody", { user: sug.actor_username, count: pending }),
            "info",
          );
        }
        return;
      }
      if (type === "queue_updated" && Array.isArray(data.queue)) {
        setWsQueue(data.queue as QueueItemSummary[]);
        window.dispatchEvent(
          new CustomEvent("channel-playback-updated", {
            detail: { channelId: String(channelId), payload: { action: "queue_updated", queue: data.queue } },
          }),
        );
        return;
      }
      if (type === "error") {
        const map: Record<string, string> = {
          queue_empty: "Queue is empty. Select a playlist/track first.",
          playlist_empty: "Selected playlist is empty.",
          playlist_not_allowed: "This playlist is not allowed for this channel.",
          no_tracks: "No tracks available to shuffle.",
          permission_denied: "You do not have permission for this action.",
          shout_cooldown: "Wait a few seconds before shouting again.",
          queue_locked: "Queue is locked — only the room owner can add tracks.",
          listening_party_only: "Listening party — only DJs can add to the queue.",
          rate_limited: "You are sending messages too fast. Slow down.",
          scheduled_not_started: "Playback is scheduled for later — wait until start time.",
        };
        const key = String(data.message ?? "invalid_state");
        showToast(map[key] ?? `Playback error: ${key}`, "error");
        return;
      }
      const action = (data.action ?? data.type ?? "").toLowerCase();
      if (action === "initial_sync") {
        const sync = data as { experience?: unknown; pending_count?: number };
        if (sync.experience && typeof sync.experience === "object") {
          window.dispatchEvent(
            new CustomEvent("channel-experience", { detail: { channelId: String(channelId), experience: sync.experience } }),
          );
        }
        if (typeof sync.pending_count === "number") {
          window.dispatchEvent(
            new CustomEvent("channel-suggestions-changed", {
              detail: { channelId: String(channelId), pendingCount: sync.pending_count },
            }),
          );
        }
      }
      if (typeof data.is_playing === "boolean") setIsChannelOnline(data.is_playing);
      if (action === "play") setIsChannelOnline(true);
      if (action === "pause") setIsChannelOnline(false);
      if (action === "queue_updated" && Array.isArray(data.queue)) {
        setWsQueue(data.queue as QueueItemSummary[]);
      }
      if (["initial_sync", "play", "pause", "seek", "next", "prev", "add_to_queue", "enqueue_next", "queue_updated"].includes(action)) {
        if (Array.isArray(data.queue)) setWsQueue(data.queue as QueueItemSummary[]);
        setLatestPlaybackPayload(data);
        window.dispatchEvent(
          new CustomEvent("channel-playback-updated", { detail: { channelId: String(channelId), payload: data } }),
        );

        const trackPayload = data as { track?: { title?: string | null; id?: number } | null; track_file?: string | null };
        const trackTitle =
          trackPayload.track?.title?.trim() ||
          deriveNowPlayingLabel(trackPath, { track_file: trackPayload.track_file }) ||
          null;
        const trackKey = `${trackPayload.track?.id ?? ""}:${trackPayload.track_file ?? ""}:${trackTitle ?? ""}`;
        const trackActions = new Set(["next", "prev", "play", "play_playlist", "shuffle_play", "auto_next"]);
        if (trackActions.has(action) && trackTitle && trackKey !== lastTrackKeyRef.current) {
          lastTrackKeyRef.current = trackKey;
          const onPlayerTab = activeTab === "player";
          if (document.hidden || !onPlayerTab) {
            pushNotification({
              category: "playback",
              title: channelName,
              body: `Now playing: ${trackTitle}`,
              href: channelPlayerHref(channelId),
              channelId,
            });
          }
        }
      }
    },
    [activeTab, canManageChannel, channelId, channelName, pushNotification, showToast, t, trackPath, viewAsListener],
  );

  const { socketState, sendMessage } = useReconnectingChannelSocket({
    channelId,
    onMessage: handleSocketMessage,
    enabled: channelIsActive && !leaveBusy,
  });

  const isChannelOwner =
    channelOwnerId != null && currentUserId != null && Number(channelOwnerId) === Number(currentUserId);

  useEffect(() => {
    latestSendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const inListenerLayout = !canManageChannel || viewAsListener;

  useRoomHotkeys({
    enabled: membershipLoaded && !inListenerLayout,
    canControl: canManageChannel,
    onTogglePlay: () => sendMessage({ action: isChannelOnline ? "pause" : "play" }),
  });

  useEffect(() => {
    if (prevSocketStateRef.current !== "reconnecting" && socketState === "reconnecting") {
      setReconnectCount((c) => c + 1);
    }
    prevSocketStateRef.current = socketState;
  }, [socketState]);

  useEffect(() => {
    setIsChannelOnline(isPlaying);
  }, [isPlaying]);

  useEffect(() => {
    const syncFromHistory = () => {
      const next = readTabFromWindowSearch() ?? "chat";
      setActiveTab(next);
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  useEffect(() => {
    const next = tabFromSearchValue(searchParams.get("tab"));
    if (next) setActiveTab(next);
    if (searchParams.get("message")) setActiveTab("chat");
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === "chat") setChatTabUnread(0);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "chat" || !membershipLoaded) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("channel-chat-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, membershipLoaded]);

  useEffect(() => {
    const onSocial = (event: Event) => {
      const detail = (event as CustomEvent<{ channelId?: string; payload?: Record<string, unknown> }>).detail;
      if (String(detail?.channelId) !== String(channelId)) return;
      const p = detail.payload ?? {};
      const act = String(p.action ?? "").toLowerCase();
      if (act === "reaction") {
        const emoji = String(p.emoji ?? "♪");
        const who = String(p.username ?? "?");
        pushNotification({
          category: "moderation",
          title: channelName,
          body: `Reaction ${emoji} — ${who}`,
          href: channelChatHref(channelId),
          channelId,
        });
      } else if (act === "vote_skip") {
        const votes = typeof p.votes === "number" ? p.votes : 0;
        const thr = typeof p.threshold === "number" ? p.threshold : 0;
        pushNotification({
          category: "moderation",
          title: channelName,
          body: thr > 0 ? `Skip votes: ${votes}/${thr}` : `Skip votes: ${votes}`,
          href: channelPlayerHref(channelId),
          channelId,
        });
      }
    };
    window.addEventListener("channel-social", onSocial);
    return () => window.removeEventListener("channel-social", onSocial);
  }, [channelId, channelName, pushNotification]);

  useEffect(() => {
    const onInApp = (event: Event) => {
      const item = (event as CustomEvent<{ category?: string; channelId?: string }>).detail;
      if (item?.category !== "chat" || String(item.channelId) !== String(channelId)) return;
      const chatVisible = canManageChannel
        ? activeTab === "chat"
        : typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
      if (!chatVisible) setChatTabUnread((c) => c + 1);
    };
    window.addEventListener("stream-in-app-notification", onInApp);
    return () => window.removeEventListener("stream-in-app-notification", onInApp);
  }, [activeTab, canManageChannel, channelId]);

  useEffect(() => {
    if (activeTab !== "health") return;
    void getApiMetrics()
      .then((m) => setApiMetrics(m))
      .catch(() => setApiMetrics(null));
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;
    setMembershipLoaded(false);

    void (async () => {
      try {
        const out = await joinChannel(channelId);
        if (cancelled) return;
        if (out.status === "pending") {
          router.push(`/join/pending?channel=${encodeURIComponent(channelId)}`);
          return;
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Cannot join this channel";
          showToast(message, "error");
        }
      }

      try {
        const me = await getMe();
        if (cancelled) return;
        if (!me?.user) {
          setCurrentUserId(null);
          setCanManageChannel(false);
          return;
        }
        setCurrentUserId(me.user.id);
        try {
          const members = await getChannelMembers(channelId);
          if (cancelled) return;
          const myMembership = members.results.find((member) => member.user_id === me.user.id);
          const canManage =
            myMembership?.role === "owner" ||
            myMembership?.role === "moderator" ||
            (channelOwnerId != null && Number(channelOwnerId) === Number(me.user.id));
          setCanManageChannel(Boolean(canManage));
        } catch {
          if (!cancelled) setCanManageChannel(false);
        }
      } catch {
        if (!cancelled) {
          setCurrentUserId(null);
          setCanManageChannel(false);
        }
      } finally {
        if (!cancelled) setMembershipLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [channelId, channelOwnerId, showToast]);

  useEffect(() => {
    const fn = (ev: Event) => {
      const e = ev as CustomEvent<{ channelId?: string; experience?: ChannelExperience }>;
      if (String(e.detail?.channelId ?? "") !== String(channelId)) return;
      if (e.detail?.experience && typeof e.detail.experience === "object") {
        setExperience(e.detail.experience);
      }
    };
    window.addEventListener("channel-experience", fn);
    return () => window.removeEventListener("channel-experience", fn);
  }, [channelId]);

  function applyChannelClosedNavigation() {
    upsertGlobalPlayerState({
      channelId: null,
      socketState: "closed",
      trackPath: undefined,
      startedAt: undefined,
      pausedAt: undefined,
      initialIsPlaying: false,
      canControl: false,
      sendSocketMessage: undefined,
      experience: null,
    });
    router.replace("/dashboard");
  }

  async function confirmLeaveChannel() {
    setLeaveBusy(true);
    try {
      await leaveChannel(channelId);
      upsertGlobalPlayerState({
        channelId: null,
        socketState: "closed",
        trackPath: undefined,
        startedAt: undefined,
        pausedAt: undefined,
        initialIsPlaying: false,
        canControl: false,
        sendSocketMessage: undefined,
        experience: null,
      });
      showToast("You left the channel.", "success");
      setLeaveDialogOpen(false);
      router.replace("/dashboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not leave channel.";
      showToast(msg, "error");
      setLeaveBusy(false);
    }
  }

  useEffect(() => {
    if (!canManageChannel && activeTab === "admin") {
      setActiveTab("player");
    }
  }, [activeTab, canManageChannel]);

  useEffect(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (params.get("tab") === activeTab) return;
    params.set("tab", activeTab);
    const qs = params.toString();
    window.history.replaceState(window.history.state, "", qs.length ? `${pathname}?${qs}` : pathname);
  }, [activeTab, pathname, searchParams]);

  useEffect(() => {
    upsertGlobalPlayerState({
      channelId,
      socketState,
      trackPath,
      startedAt,
      pausedAt,
      initialIsPlaying: isPlaying,
      canControl: canManageChannel && channelIsActive && !viewAsListener,
      sendSocketMessage: stableSendSocketMessage,
      experience,
    });
  }, [
    canManageChannel,
    channelIsActive,
    channelId,
    experience,
    isPlaying,
    pausedAt,
    socketState,
    stableSendSocketMessage,
    startedAt,
    trackPath,
    upsertGlobalPlayerState,
    viewAsListener,
  ]);

  useEffect(() => {
    return () => {
      upsertGlobalPlayerState({
        channelId: null,
        socketState: "closed",
        trackPath: undefined,
        startedAt: undefined,
        pausedAt: undefined,
        initialIsPlaying: false,
        canControl: false,
        sendSocketMessage: undefined,
        experience: null,
      });
    };
  }, [upsertGlobalPlayerState]);

  const nowPlayingLabel = deriveNowPlayingLabel(trackPath, latestPlaybackPayload);

  const closeChannelDialog = (
    <Dialog open={closeChannelDialogOpen} onOpenChange={(open) => !closeChannelBusy && setCloseChannelDialogOpen(open)}>
      <DialogContent className="border-border bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("room.dialog.close.title")}</DialogTitle>
          <DialogDescription>{t("room.dialog.close.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="secondary" disabled={closeChannelBusy} onClick={() => setCloseChannelDialogOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={closeChannelBusy}
            onClick={() => {
              void (async () => {
                setCloseChannelBusy(true);
                try {
                  await closeChannel(channelId);
                  showToast(t("room.dialog.close.success"), "success");
                  setCloseChannelDialogOpen(false);
                  applyChannelClosedNavigation();
                } catch (error) {
                  showToast(error instanceof Error ? error.message : t("room.dialog.close.failed"), "error");
                } finally {
                  setCloseChannelBusy(false);
                }
              })();
            }}
          >
            {closeChannelBusy ? t("common.closing") : t("room.dialog.close.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const leaveDialog = (
    <Dialog open={leaveDialogOpen} onOpenChange={(open) => !leaveBusy && setLeaveDialogOpen(open)}>
      <DialogContent className="border-border bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("room.dialog.leave.title")}</DialogTitle>
          <DialogDescription>{t("room.dialog.leave.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="secondary" disabled={leaveBusy} onClick={() => setLeaveDialogOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="destructive" disabled={leaveBusy} onClick={() => void confirmLeaveChannel()}>
            {leaveBusy ? t("common.leaving") : t("room.dialog.leave.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const currentTrackId =
    latestPlaybackPayload && typeof (latestPlaybackPayload as { track?: { id?: number } }).track?.id === "number"
      ? (latestPlaybackPayload as { track?: { id?: number } }).track!.id!
      : null;

  useEffect(() => {
    upsertGlobalPlayerState({ currentTrackId });
  }, [currentTrackId, upsertGlobalPlayerState]);

  if (!membershipLoaded) {
    return (
      <>
        <ChannelRoomLoading />
        {leaveDialog}
      </>
    );
  }

  if (!canManageChannel || viewAsListener) {
    const listenerTabContent: Record<ListenerTabId, ReactNode> = {
      chat: (
        <ChannelChatPanel
          channelId={channelId}
          channelIsActive={channelIsActive}
          connectEnabled={membershipLoaded && currentUserId !== null}
          variant="listener"
          canModerate={false}
          nowPlayingLabel={nowPlayingLabel}
          channelName={channelName}
          roomActiveTab="chat"
          fullHeight
        />
      ),
      suggestions: (
        <ChannelListenerPanelShell tab="suggestions">
          <ChannelTrackSuggestions channelId={channelId} canManage={false} variant="listener" />
        </ChannelListenerPanelShell>
      ),
      queue: (
        <ChannelListenerPanelShell
          tab="queue"
          badge={
            (wsQueue?.length ?? 0) > 0 ? (
              <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
                {wsQueue?.length}
              </span>
            ) : null
          }
        >
          <ChannelQueuePanel channelId={channelId} variant="listener" currentTrackId={currentTrackId} />
        </ChannelListenerPanelShell>
      ),
      info: (
        <ChannelListenerPanelShell tab="info">
          <ChannelListenerMeta
            description={initialDescription}
            memberLimit={initialMemberLimit}
            joinRequiresApproval={initialJoinRequiresApproval}
            experience={experience}
            onlineCount={onlineCount}
          />
          {experience?.blind_playlist_id ? (
            <ChannelBlindGuessPanel channelId={channelId} currentTrackId={currentTrackId} />
          ) : null}
        </ChannelListenerPanelShell>
      ),
    };

    return (
      <div className="flex flex-1 flex-col max-lg:overflow-visible lg:min-h-0 lg:overflow-hidden">
      <ChannelQueueProvider channelId={channelId} wsQueue={wsQueue} enabled={channelIsActive}>
        <RoomOnboarding channelId={channelId} />
        <ChannelListenerShell
          channelId={channelId}
          channelName={channelName}
          brandLogoUrl={brandLogoUrl}
          isLive={isChannelOnline}
          activeTab={listenerTab}
          onSelectTab={setListenerTab}
          onChatTabOpen={() => setChatTabUnread(0)}
          onSendReaction={(emoji) => {
            sendMessage({ action: "reaction", emoji });
          }}
          chatUnread={chatTabUnread}
          onShare={shareChannel}
          viewAsListener={viewAsListener}
          onBackToAdmin={() => setViewAsListener(false)}
        >
          {listenerTabContent[listenerTab]}
        </ChannelListenerShell>
        {leaveDialog}
      </ChannelQueueProvider>
      </div>
    );
  }


  const chatPanel = (
    <ChannelChatPanel
      channelId={channelId}
      channelIsActive={channelIsActive}
      connectEnabled={membershipLoaded && currentUserId !== null}
      variant="admin"
      canModerate={canManageChannel}
      nowPlayingLabel={nowPlayingLabel}
      channelName={channelName}
      roomActiveTab={activeTab}
      fullHeight
    />
  );

  const queuePanel = (
    <ChannelAdminQueuePanel channelId={channelId} readOnly={!channelIsActive} currentTrackId={currentTrackId} />
  );

  const statusBanner =
    !channelIsActive && isChannelOwner ? (
      <div className="mb-3 flex shrink-0 flex-col gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-amber-800 dark:text-amber-100/90">{t("room.admin.closedBanner")}</p>
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          onClick={() => {
            void (async () => {
              try {
                await reopenChannel(channelId);
                showToast(t("channels.reopenSuccess"), "success");
                router.refresh();
              } catch (e) {
                showToast(e instanceof Error ? e.message : t("channels.reopenFailed"), "error");
              }
            })();
          }}
        >
          {t("room.admin.reopenChannel")}
        </Button>
      </div>
    ) : null;

  function renderManagerTabContent(): ReactNode {
    switch (activeTab) {
      case "chat": return chatPanel;
      case "player":
        return (
          <ChannelAdminPlayerPanel
            channelId={channelId}
            canManage={canManageChannel}
            channelIsActive={channelIsActive}
            sendSocketMessage={sendMessage}
          />
        );
      case "queue":
        return queuePanel;
      case "suggestions":
        return <ChannelAdminSuggestionsPanel channelId={channelId} canManage={canManageChannel} />;
      case "insights":
        return (
          <ChannelRoomInsights
            channelId={channelId}
            canManage={canManageChannel}
            currentTrackId={currentTrackId}
            experience={experience}
          />
        );
      case "listeners": return canManageChannel ? <ChannelListenersPanel channelId={channelId} canManage={canManageChannel} isOwner={isChannelOwner} channelIsActive={channelIsActive} onPreviewListenerView={() => setViewAsListener(true)} /> : null;
      case "admin":
        return canManageChannel ? (
          <ChannelAdminPanel
            channelId={channelId}
            initialName={channelName}
            initialDescription={initialDescription}
            initialPrivacy={(channelPrivacy as "public" | "private" | "unlisted") ?? "public"}
            initialMemberLimit={initialMemberLimit ?? 50}
            publicSlug={publicSlug}
            publicJoinSlug={publicJoinSlug}
            initialJoinRequiresApproval={initialJoinRequiresApproval ?? false}
            sendSocketMessage={sendMessage}
            channelIsActive={channelIsActive}
            canDeleteChannel={isChannelOwner}
            initialExperience={initialExperience ?? null}
            viewAsListener={viewAsListener}
            onViewAsListenerChange={setViewAsListener}
            embedded
          />
        ) : null;
      case "health":
        return (
          <ChannelAdminHealthPanel
            startedAtText={startedAtText}
            pausedAtText={pausedAtText}
            rttMs={rttMs}
            jitterMs={jitterMs}
            reconnectCount={reconnectCount}
            clockOffsetMs={clockOffsetMs}
            apiMetrics={apiMetrics}
          />
        );
      default: return null;
    }
  }

  const queueBadge =
    activeTab === "queue" && (wsQueue?.length ?? 0) > 0 ? (
      <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
        {wsQueue?.length}
      </span>
    ) : null;

  return (
    <div className="flex flex-1 flex-col max-lg:overflow-visible lg:min-h-0 lg:overflow-hidden">
    <ChannelQueueProvider channelId={channelId} wsQueue={wsQueue} enabled={channelIsActive}>
      <RoomReactionProvider channelId={channelId}>
        <RoomOnboarding channelId={channelId} />
        <div className="flex flex-1 flex-col max-lg:overflow-visible lg:min-h-0 lg:overflow-hidden">
          <ChannelAdminShell
            className="lg:min-h-0 lg:flex-1"
            channelName={channelName}
            brandLogoUrl={brandLogoUrl}
            isLive={isChannelOnline}
            socketState={socketState}
            channelIsActive={channelIsActive}
            onlineCount={onlineCount}
            activeTab={activeTab}
            onSelectTab={selectTab}
            onChatTabOpen={() => setChatTabUnread(0)}
            onSendReaction={(emoji) => {
              sendMessage({ action: "reaction", emoji });
            }}
            onShare={shareChannel}
            onViewAsListener={() => setViewAsListener(true)}
            showLeave={!isChannelOwner && currentUserId != null}
            onLeave={() => setLeaveDialogOpen(true)}
            onCloseChannel={isChannelOwner && channelIsActive ? () => setCloseChannelDialogOpen(true) : undefined}
            chatUnread={chatTabUnread}
            pendingSuggestionsCount={pendingSuggestionsCount}
            canManage={canManageChannel}
            statusBanner={statusBanner}
          >
            <div className="flex flex-1 flex-col max-lg:overflow-visible lg:h-full lg:min-h-0 lg:overflow-hidden">
              {activeTab === "chat" ? (
                <ChannelAdminPanelShell bare>{chatPanel}</ChannelAdminPanelShell>
              ) : (
                <>
                  {!isAdminFlushTab(activeTab) ? <ChannelAdminPageHeader activeTab={activeTab} /> : null}
                  <ChannelAdminPanelShell flush={isAdminFlushTab(activeTab)} badge={queueBadge} className="min-h-0 flex-1">
                    {renderManagerTabContent()}
                  </ChannelAdminPanelShell>
                </>
              )}
            </div>
          </ChannelAdminShell>

          {closeChannelDialog}
          {leaveDialog}
        </div>
      </RoomReactionProvider>
    </ChannelQueueProvider>
    </div>
  );
}
