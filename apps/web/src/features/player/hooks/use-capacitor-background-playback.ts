"use client";

import { useEffect } from "react";
import { registerCapacitorBackgroundAudio } from "@/lib/capacitor-background-audio";

/** Register native background playback keepalive once per app session. */
export function useCapacitorBackgroundPlayback(isPlaying: boolean, channelId: string): void {
  useEffect(() => {
    registerCapacitorBackgroundAudio();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("sm-playback-intent", { detail: { channelId, playing: isPlaying } }),
    );
  }, [channelId, isPlaying]);
}
