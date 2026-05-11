"use client";

import { Activity, DoorClosed, HeartPulse, LogOut, MessageSquare, Radio, Settings2, Sparkles } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast-provider";
import { ChannelAdminPanel } from "@/features/channels/channel-admin-panel";
import { ChannelChatPanel } from "@/features/channels/channel-chat-panel";
import { ChannelListenerView, ChannelRoomLoading } from "@/features/channels/channel-listener-view";
import { ChannelPlaylistPanel } from "@/features/channels/channel-playlist-panel";
import { ChannelQueuePanel } from "@/features/channels/channel-queue-panel";
import { useGlobalChannelPlayer } from "@/features/player/global-channel-player-context";
import { RoomExperienceChrome, type ChannelExperience } from "@/features/experience/room-experience-chrome";
import { useReconnectingChannelSocket } from "@/hooks/use-reconnecting-channel-socket";
import {
  closeChannel,
  getChannelMembers,
  getMe,
  joinChannel,
  leaveChannel,
  reopenChannel,
  type QueueItemSummary,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const TAB_IDS = ["chat", "player", "queue", "admin", "health"] as const;

type TabId = (typeof TAB_IDS)[number];

function tabFromSearchValue(value: string | null): TabId | null {
  const raw = value ?? "";
  if (raw === "playlist") return "player";
  return TAB_IDS.includes(raw as TabId) ? (raw as TabId) : null;
}

function readTabFromWindowSearch(): TabId | null {
  if (typeof window === "undefined") return null;
  return tabFromSearchValue(new URLSearchParams(window.location.search).get("tab"));
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
  const latestSendMessageRef = useRef<((payload: Record<string, unknown>) => boolean) | undefined>(undefined);
  const startedAtText = startedAt == null ? "No active playback session yet" : `${startedAt}`;
  const pausedAtText = pausedAt == null ? (isChannelOnline ? "Not paused" : "No paused position available") : `${pausedAt}s`;

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
      if (type === "error") {
        const map: Record<string, string> = {
          queue_empty: "Queue is empty. Select a playlist/track first.",
          playlist_empty: "Selected playlist is empty.",
          playlist_not_allowed: "This playlist is not allowed for this channel.",
          no_tracks: "No tracks available to shuffle.",
          permission_denied: "You do not have permission for this action.",
          shout_cooldown: "Wait a few seconds before shouting again.",
          queue_locked: "Queue is locked — only the room owner can add tracks.",
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
      if (["initial_sync", "play", "pause", "seek", "next", "prev", "add_to_queue", "enqueue_next"].includes(action)) {
        setLatestPlaybackPayload(data);
        window.dispatchEvent(new CustomEvent("channel-playback-updated", { detail: { channelId, payload: data } }));
      }
    },
    [channelId, showToast],
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
  }, [searchParams]);

  useEffect(() => {
    if (activeTab !== "chat" || !membershipLoaded) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("channel-chat-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, membershipLoaded]);

  useEffect(() => {
    let cancelled = false;
    setMembershipLoaded(false);

    void (async () => {
      try {
        const out = await joinChannel(channelId);
        if (cancelled) return;
        if (out.status === "pending") {
          showToast("Your join request is pending moderator approval.", "info");
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
          const canManage = myMembership?.role === "owner" || myMembership?.role === "moderator";
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
  }, [channelId, showToast]);

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
      latestSocketPayload: null,
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
        latestSocketPayload: null,
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
      latestSocketPayload: latestPlaybackPayload,
      experience,
    });
  }, [
    canManageChannel,
    channelIsActive,
    channelId,
    experience,
    isPlaying,
    latestPlaybackPayload,
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
        socketState: "closed",
        canControl: false,
        sendSocketMessage: undefined,
      });
    };
  }, [upsertGlobalPlayerState]);

  const nowPlayingLabel = deriveNowPlayingLabel(trackPath, latestPlaybackPayload);

  const closeChannelDialog = (
    <Dialog open={closeChannelDialogOpen} onOpenChange={(open) => !closeChannelBusy && setCloseChannelDialogOpen(open)}>
      <DialogContent className="border-zinc-800 bg-zinc-950 sm:max-w-md">
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
      <DialogContent className="border-zinc-800 bg-zinc-950 sm:max-w-md">
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

  if (!membershipLoaded) {
    return (
      <>
        <ChannelRoomLoading />
        {leaveDialog}
      </>
    );
  }

  if (!canManageChannel) {
    return (
      <>
        <RoomExperienceChrome
          channelId={channelId}
          sendMessage={sendMessage}
          socketState={socketState}
          canControl={false}
          experience={experience}
        />
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
          showLeave={!isChannelOwner && currentUserId !== null}
          onLeaveClick={() => setLeaveDialogOpen(true)}
          brandLogoUrl={brandLogoUrl ?? undefined}
          sendSocketMessage={sendMessage}
          experience={experience}
        />
        <div className="mx-auto w-full max-w-3xl px-3 sm:px-6">
          <ChannelChatPanel
            channelId={channelId}
            channelIsActive={channelIsActive}
            connectEnabled={membershipLoaded && currentUserId !== null}
            variant="listener"
            canModerate={canManageChannel}
          />
        </div>
        {leaveDialog}
      </>
    );
  }

  return (
    <div className="space-y-6 pb-28">
      <RoomExperienceChrome
        channelId={channelId}
        sendMessage={sendMessage}
        socketState={socketState}
        canControl={Boolean(canManageChannel && channelIsActive)}
        experience={experience}
      />
      {!channelIsActive && isChannelOwner ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-500/35 bg-amber-950/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-amber-100/90">This channel is closed — playback and sync stay off until you reopen.</p>
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            onClick={() => {
              void (async () => {
                try {
                  await reopenChannel(channelId);
                  showToast("Channel reopened.", "success");
                  router.refresh();
                } catch (e) {
                  showToast(e instanceof Error ? e.message : "Could not reopen.", "error");
                }
              })();
            }}
          >
            Reopen channel
          </Button>
        </div>
      ) : null}
      <section
        className={cn(
          "overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-5 shadow-lg shadow-black/20 backdrop-blur-xl",
          "animate-in fade-in slide-in-from-bottom-2 duration-500",
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {brandLogoUrl ? (
              <img src={brandLogoUrl} alt="" className="h-14 w-14 shrink-0 rounded-2xl border border-white/10 object-cover shadow-lg" />
            ) : null}
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-widest text-emerald-500/90">Control room</p>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{channelName}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isChannelOwner && channelIsActive ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={() => setCloseChannelDialogOpen(true)}
              >
                <DoorClosed className="h-4 w-4" aria-hidden />
                Close channel
              </Button>
            ) : null}
            {!isChannelOwner && currentUserId != null ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-red-900/60 text-red-200 hover:bg-red-950/40"
                onClick={() => setLeaveDialogOpen(true)}
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Leave channel
              </Button>
            ) : null}
            <Badge variant={isChannelOnline ? "success" : "secondary"}>{isChannelOnline ? "Live" : "Idle"}</Badge>
            <Badge variant={isChannelOnline ? "success" : "outline"} className="capitalize">
              {isChannelOnline ? "Playing" : "Paused"}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {channelPrivacy}
            </Badge>
            {!channelIsActive ? (
              <Badge variant="warning">Closed</Badge>
            ) : (
              <Badge variant={socketState === "connected" ? "success" : "warning"}>{socketState}</Badge>
            )}
          </div>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="w-full animate-in fade-in duration-500">
        <div className="overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:overflow-visible">
          <TabsList className="inline-flex min-h-11 w-max min-w-full flex-wrap justify-start gap-1 sm:w-full sm:flex-nowrap sm:justify-center">
            <TabsTrigger value="chat" className="gap-1.5">
              <MessageSquare className="h-4 w-4 opacity-80" aria-hidden />
              Chat
            </TabsTrigger>
            <TabsTrigger value="player" className="gap-1.5">
              <Radio className="h-4 w-4 opacity-80" aria-hidden />
              Listen
            </TabsTrigger>
            <TabsTrigger value="queue" className="gap-1.5">
              <Sparkles className="h-4 w-4 opacity-80" aria-hidden />
              Queue
            </TabsTrigger>
            {canManageChannel ? (
              <TabsTrigger value="admin" className="gap-1.5">
                <Settings2 className="h-4 w-4 opacity-80" aria-hidden />
                Control
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="health" className="gap-1.5">
              <HeartPulse className="h-4 w-4 opacity-80" aria-hidden />
              Health
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className="mt-5">
          <ChannelChatPanel
            channelId={channelId}
            channelIsActive={channelIsActive}
            connectEnabled={membershipLoaded && currentUserId !== null}
            variant="admin"
            canModerate={canManageChannel}
          />
        </TabsContent>

        <TabsContent value="player" className="mt-5 focus-visible:outline-none space-y-6">
          <ChannelPlaylistPanel channelId={channelId} canManage={canManageChannel && channelIsActive} sendSocketMessage={sendMessage} />
          <Card className="border-zinc-800/90 transition-shadow duration-300 hover:shadow-lg hover:shadow-black/20">
            <CardHeader className="border-b border-zinc-800/80 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-950/40">
                  <Activity className="h-5 w-5 text-emerald-400" aria-hidden />
                </span>
                Player
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 text-sm text-zinc-400">
              <p className="leading-relaxed">Mini player is pinned at the bottom of the screen.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="mt-5">
          <ChannelQueuePanel channelId={channelId} readOnly={!channelIsActive} />
        </TabsContent>

        {canManageChannel ? (
          <TabsContent value="admin" className="mt-5">
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
            />
          </TabsContent>
        ) : null}

        <TabsContent value="health" className="mt-5">
          <Card className="border-zinc-800/90 transition-shadow duration-300 hover:shadow-lg hover:shadow-black/20">
            <CardHeader className="border-b border-zinc-800/80 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-950/40">
                  <HeartPulse className="h-5 w-5 text-emerald-400" aria-hidden />
                </span>
                Sync
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-6 text-sm text-zinc-400">
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-4">
                <p>
                  <span className="font-medium text-zinc-500">Session started</span>
                  <span className="mt-1 block font-mono text-xs text-zinc-300 sm:text-sm">{startedAtText}</span>
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-4">
                <p>
                  <span className="font-medium text-zinc-500">Paused position</span>
                  <span className="mt-1 block font-mono text-xs text-zinc-300 sm:text-sm">{pausedAtText}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {closeChannelDialog}
      {leaveDialog}
    </div>
  );
}
