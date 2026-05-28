"use client";

import { useEffect } from "react";

type Options = {
  enabled?: boolean;
  canControl?: boolean;
  onHelp?: () => void;
  onTogglePlay?: () => void;
};

export function useRoomHotkeys({ enabled = true, canControl = false, onHelp, onTogglePlay }: Options) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        onHelp?.();
        return;
      }
      if (e.code === "Space" && canControl) {
        e.preventDefault();
        onTogglePlay?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, canControl, onHelp, onTogglePlay]);
}
