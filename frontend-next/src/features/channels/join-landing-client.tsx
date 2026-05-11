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
    const channel = searchParams.get("channel");
    const link = searchParams.get("link");
    const payloadRaw = channel?.trim() || link?.trim();
    const payload = payloadRaw ? extractJoinInputFromScannedText(payloadRaw) : "";
    if (!payload) {
      setMessage("Missing channel id or invite. Open a valid QR or link from your admin.");
      return;
    }
    let cancelled = false;
    joinChannelFromLink(extractJoinInputFromScannedText(payload))
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
