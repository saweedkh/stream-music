"use client";

import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/ui/sheet";
import { cn } from "@/lib/utils";

type AdminDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function AdminDetailSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: AdminDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn("w-full overflow-y-auto sm:max-w-lg", className)}>
        <SheetHeader className="text-start">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className="mt-6 space-y-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

type AdminDetailFieldProps = {
  label: string;
  children: ReactNode;
};

export function AdminDetailField({ label, children }: AdminDetailFieldProps) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function AdminDetailStatGrid({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
          <p className="text-lg font-bold tabular-nums">{item.value}</p>
          <p className="text-[11px] text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
