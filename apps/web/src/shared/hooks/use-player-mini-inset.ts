"use client";

import { useEffect, type RefObject } from "react";

/** Publishes fixed mini-player height to `--player-mini-inset` on <html> for page padding. */
export function usePlayerMiniInset(shellRef: RefObject<HTMLElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) {
      document.documentElement.style.setProperty("--player-mini-inset", "0px");
      return;
    }

    const el = shellRef.current;
    if (!el) return;

    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--player-mini-inset", `${h}px`);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);

    return () => {
      ro.disconnect();
      document.documentElement.style.setProperty("--player-mini-inset", "0px");
    };
  }, [enabled, shellRef]);
}
