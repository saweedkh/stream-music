"use client";

import { isCapacitorNative } from "@/lib/capacitor-runtime";

/** Handle /join/public/slug and /join/private/token deep links in native app. */
export function registerCapacitorDeepLinks(onNavigate: (path: string) => void): void {
  if (!isCapacitorNative()) return;
  void import("@capacitor/app").then(({ App }) => {
    void App.addListener("appUrlOpen", (event) => {
      try {
        const url = new URL(event.url);
        onNavigate(url.pathname + url.search);
      } catch {
        /* ignore */
      }
    });
  });
}
