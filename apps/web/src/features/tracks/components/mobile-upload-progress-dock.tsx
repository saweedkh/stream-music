"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronUp, Loader2 } from "lucide-react";
import {
  computeOverallUploadProgress,
  hasActiveUploads,
} from "@/features/tracks/components/upload-queue-panel";
import type { UploadQueueItem } from "@/features/tracks/model/upload-types";
import { useTranslations } from "@/shared/providers/locale-provider";
import { cn } from "@/lib/utils";

type MobileUploadProgressDockProps = {
  items: UploadQueueItem[];
  stats: {
    total: number;
    uploading: number;
    done: number;
    failed: number;
  };
  isRunning: boolean;
  sheetOpen: boolean;
  onExpand: () => void;
};

export function MobileUploadProgressDock({
  items,
  stats,
  isRunning,
  sheetOpen,
  onExpand,
}: MobileUploadProgressDockProps) {
  const { t } = useTranslations();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = hasActiveUploads(items, isRunning);
  const show = mounted && active && !sheetOpen;
  const current = items.find((i) => i.status === "uploading");
  const overall = computeOverallUploadProgress(items);
  const indeterminate = Boolean(current?.kind === "url" && current.status === "uploading");

  if (!show) return null;

  return createPortal(
    <button
      type="button"
      onClick={onExpand}
      className={cn(
        "fixed start-3 end-3 z-40 lg:hidden",
        "bottom-[calc(var(--player-mini-inset,0px)+4.75rem+env(safe-area-inset-bottom))]",
        "rounded-2xl border border-border/60 bg-card/95 p-3 text-start shadow-lg backdrop-blur-md",
        "transition-transform active:scale-[0.99]",
      )}
      aria-label={t("upload.studio.mobileDockTap")}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand">
          <Loader2 className="size-4 animate-spin" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{current?.title ?? t("upload.studio.mobileDockTitle")}</p>
            {!indeterminate ? (
              <span className="shrink-0 text-xs tabular-nums font-medium text-muted-foreground">{overall}%</span>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t("upload.studio.overallProgress", {
              done: String(stats.done),
              total: String(stats.total),
            })}
          </p>
          <div className="relative h-1.5 overflow-hidden rounded-full bg-muted">
            {indeterminate ? (
              <div className="absolute inset-y-0 start-0 h-full w-2/5 animate-upload-slide rounded-full bg-brand" />
            ) : (
              <div
                className="h-full rounded-full bg-brand transition-[width] duration-200 ease-out"
                style={{ width: `${overall}%` }}
              />
            )}
          </div>
        </div>
        <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>
    </button>,
    document.body,
  );
}
