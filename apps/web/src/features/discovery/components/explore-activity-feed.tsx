"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { getActivityFeed } from "@/lib/api/discovery";

export function ExploreActivityFeed() {
  const { t } = useTranslations();
  const [rows, setRows] = useState<
    { id: number; kind: string; actor_username: string; channel_name: string | null; created_at: string }[]
  >([]);

  useEffect(() => {
    void getActivityFeed()
      .then((d) => setRows(d.results.slice(0, 20)))
      .catch(() => setRows([]));
  }, []);

  if (!rows.length) return null;

  return (
    <section className="space-y-2" data-testid="explore-activity-feed">
      <h2 className="text-lg font-semibold">{t("explore.activityFeed")}</h2>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg border border-border/70 px-3 py-2 text-sm">
            <span className="font-medium">@{r.actor_username}</span>{" "}
            <span className="text-muted-foreground">{r.kind}</span>
            {r.channel_name ? <span className="text-foreground"> — {r.channel_name}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
