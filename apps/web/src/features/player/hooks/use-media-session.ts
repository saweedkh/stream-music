"use client";

import { useEffect } from "react";

type Props = {
  title?: string;
  artist?: string;
  isPlaying: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
};

/** Lock-screen / notification controls (PWA + many mobile browsers). */
export function useMediaSession({ title, artist, isPlaying, onPlay, onPause, onNext }: Props) {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({
      title: title || "Stream Music",
      artist: artist || "",
      album: "Live room",
    });
    const play = () => onPlay?.();
    const pause = () => onPause?.();
    const next = () => onNext?.();
    try {
      ms.setActionHandler("play", play);
      ms.setActionHandler("pause", pause);
      ms.setActionHandler("nexttrack", next);
    } catch {
      /* unsupported */
    }
    ms.playbackState = isPlaying ? "playing" : "paused";
    return () => {
      try {
        ms.setActionHandler("play", null);
        ms.setActionHandler("pause", null);
        ms.setActionHandler("nexttrack", null);
      } catch {
        /* ignore */
      }
    };
  }, [title, artist, isPlaying, onPlay, onPause, onNext]);
}
