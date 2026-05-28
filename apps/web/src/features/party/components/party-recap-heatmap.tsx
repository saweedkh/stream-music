"use client";

import type { PartyRecapHeatmapBucket } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  buckets: PartyRecapHeatmapBucket[];
  title?: string;
};

export function PartyRecapHeatmap({ buckets, title }: Props) {
  if (!buckets.length) return null;
  return (
    <div className="space-y-3" data-testid="party-recap-heatmap">
      {title ? <h3 className="text-sm font-semibold text-foreground">{title}</h3> : null}
      <div className="flex h-24 items-end gap-1 rounded-xl border border-border/80 bg-card/40 p-3">
        {buckets.map((b) => (
          <div
            key={b.index}
            title={`${b.label} — ${b.score}`}
            className={cn(
              "min-w-[6px] flex-1 rounded-t-md transition-all",
              b.intensity >= 70 ? "bg-brand" : b.intensity >= 40 ? "bg-brand/60" : "bg-brand/25",
            )}
            style={{ height: `${Math.max(12, b.intensity)}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{buckets[0]?.label}</span>
        <span>{buckets[buckets.length - 1]?.label}</span>
      </div>
    </div>
  );
}
