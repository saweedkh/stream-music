"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
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
      <Card className="border-brand/30">
        <CardHeader>
          <CardTitle>Start from dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-foreground/80">Manage your channels, monitor sync health, and open admin controls.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/dashboard" className="flex-1">
              <Button className="w-full">Open Dashboard</Button>
            </Link>
            <Link href="/explore" className="flex-1">
              <Button variant="secondary" className="w-full">
                Explore public rooms
              </Button>
            </Link>
          </div>
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
