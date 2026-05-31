"use client";

import { isCapacitorNative } from "@/lib/capacitor-runtime";

type PlaybackIntentDetail = { channelId?: string; playing?: boolean };

let registered = false;
let intendedPlaying = false;
let userPaused = false;

function channelAudioEl(): HTMLAudioElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector("audio[data-channel-audio]") as HTMLAudioElement | null;
}

async function assertBackgroundPlayback(): Promise<void> {
  const audio = channelAudioEl();
  if (!audio || !intendedPlaying || userPaused) return;
  if (audio.paused && audio.src) {
    try {
      await audio.play();
    } catch {
      /* OS may block until user gesture */
    }
  }
}

function onPlaybackIntent(ev: Event) {
  const detail = (ev as CustomEvent<PlaybackIntentDetail>).detail;
  intendedPlaying = Boolean(detail?.playing);
  if (!intendedPlaying) userPaused = false;
}

function onUserPauseIntent() {
  userPaused = true;
  intendedPlaying = false;
}

/** Keep room audio alive when the native app moves to background (Capacitor WebView). */
export function registerCapacitorBackgroundAudio(): void {
  if (typeof window === "undefined" || registered) return;
  registered = true;

  window.addEventListener("sm-playback-intent", onPlaybackIntent);
  window.addEventListener("sm-playback-user-pause", onUserPauseIntent);

  const audio = channelAudioEl();
  if (audio) {
    audio.addEventListener("pause", () => {
      if (!isCapacitorNative() || userPaused || !intendedPlaying) return;
      if (document.visibilityState === "hidden") {
        void assertBackgroundPlayback();
      }
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void assertBackgroundPlayback();
  });

  if (!isCapacitorNative()) return;

  void import("@capacitor/app")
    .then(({ App }) => {
      void App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) void assertBackgroundPlayback();
        else userPaused = false;
      });
    })
    .catch(() => {});
}
