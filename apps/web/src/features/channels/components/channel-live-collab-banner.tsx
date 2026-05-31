"use client";

import { Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/lib/utils";

type CollabPayload = {
  collab_active_count?: number;
  collab_usernames?: string[];
  recent_pending?: Array<{ id: number; title: string; artist?: string; username: string }>;
  pending_count?: number;
};

type Props = {
  channelId: string;
  className?: string;
};

export function ChannelLiveCollabBanner({ channelId, className }: Props) {
  const { t } = useTranslations();
  const [snap, setSnap] = useState<CollabPayload>({});

  useEffect(() => {
    const fn = (ev: Event) => {
      const e = ev as CustomEvent<{ channelId?: string; payload?: CollabPayload }>;
      if (String(e.detail?.channelId ?? "") !== String(channelId)) return;
      const p = e.detail?.payload;
      if (!p) return;
      setSnap({
        collab_active_count: p.collab_active_count,
        collab_usernames: p.collab_usernames,
        recent_pending: p.recent_pending,
        pending_count: p.pending_count,
      });
    };
    window.addEventListener("channel-suggestions", fn);
    return () => window.removeEventListener("channel-suggestions", fn);
  }, [channelId]);

  const active = snap.collab_active_count ?? 0;
  const pending = snap.pending_count ?? 0;
  if (pending < 1 && active < 1) return null;

  return (
    <div
      className={cn("rounded-xl border border-brand/25 bg-brand/5 px-3 py-2.5", className)}
      data-testid="channel-live-collab-banner"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Users className="h-4 w-4 text-brand" aria-hidden />
        <p className="text-sm font-medium text-foreground">
          {t("room.collab.liveTitle", { count: active || pending })}
        </p>
        {active > 0 ? (
          <div className="flex flex-wrap gap-1">
            {(snap.collab_usernames ?? []).slice(0, 6).map((u) => (
              <Badge key={u} variant="outline" className="text-[10px]">
                @{u}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      {(snap.recent_pending?.length ?? 0) > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {snap.recent_pending!.slice(0, 4).map((r) => (
            <li key={r.id} className="truncate">
              @{r.username}: {r.title}
              {r.artist ? ` · ${r.artist}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
