"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { checkApiHealth } from "@/lib/api";

export function ConnectivityBanner() {
  const [online, setOnline] = useState(true);
  const [apiOk, setApiOk] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const h = await checkApiHealth();
        if (!cancelled) setApiOk(h.status === "ok");
      } catch {
        if (!cancelled) setApiOk(false);
      }
    };
    void probe();
    const id = window.setInterval(() => void probe(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [online]);

  if (online && apiOk) return null;

  async function retry() {
    setChecking(true);
    try {
      const h = await checkApiHealth();
      setApiOk(h.status === "ok");
      setOnline(navigator.onLine);
    } catch {
      setApiOk(false);
    } finally {
      setChecking(false);
    }
  }

  return (
    <Alert className="mb-4 border-amber-500/40 bg-amber-950/40 text-amber-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {!online
            ? "You appear to be offline. Playback and chat will resume when the network returns."
            : "Cannot reach the Stream Music server. Check that the stack is running and this device can reach the host."}
        </p>
        <Button type="button" size="sm" variant="secondary" disabled={checking} onClick={() => void retry()}>
          {checking ? "Checking…" : "Retry"}
        </Button>
      </div>
    </Alert>
  );
}
