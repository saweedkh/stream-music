"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { cn } from "@/lib/utils";

type PlaylistFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  className?: string;
};

export function PlaylistFormDialog({
  open,
  onOpenChange,
  icon: Icon,
  title,
  description,
  children,
  footer,
  className,
}: PlaylistFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-md", className)}>
        <DialogHeader>
          <div className="flex items-start gap-3 pe-6">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle>{title}</DialogTitle>
              {description ? <DialogDescription>{description}</DialogDescription> : null}
            </div>
          </div>
        </DialogHeader>
        {children}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
