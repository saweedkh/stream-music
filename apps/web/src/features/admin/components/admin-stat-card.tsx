"use client";

import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { cn } from "@/lib/utils";

export function AdminStatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "brand",
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: LucideIcon;
  accent?: "brand" | "amber" | "emerald" | "violet";
}) {
  const accentClass = {
    brand: "bg-brand/12 text-brand",
    amber: "bg-amber-500/12 text-amber-600",
    emerald: "bg-emerald-500/12 text-emerald-600",
    violet: "bg-violet-500/12 text-violet-600",
  }[accent];

  return (
    <Card className="border-border/60 bg-gradient-to-br from-card to-muted/20 shadow-sm">
      <CardContent className="flex items-start gap-3 p-4">
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", accentClass)}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          <p className="text-xs font-semibold text-foreground">{label}</p>
          {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
