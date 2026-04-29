"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useReconnectingChannelSocket } from "@/hooks/use-reconnecting-channel-socket";
import { API_BASE, getServerTime } from "@/lib/api";
import { applyDriftCorrection } from "./sync-client";

type Props = {
  channelId: string;
  trackPath?: string;
  startedAt?: number | null;
  pausedAt?: number | null;
  initialIsPlaying?: boolean;
};

export function ChannelPlayer({ channelId, trackPath, startedAt, pausedAt, initialIsPlaying = false }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(initialIsPlaying);
  const [syncStartedAt, setSyncStartedAt] = useState<number | null | undefined>(startedAt);
  const [syncPausedAt, setSyncPausedAt] = useState<number | null | undefined>(pausedAt);
  const [activeTrackPath, setActiveTrackPath] = useState<string | undefined>(trackPath);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const handleSocketMessage = useCallback((payload: unknown) => {
    const data = (payload ?? {}) as Record<string, unknown>;
    const audio = audioRef.current;
    if (!audio) return;
    if (data.type === "PLAY" || data.action === "play") {
      setIsPlaying(true);
      if (typeof data.track_file === "string" && data.track_file.length > 0) {
        setActiveTrackPath(data.track_file);
      }
      if (typeof data.started_at_server_time === "number") {
        setSyncStartedAt(data.started_at_server_time);
      }
      audio.play().catch(() => undefined);
    } else if (data.type === "PAUSE" || data.action === "pause") {
      setIsPlaying(false);
      if (typeof data.position === "number") {
        setSyncPausedAt(data.position);
        audio.currentTime = data.position;
      }
      audio.pause();
    } else if ((data.type === "SEEK" || data.action === "seek") && typeof data.position === "number") {
      setSyncPausedAt(data.position);
      audio.currentTime = data.position;
    }
    setLastSyncAt(Date.now());
  }, []);
  const { socketState } = useReconnectingChannelSocket({ channelId, onMessage: handleSocketMessage });

  useEffect(() => {
    getServerTime().then(({ offset }) => setOffsetMs(offset)).catch(() => setOffsetMs(0));
  }, []);

  useEffect(() => {
    setActiveTrackPath(trackPath);
  }, [trackPath]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleTimeUpdate = () => {
      applyDriftCorrection(audio, { startedAt: syncStartedAt, pausedAt: syncPausedAt, offsetMs, isPlaying });
    };
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handleTimeUpdate);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handleTimeUpdate);
    };
  }, [syncStartedAt, syncPausedAt, offsetMs, isPlaying]);

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Synchronized Player</CardTitle>
        <Badge variant={socketState === "connected" ? "success" : "warning"}>{socketState}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {!activeTrackPath ? <Alert tone="error">No active track in this channel yet.</Alert> : null}
        <audio ref={audioRef} src={activeTrackPath ? `${API_BASE}${activeTrackPath}` : undefined} controls className="w-full" />
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          <span>Clock offset: {Math.round(offsetMs)}ms</span>
          <span>Playback: {isPlaying ? "playing" : "paused"}</span>
          <span>Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : "waiting..."}</span>
        </div>
      </CardContent>
    </Card>
  );
}
