"use client";

import { Activity, HeartPulse, LogOut, Radio, Settings2, Sparkles } from "lucide-react";
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
import { ChannelPlaylistPanel } from "@/features/channels/channel-playlist-panel";
import { ChannelQueuePanel } from "@/features/channels/channel-queue-panel";
import { useGlobalChannelPlayer } from "@/features/player/global-channel-player-context";
import { useReconnectingChannelSocket } from "@/hooks/use-reconnecting-channel-socket";
import { getChannelMembers, getMe, joinChannel, leaveChannel, type QueueItemSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

const TAB_IDS = ["player", "queue", "admin", "health"] as const;

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
  initialJoinRequiresApproval?: boolean;
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
    initialJoinRequiresApproval,
  } = props;
  const { showToast } = useToast();
  const router = useRouter();
  const { upsertState: upsertGlobalPlayerState } = useGlobalChannelPlayer();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>(() => tabFromSearchValue(searchParams.get("tab")) ?? "player");
  const [isChannelOnline, setIsChannelOnline] = useState(isPlaying);
  const [canManageChannel, setCanManageChannel] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
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
      };
      const type = (data.type ?? "").toLowerCase();
      if (type === "error") {
        const map: Record<string, string> = {
          queue_empty: "Queue is empty. Select a playlist/track first.",
          playlist_empty: "Selected playlist is empty.",
          playlist_not_allowed: "This playlist is not allowed for this channel.",
          no_tracks: "No tracks available to shuffle.",
          permission_denied: "You do not have permission for this action.",
        };
        const key = String(data.message ?? "invalid_state");
        showToast(map[key] ?? `Playback error: ${key}`, "error");
        return;
      }
      const action = (data.action ?? data.type ?? "").toLowerCase();
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
    enabled: !leaveBusy,
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
      const next = readTabFromWindowSearch() ?? "player";
      setActiveTab(next);
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  useEffect(() => {
    joinChannel(channelId)
      .then((out) => {
        if (out.status === "pending") {
          showToast("Your join request is pending moderator approval.", "info");
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Cannot join this channel";
        showToast(message, "error");
      });
  }, [channelId, showToast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await getMe();
        if (cancelled) return;
        if (!me) {
          setCurrentUserId(null);
          setCanManageChannel(false);
          return;
        }
        setCurrentUserId(me.id);
        try {
          const members = await getChannelMembers(channelId);
          if (cancelled) return;
          const myMembership = members.results.find((member) => member.user_id === me.id);
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
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [channelId]);

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
  }, [activeTab, pathname]);

  useEffect(() => {
    upsertGlobalPlayerState({
      channelId,
      socketState,
      trackPath,
      startedAt,
      pausedAt,
      initialIsPlaying: isPlaying,
      canControl: canManageChannel,
      sendSocketMessage: stableSendSocketMessage,
      latestSocketPayload: latestPlaybackPayload,
    });
  }, [
    canManageChannel,
    channelId,
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

  return (
    <div className="space-y-6 pb-28">
      <section
        className={cn(
          "overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-5 shadow-lg shadow-black/20 backdrop-blur-xl",
          "animate-in fade-in slide-in-from-bottom-2 duration-500",
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-widest text-emerald-500/90">Channel</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{channelName}</h1>
            <p className="max-w-xl text-sm text-zinc-400">Listen in the docked player, manage the queue, or open controls if you’re a moderator.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <Badge variant={socketState === "connected" ? "success" : "warning"}>{socketState}</Badge>
          </div>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="w-full animate-in fade-in duration-500">
        <div className="overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:overflow-visible">
          <TabsList className="inline-flex min-h-11 w-max min-w-full flex-wrap justify-start gap-1 sm:w-full sm:flex-nowrap sm:justify-center">
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

        <TabsContent value="player" className="mt-5 focus-visible:outline-none space-y-6">
          <ChannelPlaylistPanel channelId={channelId} canManage={canManageChannel} sendSocketMessage={sendMessage} />
          <Card className="border-zinc-800/90 transition-shadow duration-300 hover:shadow-lg hover:shadow-black/20">
            <CardHeader className="border-b border-zinc-800/80 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-950/40">
                  <Activity className="h-5 w-5 text-emerald-400" aria-hidden />
                </span>
                Player
              </CardTitle>
              <CardDescription>The mini player stays fixed at the bottom while you browse this channel.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 text-sm text-zinc-400">
              <p className="leading-relaxed">
                Use the bar to play/pause, scrub, or open the full panel. Audio keeps running when you switch tabs.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queue" className="mt-5">
          <ChannelQueuePanel channelId={channelId} />
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
              initialJoinRequiresApproval={initialJoinRequiresApproval ?? false}
              sendSocketMessage={sendMessage}
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
                Sync &amp; health
              </CardTitle>
              <CardDescription>Baseline from the latest server snapshot for this channel.</CardDescription>
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
              <p className="text-xs text-zinc-500">REST and WebSocket events share the same playback state on the server.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={leaveDialogOpen} onOpenChange={(open) => !leaveBusy && setLeaveDialogOpen(open)}>
        <DialogContent className="border-zinc-800 bg-zinc-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave this channel?</DialogTitle>
            <DialogDescription>
              Playback will stop and you will need to join again to listen. Moderators and owners stay via Control tab — owners cannot leave from here.
            </DialogDescription>
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
    </div>
  );
}
