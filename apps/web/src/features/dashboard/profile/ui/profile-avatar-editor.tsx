"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import {
  AVATAR_ACCEPT,
  validateAvatarFile,
} from "@/features/dashboard/profile/model/avatar";
import { resolveMediaCandidates } from "@/lib/media-url";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

type ProfileAvatarEditorProps = {
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  disabled?: boolean;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
};

export function ProfileAvatarEditor({
  username,
  displayName,
  avatarUrl,
  disabled,
  onUpload,
  onRemove,
}: ProfileAvatarEditorProps) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [srcAttempt, setSrcAttempt] = useState(0);

  const srcCandidates = useMemo(() => resolveMediaCandidates(avatarUrl), [avatarUrl]);
  const src = srcCandidates[srcAttempt] ?? null;

  useEffect(() => {
    setSrcAttempt(0);
  }, [avatarUrl]);

  const initial = (displayName || username || "?").trim().charAt(0).toUpperCase();

  async function handleFileChange(file: File | undefined) {
    if (!file || disabled || busy) return;
    const check = validateAvatarFile(file);
    if (check === "invalid") {
      showToast(t("profile.avatar.invalid"), "error");
      return;
    }
    if (check === "too_large") {
      showToast(t("profile.avatar.tooLarge"), "error");
      return;
    }
    setBusy(true);
    try {
      await onUpload(file);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!avatarUrl || disabled || busy) return;
    setBusy(true);
    try {
      await onRemove();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-brand/40 via-brand/10 to-transparent blur-sm" aria-hidden />

      <button
        type="button"
        disabled={disabled || busy}
        className={cn(
          "group relative size-[4.5rem] overflow-hidden rounded-full ring-2 ring-background sm:size-20",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
          (disabled || busy) && "pointer-events-none opacity-60",
        )}
        aria-label={t("profile.avatar.change")}
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
          <span className="flex size-full items-center justify-center bg-gradient-to-br from-brand/40 to-brand/10 text-xl font-bold text-brand sm:text-2xl">
            {initial}
          </span>
        )}
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity",
            "group-hover:opacity-100 group-focus-visible:opacity-100",
          )}
        >
          {busy ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_ACCEPT}
        className="sr-only"
        disabled={disabled || busy}
        onChange={(e) => void handleFileChange(e.target.files?.[0])}
      />

      {avatarUrl ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || busy}
          className="absolute -bottom-1 -end-1 size-8 rounded-full border border-border bg-background shadow-sm"
          aria-label={t("profile.avatar.remove")}
          onClick={(e) => {
            e.stopPropagation();
            void handleRemove();
          }}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
