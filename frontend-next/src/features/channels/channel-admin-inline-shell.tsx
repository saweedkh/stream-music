"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Props = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function ChannelAdminInlineShell({
  icon: Icon,
  title,
  subtitle,
  actions,
  toolbar,
  children,
  footer,
  className,
}: Props) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-brand/25 bg-[var(--brand-subtle)] text-brand">
            <Icon className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {toolbar ? <div className="shrink-0 border-b border-border/40 px-4 py-3">{toolbar}</div> : null}
      <ScrollArea className="min-h-0 flex-1 px-2 py-3 sm:px-3">{children}</ScrollArea>
      {footer ? (
        <div className="shrink-0 border-t border-border/40 px-4 py-2.5 text-xs text-muted-foreground">{footer}</div>
      ) : null}
    </div>
  );
}
