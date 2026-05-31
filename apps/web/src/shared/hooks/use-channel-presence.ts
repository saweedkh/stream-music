"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type PresenceMember = { id: number; username: string; avatar_url?: string | null };

type SocialPayload = {
  action?: string;
  count?: number;
  members?: PresenceMember[];
};

export function useChannelPresence(channelId: string) {
  const [onlineMembers, setOnlineMembers] = useState<PresenceMember[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);

  const onSocial = useCallback(
    (ev: Event) => {
      const e = ev as CustomEvent<{ channelId?: string; payload?: SocialPayload }>;
      if (String(e.detail?.channelId ?? "") !== String(channelId)) return;
      const p = e.detail?.payload;
      if (!p || (p.action ?? "").toLowerCase() !== "presence_update") return;
      setOnlineMembers(Array.isArray(p.members) ? p.members : []);
      setOnlineCount(typeof p.count === "number" ? p.count : 0);
    },
    [channelId],
  );

  useEffect(() => {
    window.addEventListener("channel-social", onSocial as EventListener);
    return () => window.removeEventListener("channel-social", onSocial as EventListener);
  }, [onSocial]);

  const onlineIds = useMemo(() => new Set(onlineMembers.map((m) => m.id)), [onlineMembers]);

  return { onlineMembers, onlineCount, onlineIds };
}
