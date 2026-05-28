"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type PlaybackPayload = {
  action?: string;
  event_seq?: number;
  is_playing?: boolean;
  started_at_server_time?: number | null;
  position?: number | null;
  track_file?: string | null;
  playlist_id?: number;
  queue?: Array<{
    id: number;
    channel: number;
    track: number;
    position: number;
    added_by: number | null;
    created_at: string;
  }>;
};

type GlobalChannelPlayerState = {
  channelId: string | null;
  socketState: "connecting" | "connected" | "reconnecting" | "closed";
  trackPath?: string;
  startedAt?: number | null;
  pausedAt?: number | null;
  initialIsPlaying: boolean;
  canControl: boolean;
  sendSocketMessage?: (payload: Record<string, unknown>) => boolean;
  experience?: import("@/features/experience/components/room-experience-chrome").ChannelExperience | null;
  currentTrackId?: number | null;
};

const defaultState: GlobalChannelPlayerState = {
  channelId: null,
  socketState: "closed",
  trackPath: undefined,
  startedAt: undefined,
  pausedAt: undefined,
  initialIsPlaying: false,
  canControl: false,
  sendSocketMessage: undefined,
  experience: null,
  currentTrackId: null,
};

type GlobalChannelPlayerContextValue = {
  state: GlobalChannelPlayerState;
  upsertState: (next: Partial<GlobalChannelPlayerState>) => void;
  expanded: boolean;
  setExpanded: (next: boolean) => void;
};

const GlobalChannelPlayerContext = createContext<GlobalChannelPlayerContextValue | null>(null);

export function GlobalChannelPlayerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GlobalChannelPlayerState>(defaultState);
  const [expanded, setExpanded] = useState(false);
  const upsertState = useCallback((next: Partial<GlobalChannelPlayerState>) => {
    setState((prev) => {
      const merged = { ...prev, ...next };
      const changed = (Object.keys(next) as Array<keyof GlobalChannelPlayerState>).some((key) => prev[key] !== merged[key]);
      return changed ? merged : prev;
    });
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("global-player-expanded");
      if (saved === "true") setExpanded(true);
    } catch {
      // Ignore storage access errors in restricted contexts.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("global-player-expanded", String(expanded));
    } catch {
      // Ignore storage access errors in restricted contexts.
    }
  }, [expanded]);

  const value = useMemo<GlobalChannelPlayerContextValue>(
    () => ({
      state,
      upsertState,
      expanded,
      setExpanded,
    }),
    [expanded, state, upsertState],
  );

  return <GlobalChannelPlayerContext.Provider value={value}>{children}</GlobalChannelPlayerContext.Provider>;
}

export function useGlobalChannelPlayer() {
  const ctx = useContext(GlobalChannelPlayerContext);
  if (!ctx) {
    throw new Error("useGlobalChannelPlayer must be used within GlobalChannelPlayerProvider");
  }
  return ctx;
}
