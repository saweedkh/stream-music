"use client";

import { useEffect } from "react";
import { configureCapacitorNativeUi, isCapacitorNative } from "@/lib/capacitor-runtime";

/** Runs once on mount in native WebView — status bar + splash. */
export function CapacitorBootstrap() {
  useEffect(() => {
    if (!isCapacitorNative()) return;
    void configureCapacitorNativeUi();
  }, []);
  return null;
}
