"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { joinChannelFromLink } from "@/lib/api";
import { extractJoinInputFromScannedText } from "@/lib/join-qr-utils";

export function HomeActions() {
  const [joinInput, setJoinInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function handleJoin() {
    if (!joinInput.trim()) return;
    setStatus("Joining channel...");
    try {
      const out = await joinChannelFromLink(extractJoinInputFromScannedText(joinInput.trim()));
      if (out.status === "pending") {
        setStatus("Join request sent — wait for a moderator to approve.");
        return;
      }
      setStatus("Joined. Opening channel page...");
      window.location.href = `/channel/${out.channel}`;
    } catch {
      setStatus("Join failed. Check your invite or link, and that you are logged in.");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-emerald-900/30">
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
          <Input
            placeholder="Invite code, public code, or join link"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
          />
          <Button className="w-full" onClick={handleJoin}>
            Join Channel
          </Button>
          {status ? <Alert>{status}</Alert> : null}
        </CardContent>
      </Card>
    </div>
  );
}
