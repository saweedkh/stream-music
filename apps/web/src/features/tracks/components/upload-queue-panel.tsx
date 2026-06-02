"use client";

import { AlertCircle, CheckCircle2, Copy, Loader2, Music2, RefreshCw, X } from "lucide-react";
import type { UploadQueueItem } from "@/features/tracks/model/upload-types";
import { formatFileSize } from "@/features/tracks/model/upload-types";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

function QueueStatusIcon({ status }: { status: string }) {
  if (status === "uploading") return <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden />;
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />;
  if (status === "duplicate") return <Copy className="h-4 w-4 text-amber-500" aria-hidden />;
  if (status === "failed") return <AlertCircle className="h-4 w-4 text-rose-500" aria-hidden />;
  return <Music2 className="h-4 w-4 text-muted-foreground" aria-hidden />;
}

function ItemProgressBar({ item }: { item: UploadQueueItem }) {
  const { t } = useTranslations();

  if (item.status !== "uploading") return null;

  const label = item.kind === "url" ? t("upload.studio.urlFetching") : t("upload.studio.fileUploading");
  const pct = Math.min(100, Math.max(0, Math.round(item.progress)));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums font-medium text-foreground">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

type UploadQueuePanelProps = {
  items: UploadQueueItem[];
  stats: {
    total: number;
    queued: number;
    uploading: number;
    done: number;
    failed: number;
  };
  isRunning: boolean;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onClearFinished: () => void;
  compact?: boolean;
  className?: string;
};

export function UploadQueuePanel({
  items,
  stats,
  isRunning,
  onRetry,
  onRemove,
  onClearFinished,
  compact,
  className,
}: UploadQueuePanelProps) {
  const { t } = useTranslations();

  if (items.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("upload.studio.queueTitle")}</p>
        {(stats.done > 0 || stats.failed > 0) && !isRunning ? (
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onClearFinished}>
            {t("upload.studio.clearFinished")}
          </Button>
        ) : null}
      </div>
      <ul className={cn("space-y-2 overflow-y-auto", compact ? "max-h-40" : "max-h-56")}>
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-border/50 bg-background/70 px-3 py-2.5">
            <div className="flex items-start gap-3">
              <QueueStatusIcon status={item.status} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {item.kind === "file" && item.file ? formatFileSize(item.file.size) : item.url}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    {item.status === "failed" ? (
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRetry(item.id)}>
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    ) : null}
                    {item.status !== "uploading" ? (
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRemove(item.id)}>
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                </div>
                <ItemProgressBar item={item} />
                {item.error ? <p className="text-[11px] text-rose-500">{item.error}</p> : null}
                {item.status === "duplicate" ? (
                  <p className="text-[11px] text-amber-600">{t("upload.studio.duplicate")}</p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function computeOverallUploadProgress(items: UploadQueueItem[]): number {
  if (!items.length) return 0;
  let sum = 0;
  for (const item of items) {
    if (item.status === "done" || item.status === "duplicate") sum += 100;
    else if (item.status === "uploading") sum += item.progress;
    else if (item.status === "failed") sum += 100;
  }
  return Math.min(100, Math.round(sum / items.length));
}

export function hasActiveUploads(items: UploadQueueItem[], isRunning: boolean): boolean {
  return isRunning || items.some((i) => i.status === "queued" || i.status === "uploading");
}
