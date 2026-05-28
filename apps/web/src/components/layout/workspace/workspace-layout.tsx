"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Root wrapper for tab content inside WorkspacePanel. */
export function WorkspacePage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-5 sm:gap-6", className)}>{children}</div>;
}

/** Main + optional sticky aside (desktop). */
export function WorkspaceSplit({
  main,
  aside,
  className,
  asideClassName,
}: {
  main: ReactNode;
  aside?: ReactNode;
  className?: string;
  asideClassName?: string;
}) {
  if (!aside) {
    return <div className={cn("min-w-0", className)}>{main}</div>;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-5 sm:gap-6",
        "xl:grid xl:grid-cols-[minmax(0,1fr)_min(100%,19rem)] xl:items-start xl:gap-8",
        className,
      )}
    >
      <div className="min-w-0 xl:order-1">{main}</div>
      <div className={cn("shrink-0 xl:order-2 xl:sticky xl:top-0", asideClassName)}>{aside}</div>
    </div>
  );
}

/** Subtle info strip (limits, hints) — not a nested Card. */
export function WorkspaceNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-[var(--workspace-divider)] bg-[var(--workspace-notice)] px-3.5 py-3 text-sm text-muted-foreground sm:px-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Search + trailing actions row. */
export function WorkspaceToolbar({
  children,
  actions,
  className,
}: {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

type StatTone = "default" | "brand" | "muted";

export function WorkspaceStat({
  label,
  value,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-[4.5rem] flex-col rounded-xl px-3 py-2",
        tone === "brand" && "bg-brand/10 text-brand",
        tone === "muted" && "bg-muted/30 text-muted-foreground",
        tone === "default" && "bg-[var(--workspace-stat)] text-foreground",
        className,
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-wider opacity-80">{label}</span>
      <span className="mt-0.5 text-lg font-semibold tabular-nums leading-none">{value}</span>
    </div>
  );
}

export function WorkspaceStatRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap gap-2", className)}>{children}</div>;
}

/** Horizontal filter chips. */
export function WorkspaceChipGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
      role="tablist"
    >
      {children}
    </div>
  );
}

export function WorkspaceChip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition-colors sm:text-sm",
        selected
          ? "bg-brand text-brand-foreground shadow-sm"
          : "bg-[var(--workspace-stat)] text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
