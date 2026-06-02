"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { importTrackFromExternalUrl } from "@/lib/api/tracks";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";

export function TrackImportExternalCard() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function onImport() {
    if (!url.trim()) return;
    setBusy(true);
    try {
      await importTrackFromExternalUrl(url.trim());
      showToast(t("tracks.importSuccess"), "success");
      setUrl("");
    } catch (e) {
      const raw = e instanceof Error ? e.message : "import_failed";
      const { localizeMessage } = await import("@/lib/i18n/localize-message");
      showToast(localizeMessage(raw) || t("tracks.importFailed"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-border/90" data-testid="track-import-external">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-4 w-4 text-brand" />
          {t("tracks.importExternalTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">{t("tracks.importExternalHint")}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={t("tracks.importExternalPlaceholder")}
            className="flex-1"
          />
          <Button type="button" disabled={busy || !url.trim()} onClick={() => void onImport()}>
            {t("tracks.importExternalAction")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
