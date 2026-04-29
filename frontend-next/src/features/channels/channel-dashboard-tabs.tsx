"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelAdminPanel } from "@/features/channels/channel-admin-panel";
import { ChannelPlaylistPanel } from "@/features/channels/channel-playlist-panel";
import { ChannelQueuePanel } from "@/features/channels/channel-queue-panel";
import { ChannelPlayer } from "@/features/player/channel-player";
import { useReconnectingChannelSocket } from "@/hooks/use-reconnecting-channel-socket";

type Props = {
  channelId: string;
  channelName: string;
  channelPrivacy: string;
  isPlaying: boolean;
  trackPath?: string;
  startedAt?: number;
  pausedAt?: number;
  initialDescription?: string;
  initialMemberLimit?: number;
  publicSlug?: string;
};

export function ChannelDashboardTabs(props: Props) {
  const {
    channelId,
    channelName,
    channelPrivacy,
    isPlaying,
    trackPath,
    startedAt,
    pausedAt,
    initialDescription,
    initialMemberLimit,
    publicSlug,
  } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const activeTabFromUrl = useMemo(
    () => (tabFromUrl === "player" || tabFromUrl === "playlist" || tabFromUrl === "queue" || tabFromUrl === "admin" || tabFromUrl === "health" ? tabFromUrl : null),
    [tabFromUrl],
  );
  const [activeTab, setActiveTab] = useState<"player" | "playlist" | "queue" | "admin" | "health">(activeTabFromUrl ?? "player");
  const [isChannelOnline, setIsChannelOnline] = useState(isPlaying);
  const startedAtText = startedAt == null ? "No active playback session yet" : `${startedAt}`;
  const pausedAtText = pausedAt == null ? (isChannelOnline ? "Not paused" : "No paused position available") : `${pausedAt}s`;
  const handleSocketMessage = useCallback((payload: unknown) => {
    const data = (payload ?? {}) as { type?: string; action?: string };
    const action = (data.action ?? data.type ?? "").toLowerCase();
    if (action === "play") setIsChannelOnline(true);
    if (action === "pause") setIsChannelOnline(false);
  }, []);
  const { socketState } = useReconnectingChannelSocket({ channelId, onMessage: handleSocketMessage });

  useEffect(() => {
    setIsChannelOnline(isPlaying);
  }, [isPlaying]);

  useEffect(() => {
    if (activeTabFromUrl) setActiveTab(activeTabFromUrl);
  }, [activeTabFromUrl]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("tab") === activeTab) return;
    params.set("tab", activeTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeTab, pathname, router, searchParams]);

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{channelName}</h1>
          <p className="text-sm text-slate-300">Real-time playback, control, and diagnostics.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isChannelOnline ? "success" : "warning"}>{isChannelOnline ? "Online" : "Offline"}</Badge>
          <Badge variant={isChannelOnline ? "success" : "warning"}>{isChannelOnline ? "Playing" : "Paused"}</Badge>
          <Badge>{channelPrivacy}</Badge>
          <Badge variant={socketState === "connected" ? "success" : "warning"}>{socketState}</Badge>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <Button variant={activeTab === "player" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("player")}>Player</Button>
          <Button variant={activeTab === "playlist" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("playlist")}>Playlist</Button>
          <Button variant={activeTab === "queue" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("queue")}>Queue</Button>
          <Button variant={activeTab === "admin" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("admin")}>Admin</Button>
          <Button variant={activeTab === "health" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("health")}>Health</Button>
        </aside>

        <div className="space-y-4">
          {activeTab === "player" ? (
            <ChannelPlayer channelId={channelId} trackPath={trackPath} startedAt={startedAt} pausedAt={pausedAt} initialIsPlaying={isPlaying} />
          ) : null}
          {activeTab === "playlist" ? <ChannelPlaylistPanel channelId={channelId} /> : null}
          {activeTab === "queue" ? <ChannelQueuePanel channelId={channelId} /> : null}
          {activeTab === "admin" ? (
            <ChannelAdminPanel
              channelId={channelId}
              initialName={channelName}
              initialDescription={initialDescription}
              initialPrivacy={(channelPrivacy as "public" | "private" | "unlisted") ?? "public"}
              initialMemberLimit={initialMemberLimit ?? 50}
              publicSlug={publicSlug}
            />
          ) : null}
          {activeTab === "health" ? (
            <Card>
              <CardHeader>
                <CardTitle>Channel Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-300">
                <p>Sync baseline started at: {startedAtText}</p>
                <p>Paused position: {pausedAtText}</p>
                <p>Control and sync state are unified between REST and WebSocket events.</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
