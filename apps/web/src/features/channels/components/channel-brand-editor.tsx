"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { BRAND_LOGO_ACCEPT, validateBrandLogoFile } from "@/features/channels/model/brand-media";
import { resolveMediaCandidates } from "@/lib/media-url";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

function channelInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

type ChannelBrandEditorProps = {
  channelName: string;
  brandLogoUrl?: string | null;
  disabled?: boolean;
  onUpload: (file: File) => Promise<string | null | undefined>;
  onRemove: () => Promise<void>;
};

export function ChannelBrandEditor({
  channelName,
  brandLogoUrl,
  disabled,
  onUpload,
  onRemove,
}: ChannelBrandEditorProps) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [srcAttempt, setSrcAttempt] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(brandLogoUrl ?? null);

  useEffect(() => {
    setPreviewUrl(brandLogoUrl ?? null);
  }, [brandLogoUrl]);

  const srcCandidates = useMemo(() => resolveMediaCandidates(previewUrl), [previewUrl]);
  const src = srcCandidates[srcAttempt] ?? null;

  useEffect(() => {
    setSrcAttempt(0);
  }, [previewUrl]);

  const initial = channelInitials(channelName);

  function toastForValidation(
    check: ReturnType<typeof validateBrandLogoFile>,
  ) {
    if (check === "invalid") showToast(t("room.admin.brand.invalid"), "error");
    else if (check === "too_large") showToast(t("room.admin.brand.tooLarge"), "error");
    else if (check === "video_too_large") showToast(t("room.admin.brand.videoTooLarge"), "error");
  }

  function toastForApiError(message: string) {
    showToast(message || t("room.admin.toast.logoUploadFailed"), "error");
  }

  async function handleFileChange(file: File | undefined) {
    if (!file || disabled || busy) return;
    const check = validateBrandLogoFile(file);
    if (check !== "ok") {
      toastForValidation(check);
      return;
    }
    setBusy(true);
    try {
      const nextUrl = await onUpload(file);
      if (nextUrl !== undefined) setPreviewUrl(nextUrl);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      toastForApiError(msg);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!previewUrl || disabled || busy) return;
    setBusy(true);
    try {
      await onRemove();
      setPreviewUrl(null);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("room.admin.toast.logoUploadFailed"),
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="relative shrink-0">
        <button
          type="button"
          disabled={disabled || busy}
          className={cn(
            "group relative size-20 overflow-hidden rounded-2xl ring-2 ring-border/80",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
            (disabled || busy) && "pointer-events-none opacity-60",
          )}
          aria-label={t("room.admin.brand.change")}
          onClick={() => inputRef.current?.click()}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- animated GIF + multi-origin fallbacks
            <img
              src={src}
              alt=""
              className="size-full object-cover"
              onError={() => setSrcAttempt((prev) => (prev + 1 < srcCandidates.length ? prev + 1 : prev))}
            />
          ) : (
            <span className="flex size-full items-center justify-center bg-gradient-to-br from-brand/30 to-brand/5 text-lg font-bold text-brand">
              {initial}
            </span>
          )}
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 text-white opacity-0 transition-opacity",
              "group-hover:opacity-100 group-focus-visible:opacity-100",
            )}
          >
            {busy ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
          </span>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={BRAND_LOGO_ACCEPT}
          className="sr-only"
          disabled={disabled || busy}
          onChange={(e) => void handleFileChange(e.target.files?.[0])}
        />

        {previewUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || busy}
            className="absolute -bottom-1 -end-1 size-8 rounded-full border border-border bg-background shadow-sm"
            aria-label={t("room.admin.brand.remove")}
            onClick={(e) => {
              e.stopPropagation();
              void handleRemove();
            }}
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <p className="font-medium text-foreground">{t("room.admin.settings.brandLogo")}</p>
        <p className="text-xs text-muted-foreground">{t("room.admin.settings.brandLogoHint")}</p>
      </div>
    </div>
  );
}
