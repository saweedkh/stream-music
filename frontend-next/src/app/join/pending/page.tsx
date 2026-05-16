"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { joinChannel } from "@/lib/api";

function JoinPendingInner() {
  const searchParams = useSearchParams();
  const channelId = searchParams.get("channel") ?? "";
  const [status, setStatus] = useState<"pending" | "joined" | "error">("pending");
  const [message, setMessage] = useState("Waiting for a moderator to approve your request…");

  useEffect(() => {
    if (!channelId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const out = await joinChannel(channelId);
        if (cancelled) return;
        if (out.status === "joined") {
          setStatus("joined");
          setMessage("Approved! Opening the room…");
          window.location.href = `/channel/${out.channel}`;
          return;
        }
        if (out.status === "pending") {
          setStatus("pending");
          setMessage("Still waiting for approval. This page checks every 8 seconds.");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Could not check join status. You may have been rejected or the link expired.");
        }
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [channelId]);

  return (
    <Card className="mx-auto max-w-md border-border/90">
      <CardHeader>
        <CardTitle>Join request pending</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>{message}</Alert>
        {status === "joined" ? (
          <Button asChild className="w-full">
            <Link href={`/channel/${channelId}`}>Open channel</Link>
          </Button>
        ) : (
          <Button asChild variant="secondary" className="w-full">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function JoinPendingPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <JoinPendingInner />
    </Suspense>
  );
}
