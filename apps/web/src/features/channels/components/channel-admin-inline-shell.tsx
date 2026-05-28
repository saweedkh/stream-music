"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ScrollArea } from "@/shared/ui/scroll-area";
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
    <div className={cn("flex flex-1 flex-col max-lg:overflow-visible lg:min-h-0", className)}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-3 py-2.5 sm:px-4 lg:px-5 lg:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-brand/25 bg-[var(--brand-subtle)] text-brand lg:size-10 lg:rounded-2xl">
            <Icon className="size-4 lg:size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {toolbar ? <div className="shrink-0 border-b border-border/40 px-3 py-2.5 sm:px-4">{toolbar}</div> : null}
      <div className="flex flex-1 flex-col px-2 py-2 sm:px-3 sm:py-3 max-lg:overflow-visible lg:hidden">{children}</div>
      <ScrollArea className="hidden min-h-0 flex-1 px-2 py-3 sm:px-3 lg:block">{children}</ScrollArea>
      {footer ? (
        <div className="shrink-0 border-t border-border/40 px-3 py-2.5 text-xs text-muted-foreground sm:px-4">{footer}</div>
      ) : null}
    </div>
  );
}
