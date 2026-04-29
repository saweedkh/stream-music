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
      .then((user) => setState(user ? "ok" : "unauthorized"))
      .catch(() => setState("unauthorized"));
  }, []);

  if (state === "loading") {
    return <p className="text-sm text-slate-400">Checking session...</p>;
  }
  if (state === "unauthorized") {
    return (
      <Alert tone="error" className="space-y-3">
        <p>You are not logged in. Please login to manage channels and playback.</p>
        <Link href="/login">
          <Button>Go to login</Button>
        </Link>
      </Alert>
    );
  }
  return <>{children}</>;
}
