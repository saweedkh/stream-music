"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { joinChannelFromLink } from "@/lib/api";
import { extractJoinInputFromScannedText } from "@/lib/join-qr-utils";

export function JoinLandingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Connecting…");

  useEffect(() => {
    const link = searchParams.get("link")?.trim();
    const legacyChannel = searchParams.get("channel")?.trim();
    if (legacyChannel && !link) {
      setMessage("Joining with a room id is no longer supported. Ask the host for an invite link or scan their invite QR.");
      return;
    }
    const payloadRaw = link ?? "";
    const payload = payloadRaw ? extractJoinInputFromScannedText(payloadRaw) : "";
    if (!payload) {
      setMessage("Missing join link. Open the invite link or QR from your channel admin.");
      return;
    }
    let cancelled = false;
    joinChannelFromLink(payload)
      .then((out) => {
        if (cancelled) return;
        if (out.status === "pending") {
          setMessage("Your join request was sent. A moderator must approve before you can use this channel.");
          return;
        }
        router.replace(`/channel/${out.channel}`);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setMessage(e instanceof Error ? e.message : "Could not join.");
      });
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="space-y-3 text-sm text-zinc-300">
      <p className="text-base font-medium text-white">Channel invite</p>
      <p>{message}</p>
    </div>
  );
}
