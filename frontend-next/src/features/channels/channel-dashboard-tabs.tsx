"use client";

import {
  Activity,
  Headphones,
  HeartPulse,
  Lightbulb,
  MessageSquare,
  Radio,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-provider";
import { ChannelAdminPanel } from "@/features/channels/channel-admin-panel";
import { ChannelChatPanel } from "@/features/channels/channel-chat-panel";
import {
  ChannelListenerMeta,
  ChannelListenerView,
  ChannelRoomLoading,
} from "@/features/channels/channel-listener-view";
import { ChannelListenersPanel } from "@/features/channels/channel-listeners-panel";
import { ChannelPlaylistPanel } from "@/features/channels/channel-playlist-panel";
import { ChannelQueuePanel } from "@/features/channels/channel-queue-panel";
import { ChannelQueueProvider } from "@/features/channels/channel-queue-context";
import { ChannelUpNextSidebar } from "@/features/channels/channel-up-next-sidebar";
import { ChannelRoomShell } from "@/features/channels/channel-room-shell";
import {
  CHANNEL_GROUP_LABELS,
  channelGroupForTab,
  channelTabFromSearch,
  channelTabsInGroup,
  type ChannelTabGroup,
  type ChannelTabId,
} from "@/features/channels/channel-room-config";
import { ChannelRoomInsights } from "@/features/channels/channel-room-insights";
import { ChannelTrackSuggestions } from "@/features/channels/channel-track-suggestions";
import { ChannelMobileBar } from "@/components/room/channel-mobile-bar";
import { ChannelRoomHeader } from "@/components/room/channel-room-header";
import { RoomOnboarding } from "@/components/room/room-onboarding";
import { useRoomHotkeys } from "@/hooks/use-room-hotkeys";
import { useGlobalChannelPlayer } from "@/features/player/global-channel-player-context";
import { RoomExperienceChrome, type ChannelExperience } from "@/features/experience/room-experience-chrome";
import { useChannelPresence } from "@/hooks/use-channel-presence";
import { useReconnectingChannelSocket } from "@/hooks/use-reconnecting-channel-socket";
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
type TabGroup = ChannelTabGroup;

function tabsInGroup(group: TabGroup, canManage: boolean): TabId[] {
  return channelTabsInGroup(group, canManage);
}

function groupForTab(tab: TabId): TabGroup {
  return channelGroupForTab(tab);
}

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
  const { showToast } = useToast();
  const router = useRouter();
  const { upsertState: upsertGlobalPlayerState } = useGlobalChannelPlayer();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>(() => tabFromSearchValue(searchParams.get("tab")) ?? "chat");
  const [tabGroup, setTabGroup] = useState<TabGroup>(() => groupForTab(tabFromSearchValue(searchParams.get("tab")) ?? "chat"));
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
  const [listenerPreviewOpen, setListenerPreviewOpen] = useState(false);
  const { onlineCount } = useChannelPresence(channelId);
  const pushNotification = useNotificationStore((s) => s.push);
  const rttSamplesRef = useRef<number[]>([]);
  const lastTrackKeyRef = useRef<string | null>(null);
  const offsetSamplesRef = useRef<number[]>([]);
  const prevSocketStateRef = useRef<string>("connecting");
  const latestSendMessageRef = useRef<((payload: Record<string, unknown>) => boolean) | undefined>(undefined);
  const startedAtText = startedAt == null ? "No active playback session yet" : `${startedAt}`;
  const pausedAtText = pausedAt == null ? (isChannelOnline ? "Not paused" : "No paused position available") : `${pausedAt}s`;

  function selectTabGroup(group: TabGroup) {
    setTabGroup(group);
    const options = tabsInGroup(group, canManageChannel);
    if (!options.includes(activeTab)) {
      setActiveTab(options[0] ?? "chat");
    }
  }

  function selectTab(tab: TabId) {
    setActiveTab(tab);
    setTabGroup(groupForTab(tab));
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
        const exp = (data as { experience?: unknown }).experience;
        if (exp && typeof exp === "object") {
          window.dispatchEvent(
            new CustomEvent("channel-experience", { detail: { channelId: String(channelId), experience: exp } }),
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
    [activeTab, channelId, channelName, pushNotification, showToast, trackPath],
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

  useRoomHotkeys({
    enabled: membershipLoaded,
    canControl: canManageChannel,
    onHelp: () => window.dispatchEvent(new CustomEvent("channel-room-help")),
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
      canControl: canManageChannel && channelIsActive,
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
          <DialogTitle>Close this channel?</DialogTitle>
          <DialogDescription>Everyone loses access until you reopen the room.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="secondary" disabled={closeChannelBusy} onClick={() => setCloseChannelDialogOpen(false)}>
            Cancel
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
                  showToast("Channel closed.", "success");
                  setCloseChannelDialogOpen(false);
                  applyChannelClosedNavigation();
                } catch (error) {
                  showToast(error instanceof Error ? error.message : "Close failed.", "error");
                } finally {
                  setCloseChannelBusy(false);
                }
              })();
            }}
          >
            {closeChannelBusy ? "Closing…" : "Close"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const leaveDialog = (
    <Dialog open={leaveDialogOpen} onOpenChange={(open) => !leaveBusy && setLeaveDialogOpen(open)}>
      <DialogContent className="border-border bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Leave this channel?</DialogTitle>
          <DialogDescription>You can join again later from the dashboard if you still have access.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="secondary" disabled={leaveBusy} onClick={() => setLeaveDialogOpen(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={leaveBusy} onClick={() => void confirmLeaveChannel()}>
            {leaveBusy ? "Leaving…" : "Leave channel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const currentTrackId =
    latestPlaybackPayload && typeof (latestPlaybackPayload as { track?: { id?: number } }).track?.id === "number"
      ? (latestPlaybackPayload as { track?: { id?: number } }).track!.id!
      : null;

  if (!membershipLoaded) {
    return (
      <>
        <ChannelRoomLoading />
        {leaveDialog}
      </>
    );
  }

  if (!canManageChannel) {
    const listenerChatPanel = (
      <ChannelChatPanel
        channelId={channelId}
        channelIsActive={channelIsActive}
        connectEnabled={membershipLoaded && currentUserId !== null}
        variant="listener"
        canModerate={false}
        nowPlayingLabel={nowPlayingLabel}
        channelName={channelName}
        roomActiveTab="chat"
      />
    );
    const listenerQueuePanel = (
      <div className="space-y-4">
        <ChannelTrackSuggestions channelId={channelId} canManage={false} />
        <ChannelQueuePanel channelId={channelId} readOnly={!channelIsActive} />
      </div>
    );

    return (
      <ChannelQueueProvider channelId={channelId} wsQueue={wsQueue}>
        <RoomOnboarding channelId={channelId} />
        <div className="mx-auto w-full max-w-6xl space-y-6 px-3 pb-28 sm:px-6">
          <RoomExperienceChrome
            channelId={channelId}
            sendMessage={sendMessage}
            socketState={socketState}
            canControl={false}
            experience={experience}
            currentTrackId={currentTrackId}
          />
          <ChannelRoomHeader
            channelName={channelName}
            channelPrivacy={channelPrivacy}
            brandLogoUrl={brandLogoUrl}
            isLive={isChannelOnline}
            isPlaying={isChannelOnline}
            socketState={socketState}
            channelIsActive={channelIsActive}
            nowPlayingLabel={nowPlayingLabel}
            accent={experience.accent}
            showLeave={!isChannelOwner && currentUserId !== null}
            onLeave={() => setLeaveDialogOpen(true)}
            onShare={shareChannel}
            onlineCount={onlineCount}
          />
          <ChannelListenerMeta
            description={initialDescription}
            memberLimit={initialMemberLimit}
            joinRequiresApproval={initialJoinRequiresApproval}
            experience={experience}
          />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,15.5rem)]">
            <div className="min-w-0">{listenerChatPanel}</div>
            <ChannelUpNextSidebar className="hidden lg:block" currentTrackId={currentTrackId} />
          </div>
          <ChannelMobileBar
            chatUnread={chatTabUnread}
            chatPanel={listenerChatPanel}
            queuePanel={listenerQueuePanel}
            onChatOpen={() => setChatTabUnread(0)}
          />
        </div>
        {leaveDialog}
      </ChannelQueueProvider>
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
    />
  );

  const queuePanel = <ChannelQueuePanel channelId={channelId} readOnly={!channelIsActive} />;

  const roomHeader = (
    <>
      {!channelIsActive && isChannelOwner ? (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-800 dark:text-amber-100/90">This channel is closed — playback and sync stay off until you reopen.</p>
          <Button type="button" size="sm" className="shrink-0" onClick={() => { void (async () => { try { await reopenChannel(channelId); showToast("Channel reopened.", "success"); router.refresh(); } catch (e) { showToast(e instanceof Error ? e.message : "Could not reopen.", "error"); } })(); }}>Reopen channel</Button>
        </div>
      ) : null}
      <ChannelRoomHeader channelName={channelName} channelPrivacy={channelPrivacy} brandLogoUrl={brandLogoUrl} isLive={isChannelOnline} isPlaying={isChannelOnline} socketState={socketState} channelIsActive={channelIsActive} nowPlayingLabel={nowPlayingLabel} accent={experience.accent} isOwner={isChannelOwner} showLeave={!isChannelOwner && currentUserId != null} onLeave={() => setLeaveDialogOpen(true)} onCloseChannel={isChannelOwner && channelIsActive ? () => setCloseChannelDialogOpen(true) : undefined} onShare={shareChannel} onlineCount={onlineCount} />
    </>
  );

  function renderManagerTab() {
    switch (activeTab) {
      case "chat": return chatPanel;
      case "player": return (<div className="space-y-6"><ChannelPlaylistPanel channelId={channelId} canManage={canManageChannel && channelIsActive} sendSocketMessage={sendMessage} /><Card><CardHeader className="border-b border-border/60 pb-4"><CardTitle className="flex items-center gap-2 text-lg"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand/25 bg-brand/10"><Activity className="h-5 w-5 text-brand" aria-hidden /></span>Player</CardTitle></CardHeader><CardContent className="pt-6 text-sm text-muted-foreground"><p>Mini player is pinned at the bottom of the screen.</p></CardContent></Card></div>);
      case "queue":
        return (
          <div className="space-y-6">
            <ChannelTrackSuggestions channelId={channelId} canManage={canManageChannel} />
            {queuePanel}
          </div>
        );
      case "insights": return <ChannelRoomInsights channelId={channelId} canManage={canManageChannel} currentTrackId={currentTrackId} />;
      case "listeners": return canManageChannel ? <ChannelListenersPanel channelId={channelId} canManage={canManageChannel} isOwner={isChannelOwner} channelIsActive={channelIsActive} onPreviewListenerView={() => setListenerPreviewOpen(true)} /> : null;
      case "admin": return canManageChannel ? <ChannelAdminPanel channelId={channelId} initialName={channelName} initialDescription={initialDescription} initialPrivacy={(channelPrivacy as "public" | "private" | "unlisted") ?? "public"} initialMemberLimit={initialMemberLimit ?? 50} publicSlug={publicSlug} publicJoinSlug={publicJoinSlug} initialJoinRequiresApproval={initialJoinRequiresApproval ?? false} sendSocketMessage={sendMessage} channelIsActive={channelIsActive} canDeleteChannel={isChannelOwner} initialExperience={initialExperience ?? null} /> : null;
      case "health": return (<Card><CardHeader className="border-b border-border/60 pb-4"><CardTitle className="flex items-center gap-2 text-lg"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand/25 bg-brand/10"><HeartPulse className="h-5 w-5 text-brand" aria-hidden /></span>Sync &amp; health</CardTitle></CardHeader><CardContent className="grid gap-3 pt-6 sm:grid-cols-2">{[{ label: "Session started", value: startedAtText }, { label: "Paused position", value: pausedAtText }, { label: "RTT", value: rttMs != null ? `${rttMs}ms` : "—" }, { label: "Jitter", value: jitterMs != null ? `${jitterMs}ms` : "—" }, { label: "Reconnects", value: String(reconnectCount) }, { label: "Clock offset", value: clockOffsetMs != null ? `${clockOffsetMs}ms` : "—" }].map((row) => (<div key={row.label} className="rounded-lg border border-border/80 bg-muted/15 p-4"><p className="text-xs font-medium text-muted-foreground">{row.label}</p><p className="mt-1 font-mono text-sm">{row.value}</p></div>))}{apiMetrics ? (<div className="rounded-lg border border-border/80 bg-muted/15 p-4 sm:col-span-2"><p className="text-xs font-medium text-muted-foreground">Server</p><ul className="mt-2 grid gap-1 font-mono text-sm sm:grid-cols-2"><li>Active channels: {apiMetrics.channels_active}</li><li>Playing: {apiMetrics.channels_playing}</li><li>Tracks: {apiMetrics.tracks_total}</li><li>Users: {apiMetrics.users_active}</li></ul></div>) : null}</CardContent></Card>);
      default: return null;
    }
  }

  return (
    <ChannelQueueProvider channelId={channelId} wsQueue={wsQueue}>
    <RoomOnboarding channelId={channelId} />
    <div className="space-y-6 pb-28">
      <RoomExperienceChrome
        channelId={channelId}
        sendMessage={sendMessage}
        socketState={socketState}
        canControl={Boolean(canManageChannel && channelIsActive)}
        experience={experience}
        currentTrackId={currentTrackId}
      />
      <ChannelRoomShell
        activeTab={activeTab}
        tabGroup={tabGroup}
        canManage={canManageChannel}
        onTabChange={(tab) => selectTab(tab)}
        onGroupChange={(group) => selectTabGroup(group)}
        header={roomHeader}
        sidebar={
          activeTab !== "queue" ? (
            <ChannelUpNextSidebar
              className="hidden lg:block"
              currentTrackId={currentTrackId}
              canManage={canManageChannel && channelIsActive}
              onOpenQueue={() => {
                selectTabGroup("listen");
                selectTab("queue");
              }}
            />
          ) : null
        }
        mobileBar={
          <ChannelMobileBar
            chatUnread={chatTabUnread}
            chatPanel={chatPanel}
            queuePanel={queuePanel}
            onChatOpen={() => setChatTabUnread(0)}
          />
        }
      >
        {renderManagerTab()}
      </ChannelRoomShell>

      <Sheet open={listenerPreviewOpen} onOpenChange={setListenerPreviewOpen}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Listener view preview</SheetTitle>
            <SheetDescription>This is what non-DJ members see in the room (read-only preview).</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <ChannelListenerView
              channelId={channelId}
              channelName={channelName}
              channelPrivacy={channelPrivacy}
              description={initialDescription}
              memberLimit={initialMemberLimit}
              joinRequiresApproval={initialJoinRequiresApproval}
              isLive={isChannelOnline}
              socketState={socketState}
              nowPlayingLabel={nowPlayingLabel}
              showLeave={false}
              onLeaveClick={() => {}}
              brandLogoUrl={brandLogoUrl ?? undefined}
              channelIsActive={channelIsActive}
              onlineCount={onlineCount}
              onShare={shareChannel}
              experience={experience}
              compact
            />
            <ChannelChatPanel
              channelId={channelId}
              channelIsActive={channelIsActive}
              connectEnabled={membershipLoaded && currentUserId !== null}
              variant="listener"
              canModerate={canManageChannel}
              nowPlayingLabel={nowPlayingLabel}
              channelName={channelName}
              roomActiveTab="chat"
            />
          </div>
        </SheetContent>
      </Sheet>

      {closeChannelDialog}
      {leaveDialog}
    </div>
    </ChannelQueueProvider>
  );
}
