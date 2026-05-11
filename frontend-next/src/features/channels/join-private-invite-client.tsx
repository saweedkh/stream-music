"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { joinChannelFromLink } from "@/lib/api";

export function JoinPrivateInviteClient({ token }: { token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("Connecting…");

  useEffect(() => {
    const raw = token.trim();
    if (!raw || !/^[0-9a-f-]{36}$/i.test(raw)) {
      setMessage("Invalid invite code.");
      return;
    }
    let cancelled = false;
    joinChannelFromLink(raw.toLowerCase())
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
  }, [router, token]);

  return (
    <div className="space-y-3 text-sm text-zinc-300">
      <p className="text-base font-medium text-white">Private channel invite</p>
      <p>{message}</p>
    </div>
  );
}
