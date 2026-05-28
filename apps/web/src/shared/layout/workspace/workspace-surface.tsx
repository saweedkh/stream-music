"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function WorkspaceList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("flex flex-col gap-0.5", className)}>{children}</ul>;
}

/** @deprecated Prefer plain <li> rows; kept for following tab until migrated. */
export function WorkspaceListItem({ children, className, accent = "none", as: Tag = "li" }: {
  children: ReactNode;
  className?: string;
  accent?: "brand" | "amber" | "none";
  as?: "li" | "div";
}) {
  return (
    <Tag
      className={cn(
        "rounded-lg px-2 py-2.5 transition-colors sm:px-3",
        accent === "brand" && "bg-brand/[0.06]",
        accent === "none" && "hover:bg-muted/30",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function WorkspaceSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)}>
      {(title || description || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h3 className="font-display text-base font-semibold tracking-tight sm:text-lg">{title}</h3> : null}
            {description ? <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{description}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function WorkspaceRail({ children, className }: { children: ReactNode; className?: string }) {
  return <aside className={cn("shrink-0", className)}>{children}</aside>;
}

export function WorkspaceRailCard({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("workspace-rail overflow-hidden", className)}>
      <div className="border-b border-[var(--workspace-divider)] px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          {Icon ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/90 text-brand-foreground">
              <Icon className="size-[1.125rem]" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold sm:text-base">{title}</h3>
            {description ? <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p> : null}
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

export function WorkspaceEmpty({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--workspace-divider)] bg-[var(--workspace-list)] px-4 py-12 text-center sm:py-16",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/35 text-muted-foreground">
          <Icon className="size-7 opacity-75" aria-hidden />
        </span>
      ) : null}
      {title ? <p className="font-display text-base font-semibold text-foreground">{title}</p> : null}
      {children ? <div className="mt-2 max-w-sm text-sm text-muted-foreground">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
