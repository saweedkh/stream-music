"use client";

import { Upload, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { Button } from "@/shared/ui/button";
import { importPlaylistBackup } from "@/lib/api/playlists";

type Props = {
  onImported?: () => void;
};

export function PlaylistBackupImportButton({ onImported }: Props) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Record<string, unknown>;
      const result = await importPlaylistBackup(data);
      showToast(
        t("playlists.backupImportSuccess", {
          playlists: result.created_playlists,
          items: result.created_items,
        }),
        "success",
      );
      onImported?.();
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("playlists.backupImportFailed"), "error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        data-testid="playlist-backup-import-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 w-full gap-1.5 text-xs"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        data-testid="playlist-backup-import"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {t("playlists.backupImport")}
      </Button>
    </>
  );
}
