"use client";

import type { ElementType, ReactNode } from "react";
import { UsernameWithBadges } from "@/shared/ui/user-verified-badge";
import type { UserBadgeFlags } from "@/lib/user-badges";
import { cn } from "@/lib/utils";

export type ChatMessageRowProps = {
  as?: ElementType;
  mine: boolean;
  username?: string;
  authorFlags?: UserBadgeFlags;
  /** Override default author line (e.g. staff badge). */
  authorLine?: ReactNode;
  timeLabel: string;
  variant?: "workspace" | "room";
  className?: string;
  children: ReactNode;
  trailing?: ReactNode;
};

/** Channel-style message row: bubble + optional trailing actions. */
export function ChatMessageRow({
  as: Tag = "div",
  mine,
  username,
  authorFlags,
  authorLine,
  timeLabel,
  variant = "workspace",
  className,
  children,
  trailing,
}: ChatMessageRowProps) {
  return (
    <Tag className={cn("group relative scroll-mt-24 rounded-lg transition-colors", className)}>
      <div className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "relative max-w-[min(92%,28rem)] rounded-2xl border px-3.5 py-2.5 text-sm shadow-md transition-[box-shadow,transform]",
            mine
              ? "border-brand/35 bg-[var(--brand-subtle)] text-brand-foreground"
              : variant === "room"
                ? "border-white/[0.07] bg-card/70 text-foreground"
                : "border-border/60 bg-card/85 text-foreground",
            variant === "room" && mine && "shadow-brand/20",
          )}
        >
          {!mine && (authorLine || username) ? (
            <div className="mb-1">
              {authorLine ?? (
                <UsernameWithBadges
                  username={username ?? "?"}
                  flags={authorFlags}
                  prefix=""
                  size="xs"
                  usernameClassName="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
                />
              )}
            </div>
          ) : null}
          {children}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] tabular-nums text-muted-foreground">
            <span>{timeLabel}</span>
          </div>
        </div>
        {trailing}
      </div>
    </Tag>
  );
}
