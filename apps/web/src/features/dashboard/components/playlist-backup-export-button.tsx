"use client";

import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { Button } from "@/shared/ui/button";
import { downloadPlaylistBackupJson, exportPlaylistBackup } from "@/lib/api/playlists";

export function PlaylistBackupExportButton() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  async function onExport() {
    setBusy(true);
    try {
      const payload = await exportPlaylistBackup();
      downloadPlaylistBackupJson(payload);
      showToast(t("playlists.backupSuccess", { count: payload.playlist_count }), "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("playlists.backupFailed"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 w-full gap-1.5 text-xs"
      disabled={busy}
      onClick={() => void onExport()}
      data-testid="playlist-backup-export"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {t("playlists.backupExport")}
    </Button>
  );
}
