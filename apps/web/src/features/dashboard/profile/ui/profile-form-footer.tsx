"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ProfileFormFooterProps = {
  status?: ReactNode;
  actions: ReactNode;
  className?: string;
};

export function ProfileFormFooter({ status, actions, className }: ProfileFormFooterProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-3 border-t border-[var(--workspace-divider)] pt-4",
        className,
      )}
    >
      {status ? <div className="text-xs text-muted-foreground">{status}</div> : null}
      {actions}
    </div>
  );
}
