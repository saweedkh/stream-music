"use client";

import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  badge?: ReactNode;
  className?: string;
  /** Chat uses its own chrome — skip the glass panel wrapper. */
  bare?: boolean;
  /** Full-bleed panels (e.g. playlist) — no glass card or outer scroll. */
  flush?: boolean;
};

export function ChannelAdminPanelShell({ children, badge, className, bare, flush }: Props) {
  if (bare || flush) {
    return <div className={cn("flex h-full min-h-0 max-h-full flex-1 flex-col overflow-hidden", className)}>{children}</div>;
  }

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 max-h-full flex-1 flex-col overflow-hidden rounded-2xl",
        "border border-border/60 bg-gradient-to-br from-background/95 via-[var(--brand-subtle)] to-background/95 backdrop-blur-2xl",
        "shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_20px_60px_-24px_rgba(0,0,0,0.75)]",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:bg-[radial-gradient(700px_circle_at_20%_-10%,rgba(52,211,153,0.1),transparent_50%)]",
        className,
      )}
    >
      {badge ? <div className="absolute end-3 top-3 z-[2]">{badge}</div> : null}
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
        <ScrollArea className="h-full min-h-0 flex-1 rounded-xl border border-border/40 bg-[var(--surface-inset)]">
          <div className="p-3 sm:p-4">{children}</div>
        </ScrollArea>
      </div>
    </div>
  );
}
