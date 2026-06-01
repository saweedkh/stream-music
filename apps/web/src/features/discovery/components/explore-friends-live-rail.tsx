"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radio } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { getLiveFriendsFeed, type LiveFeedRow } from "@/lib/api/discovery";

export function ExploreFriendsLiveRail() {
  const { t } = useTranslations();
  const [rows, setRows] = useState<LiveFeedRow[]>([]);

  useEffect(() => {
    void getLiveFriendsFeed()
      .then((d) => setRows(d.results.filter((r) => r.is_live).slice(0, 12)))
      .catch(() => setRows([]));
  }, []);

  if (!rows.length) return null;

  return (
    <section className="space-y-3" data-testid="explore-friends-live">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Radio className="h-5 w-5 text-brand" />
        {t("explore.friendsLive")}
      </h2>
      <ul className="flex gap-3 overflow-x-auto pb-1">
        {rows.map((r) => (
          <li key={r.channel_id} className="min-w-[200px] rounded-xl border border-border/80 bg-card/50 p-3">
            <Link href={`/channel/${r.channel_id}`} className="block space-y-1">
              <p className="truncate font-medium">{r.channel_name}</p>
              <p className="text-xs text-muted-foreground">@{r.owner_username}</p>
              {r.now_playing ? (
                <p className="truncate text-xs text-brand">
                  {r.now_playing.title}
                  {r.now_playing.artist ? ` — ${r.now_playing.artist}` : ""}
                </p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
