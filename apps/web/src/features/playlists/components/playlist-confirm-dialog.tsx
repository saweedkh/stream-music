"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { useTranslations } from "@/shared/providers/locale-provider";
import { cn } from "@/lib/utils";

type PlaylistConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  busy?: boolean;
  destructive?: boolean;
};

export function PlaylistConfirmDialog({
  open,
  onOpenChange,
  icon: Icon,
  title,
  description,
  confirmLabel,
  onConfirm,
  busy = false,
  destructive = false,
}: PlaylistConfirmDialogProps) {
  const { t } = useTranslations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3 pe-6">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                destructive ? "bg-rose-500/10 text-rose-500" : "bg-brand/10 text-brand",
              )}
            >
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
