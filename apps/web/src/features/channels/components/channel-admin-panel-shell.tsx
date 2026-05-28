"use client";

import type { ReactNode } from "react";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { panelLgCage, panelMobileFlat } from "@/lib/mobile-page-layout";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  badge?: ReactNode;
  className?: string;
  bare?: boolean;
  flush?: boolean;
};

export function ChannelAdminPanelShell({ children, badge, className, bare, flush }: Props) {
  if (bare || flush) {
    return (
      <div className={cn("flex flex-1 flex-col max-lg:overflow-visible lg:min-h-0 lg:max-h-full lg:overflow-hidden", className)}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex flex-1 flex-col",
        panelMobileFlat,
        panelLgCage,
        "lg:min-h-0 lg:max-h-full lg:overflow-hidden",
        "lg:shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_20px_60px_-24px_rgba(0,0,0,0.75)]",
        "lg:before:pointer-events-none lg:before:absolute lg:before:inset-0 lg:before:rounded-2xl lg:before:bg-[radial-gradient(700px_circle_at_20%_-10%,rgba(52,211,153,0.1),transparent_50%)]",
        className,
      )}
    >
      {badge ? <div className="absolute end-3 top-3 z-[2]">{badge}</div> : null}
      <div className="relative z-[1] flex flex-1 flex-col max-lg:overflow-visible lg:min-h-0 lg:overflow-hidden lg:p-2 lg:sm:p-3">
        <div className="flex flex-1 flex-col px-1 py-2 sm:px-2 sm:py-3 max-lg:overflow-visible lg:hidden">{children}</div>
        <div className="hidden min-h-0 flex-1 flex-col overflow-hidden lg:flex">
          <ScrollArea className="h-full min-h-0 flex-1 rounded-xl border border-border/40 bg-[var(--surface-inset)]">
            <div className="p-3 sm:p-4">{children}</div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
