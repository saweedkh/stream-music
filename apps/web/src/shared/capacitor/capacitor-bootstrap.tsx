"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { registerCapacitorBackgroundAudio } from "@/lib/capacitor-background-audio";
import { configureCapacitorNativeUi, isCapacitorNative } from "@/lib/capacitor-runtime";
import { registerCapacitorDeepLinks } from "@/lib/capacitor-deep-links";

/** Runs once on mount in native WebView — status bar, splash, deep links. */
export function CapacitorBootstrap() {
  const router = useRouter();
  useEffect(() => {
    if (!isCapacitorNative()) return;
    void configureCapacitorNativeUi();
    registerCapacitorBackgroundAudio();
    registerCapacitorDeepLinks((path) => router.push(path));
  }, [router]);
  return null;
}
