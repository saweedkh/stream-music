"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { joinChannel } from "@/lib/api";

export function HomeActions() {
  const [channelId, setChannelId] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function handleJoin() {
    if (!channelId) return;
    setStatus("Joining channel...");
    try {
      await joinChannel(channelId, token || undefined);
      setStatus("Joined. Opening channel page...");
      window.location.href = `/channel/${channelId}`;
    } catch {
      setStatus("Join failed. Make sure you are logged in and token is valid for private channels.");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Start from dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-300">Manage your channels, monitor sync health, and open admin controls.</p>
          <Link href="/dashboard">
            <Button className="w-full">Open Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Quick join</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Channel id (example: 1)" value={channelId} onChange={(e) => setChannelId(e.target.value)} />
          <Input placeholder="Invite token (private channels only)" value={token} onChange={(e) => setToken(e.target.value)} />
          <Button className="w-full" onClick={handleJoin}>
            Join Channel
          </Button>
          {status ? <Alert>{status}</Alert> : null}
        </CardContent>
      </Card>
    </div>
  );
}
