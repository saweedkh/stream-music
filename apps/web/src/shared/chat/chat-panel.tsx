"use client";

import type { ReactNode } from "react";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { cn } from "@/lib/utils";

export type ChatPanelProps = {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  /** Fill parent height with scrollable thread (channel fullHeight mode). */
  fullHeight?: boolean;
  className?: string;
  scrollEndRef?: React.RefObject<HTMLDivElement>;
};

/** Channel-style chat panel shell: header + ScrollArea thread + footer composer. */
export function ChatPanel({
  header,
  footer,
  children,
  fullHeight = true,
  className,
  scrollEndRef,
}: ChatPanelProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/80 bg-card/50 shadow-lg shadow-black/25",
        fullHeight &&
          "flex h-full min-h-0 flex-1 flex-col max-lg:overflow-visible max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent max-lg:shadow-none",
        className,
      )}
    >
      {header}

      <div
        className={cn(
          "flex min-h-0 flex-col gap-2 p-3 sm:p-4",
          fullHeight && "flex-1 max-lg:overflow-visible lg:min-h-0 lg:overflow-hidden",
        )}
      >
        <ScrollArea
          className={cn(
            "rounded-2xl border border-border/60 bg-card/60",
            fullHeight ? "min-h-0 flex-1 max-lg:scroll-pad-player-dock lg:min-h-0" : "h-[min(280px,40vh)]",
          )}
        >
          <div className="space-y-3 p-3 pr-2 sm:p-4">
            {children}
            {scrollEndRef ? <div ref={scrollEndRef} aria-hidden /> : null}
          </div>
        </ScrollArea>

        {footer}
      </div>
    </div>
  );
}
