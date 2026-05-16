"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getMe } from "@/lib/api";

export function AuthGuard({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "unauthorized">("loading");

  useEffect(() => {
    getMe()
      .then((res) => setState(res?.user ? "ok" : "unauthorized"))
      .catch(() => setState("unauthorized"));
  }, []);

  if (state === "loading") {
    return (
      <div className="surface-card rounded-2xl p-4 text-sm text-muted-foreground">
        Checking session...
      </div>
    );
  }
  if (state === "unauthorized") {
    return (
      <Alert tone="error" className="space-y-3 rounded-2xl border-rose-800/70 bg-rose-950/30 p-4">
        <p>You are not logged in. Please login to manage channels and playback.</p>
        <Link href="/login">
          <Button>Go to login</Button>
        </Link>
      </Alert>
    );
  }
  return <>{children}</>;
}
