"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  CloudUpload,
  Copy,
  Globe,
  Link2,
  Loader2,
  Lock,
  Music2,
  Plus,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { useTrackUploadQueue } from "@/features/tracks/hooks/use-track-upload-queue";
import { formatFileSize } from "@/features/tracks/model/upload-types";
import {
  toBackendVisibility,
  TRACK_ACCESS_HINT_KEYS,
  TRACK_ACCESS_LABEL_KEYS,
  type TrackAccess,
} from "@/features/tracks/model/track-access";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { WorkspaceRailCard } from "@/shared/layout/workspace";
import { parseAudioFileMetadata } from "@/lib/audio-metadata";
import { deriveTitleFromFileName } from "@/features/tracks/model/upload-types";
import { cn } from "@/lib/utils";

type UploadMode = "files" | "url";

type PreviewItem = {
  id: string;
  kind: "file" | "url";
  file?: File;
  url?: string;
  title: string;
  artist?: string;
  album?: string;
};

type TrackUploadStudioProps = {
  onUploadComplete?: () => void;
};

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function QueueStatusIcon({ status }: { status: string }) {
  if (status === "uploading") return <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden />;
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />;
  if (status === "duplicate") return <Copy className="h-4 w-4 text-amber-500" aria-hidden />;
  if (status === "failed") return <AlertCircle className="h-4 w-4 text-rose-500" aria-hidden />;
  return <Music2 className="h-4 w-4 text-muted-foreground" aria-hidden />;
}

type UploadStudioFormProps = {
  mode: UploadMode;
  onModeChange: (mode: UploadMode) => void;
  access: TrackAccess;
  onAccessChange: (access: TrackAccess) => void;
  previewItems: PreviewItem[];
  onAddFiles: (files: FileList | File[] | null) => void;
  onRemovePreview: (id: string) => void;
  onConfirmPreview: () => void;
  onClearPreview: () => void;
  urlInput: string;
  onUrlInputChange: (v: string) => void;
  urlTitle: string;
  onUrlTitleChange: (v: string) => void;
  onAddUrlToPreview: () => void;
  queueItems: ReturnType<typeof useTrackUploadQueue>["items"];
  queueStats: ReturnType<typeof useTrackUploadQueue>["stats"];
  isRunning: boolean;
  onRetry: (id: string) => void;
  onRemoveQueue: (id: string) => void;
  onClearFinished: () => void;
  compact?: boolean;
};

function AccessPicker({ access, onAccessChange }: { access: TrackAccess; onAccessChange: (a: TrackAccess) => void }) {
  const { t } = useTranslations();
  const options: TrackAccess[] = ["public", "private"];
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">{t("tracks.accessLabel")}</Label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const active = access === opt;
          const Icon = opt === "public" ? Globe : Lock;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onAccessChange(opt)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border px-3 py-3 text-start transition-all",
                active
                  ? "border-brand/50 bg-brand/10 shadow-sm ring-1 ring-brand/20"
                  : "border-border/60 bg-background/50 hover:border-border hover:bg-muted/30",
              )}
            >
              <span className={cn("flex items-center gap-1.5 text-sm font-semibold", active ? "text-brand" : "text-foreground")}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {t(TRACK_ACCESS_LABEL_KEYS[opt])}
              </span>
              <span className="text-[11px] leading-snug text-muted-foreground">{t(TRACK_ACCESS_HINT_KEYS[opt])}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UploadStudioForm({
  mode,
  onModeChange,
  access,
  onAccessChange,
  previewItems,
  onAddFiles,
  onRemovePreview,
  onConfirmPreview,
  onClearPreview,
  urlInput,
  onUrlInputChange,
  urlTitle,
  onUrlTitleChange,
  onAddUrlToPreview,
  queueItems,
  queueStats,
  isRunning,
  onRetry,
  onRemoveQueue,
  onClearFinished,
  compact,
}: UploadStudioFormProps) {
  const { t } = useTranslations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className={cn("space-y-4", compact ? "px-4 py-4" : "px-5 py-5 sm:px-6")}>
      <div className="flex rounded-xl border border-border/60 bg-muted/20 p-1">
        <button
          type="button"
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
            mode === "files" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
          )}
          onClick={() => onModeChange("files")}
        >
          {t("upload.studio.tabFiles")}
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
            mode === "url" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
          )}
          onClick={() => onModeChange("url")}
        >
          {t("upload.studio.tabUrl")}
        </button>
      </div>

      <AccessPicker access={access} onAccessChange={onAccessChange} />

      {mode === "files" ? (
        <div
          role="button"
          tabIndex={0}
          className={cn(
            "flex min-h-[9.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-all",
            dragOver ? "border-brand bg-brand/10" : "border-border/70 bg-background/40 hover:border-brand/35 hover:bg-brand/[0.03]",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onAddFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
          }}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/12 text-brand">
            <Upload className="h-6 w-6" aria-hidden />
          </span>
          <p className="text-sm font-medium">{t("upload.studio.dropTitle")}</p>
          <p className="max-w-xs text-xs text-muted-foreground">{t("upload.studio.dropHint")}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.ogg,.wav,.m4a,.flac,.aac,.webm,.opus"
            multiple
            className="sr-only"
            onChange={(e) => {
              onAddFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-background/50 p-4">
          <p className="text-xs text-muted-foreground">{t("upload.studio.urlHint")}</p>
          <div className="space-y-1.5">
            <Label htmlFor="upload-url">{t("upload.studio.urlLabel")}</Label>
            <Input
              id="upload-url"
              type="url"
              inputMode="url"
              placeholder="https://..."
              value={urlInput}
              onChange={(e) => onUrlInputChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="upload-url-title">{t("tracks.title")}</Label>
            <Input
              id="upload-url-title"
              placeholder={t("upload.studio.urlTitleOptional")}
              value={urlTitle}
              onChange={(e) => onUrlTitleChange(e.target.value)}
            />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{t("upload.studio.urlSecurity")}</p>
          <Button type="button" variant="secondary" className="w-full gap-2" onClick={onAddUrlToPreview}>
            <Link2 className="h-4 w-4" aria-hidden />
            {t("upload.studio.addToPreview")}
          </Button>
        </div>
      )}

      {previewItems.length > 0 ? (
        <div className="space-y-3 rounded-2xl border border-brand/25 bg-brand/[0.04] p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{t("upload.studio.previewTitle")}</p>
            <Badge variant="secondary">{previewItems.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{t("upload.studio.previewHint")}</p>
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {previewItems.map((item) => (
              <li key={item.id} className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/80 px-3 py-2">
                <Music2 className="h-4 w-4 shrink-0 text-brand/80" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {item.kind === "file" && item.file
                      ? `${item.file.name} · ${formatFileSize(item.file.size)}`
                      : item.url}
                  </p>
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => onRemovePreview(item.id)}>
                  <X className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" className="flex-1 gap-2 sm:flex-none" onClick={onConfirmPreview}>
              <Check className="h-4 w-4" aria-hidden />
              {t("upload.studio.confirmUpload", { count: String(previewItems.length) })}
            </Button>
            <Button type="button" variant="outline" onClick={onClearPreview}>
              {t("upload.studio.cancelPreview")}
            </Button>
          </div>
        </div>
      ) : null}

      {queueStats.total > 0 ? (
        <div className="flex flex-wrap gap-2">
          {queueStats.uploading > 0 ? (
            <Badge variant="default" className="gap-1 bg-brand/90">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              {t("upload.studio.statUploading", { count: String(queueStats.uploading) })}
            </Badge>
          ) : null}
          {queueStats.done > 0 ? (
            <Badge variant="success" className="gap-1">
              {t("upload.studio.statDone", { count: String(queueStats.done) })}
            </Badge>
          ) : null}
          {queueStats.failed > 0 ? (
            <Badge variant="warning" className="gap-1">
              {t("upload.studio.statFailed", { count: String(queueStats.failed) })}
            </Badge>
          ) : null}
        </div>
      ) : null}

      {queueItems.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("upload.studio.queueTitle")}</p>
            {(queueStats.done > 0 || queueStats.failed > 0) && !isRunning ? (
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onClearFinished}>
                {t("upload.studio.clearFinished")}
              </Button>
            ) : null}
          </div>
          <ul className="max-h-56 space-y-2 overflow-y-auto">
            {queueItems.map((item) => (
              <li key={item.id} className="rounded-xl border border-border/50 bg-background/70 px-3 py-2.5">
                <div className="flex items-start gap-3">
                  <QueueStatusIcon status={item.status} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {item.kind === "file" && item.file
                            ? formatFileSize(item.file.size)
                            : item.url}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-0.5">
                        {item.status === "failed" ? (
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRetry(item.id)}>
                            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        ) : null}
                        {item.status !== "uploading" ? (
                          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRemoveQueue(item.id)}>
                            <X className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {item.status === "uploading" && item.kind === "file" ? (
                      <div className="h-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${item.progress}%` }} />
                      </div>
                    ) : null}
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
      ) : null}
    </div>
  );
}

export function TrackUploadStudio({ onUploadComplete }: TrackUploadStudioProps) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<UploadMode>("files");
  const [access, setAccess] = useState<TrackAccess>("public");
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [urlTitle, setUrlTitle] = useState("");

  const queue = useTrackUploadQueue({
    onItemComplete: (_item, track) => {
      if (track.duplicate) showToast(t("upload.studio.duplicate"), "info");
    },
    onBatchSettled: () => onUploadComplete?.(),
  });

  const visibility = toBackendVisibility(access);

  const addFilesToPreview = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files?.length) return;
      const audioFiles = Array.from(files).filter(
        (f) => f.type.startsWith("audio/") || /\.(mp3|ogg|wav|m4a|flac|aac|webm|opus)$/i.test(f.name),
      );
      if (!audioFiles.length) {
        showToast(t("upload.studio.invalidFiles"), "error");
        return;
      }
      const entries: PreviewItem[] = [];
      for (const file of audioFiles) {
        const meta = await parseAudioFileMetadata(file).catch(() => ({}));
        entries.push({
          id: newId(),
          kind: "file",
          file,
          title: meta.title ?? deriveTitleFromFileName(file.name),
          artist: meta.artist,
          album: meta.album,
        });
      }
      setPreviewItems((prev) => [...prev, ...entries]);
    },
    [showToast, t],
  );

  const addUrlToPreview = () => {
    const url = urlInput.trim();
    if (!url) {
      showToast(t("upload.studio.urlRequired"), "error");
      return;
    }
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad");
    } catch {
      showToast(t("upload.studio.urlInvalid"), "error");
      return;
    }
    let title = urlTitle.trim();
    if (!title) {
      try {
        title = deriveTitleFromFileName(new URL(url).pathname.split("/").pop() || t("upload.studio.defaultUrlTitle"));
      } catch {
        title = t("upload.studio.defaultUrlTitle");
      }
    }
    setPreviewItems((prev) => [...prev, { id: newId(), kind: "url", url, title }]);
    setUrlInput("");
    setUrlTitle("");
  };

  const confirmPreview = async () => {
    if (!previewItems.length) return;
    const files = previewItems.filter((p) => p.kind === "file" && p.file).map((p) => p.file!);
    const urls = previewItems.filter((p) => p.kind === "url" && p.url);
    if (files.length) await queue.enqueueFiles(files, visibility);
    for (const u of urls) {
      if (u.url) queue.enqueueUrl(u.url, visibility, u.title);
    }
    setPreviewItems([]);
    setSheetOpen(false);
    showToast(t("upload.studio.started", { count: String(previewItems.length) }), "success");
  };

  const formProps: UploadStudioFormProps = {
    mode,
    onModeChange: setMode,
    access,
    onAccessChange: setAccess,
    previewItems,
    onAddFiles: (f) => void addFilesToPreview(f),
    onRemovePreview: (id) => setPreviewItems((prev) => prev.filter((p) => p.id !== id)),
    onConfirmPreview: () => void confirmPreview(),
    onClearPreview: () => setPreviewItems([]),
    urlInput,
    onUrlInputChange: setUrlInput,
    urlTitle,
    onUrlTitleChange: setUrlTitle,
    onAddUrlToPreview: addUrlToPreview,
    queueItems: queue.items,
    queueStats: queue.stats,
    isRunning: queue.isRunning,
    onRetry: queue.retryItem,
    onRemoveQueue: queue.removeItem,
    onClearFinished: queue.clearFinished,
  };

  return (
    <>
      <section className="relative hidden overflow-hidden rounded-2xl border border-border/60 bg-card shadow-md lg:block">
        <div className="border-b border-border/50 bg-gradient-to-r from-brand/[0.08] via-transparent to-violet-500/[0.06] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-md shadow-brand/20">
              <CloudUpload className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">{t("upload.studio.title")}</h2>
              <p className="text-sm text-muted-foreground">{t("upload.studio.subtitle")}</p>
            </div>
          </div>
        </div>
        <UploadStudioForm {...formProps} />
      </section>

      <div className="fixed bottom-[calc(var(--player-mini-inset,0px)+1rem+env(safe-area-inset-bottom))] end-4 z-30 lg:hidden">
        <Button
          type="button"
          size="icon"
          className="size-12 rounded-full bg-brand text-brand-foreground shadow-lg shadow-brand/25"
          onClick={() => setSheetOpen(true)}
          aria-label={t("upload.studio.title")}
        >
          <Plus className="size-5" aria-hidden />
        </Button>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto p-0">
          <SheetTitle className="sr-only">{t("upload.studio.title")}</SheetTitle>
          <WorkspaceRailCard icon={CloudUpload} title={t("upload.studio.title")} description={t("upload.studio.subtitle")} className="border-0 shadow-none">
            <UploadStudioForm {...formProps} compact />
          </WorkspaceRailCard>
        </SheetContent>
      </Sheet>
    </>
  );
}
