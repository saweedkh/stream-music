"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ListMusic, Loader2 } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { useToast } from "@/shared/ui/toast-provider";
import { importPlaylistShareToChannel, listChannels, previewPlaylistShare } from "@/lib/api";

export default function PlaylistSharePage() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const router = useRouter();
  const params = useParams();
  const token = String(params.token ?? "");
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewPlaylistShare>> | null>(null);
  const [channels, setChannels] = useState<Array<{ id: number; name: string }>>([]);
  const [channelId, setChannelId] = useState("");
  const [importName, setImportName] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([previewPlaylistShare(token), listChannels()])
      .then(([p, ch]) => {
        setPreview(p);
        setChannels(ch.filter((c) => c.is_active !== false));
        setImportName(`${p.playlist.name} (imported)`);
      })
      .catch(() => showToast(t("share.playlist.loadFailed"), "error"))
      .finally(() => setLoading(false));
  }, [token, showToast, t]);

  async function handleImport() {
    if (!channelId || !preview) return;
    setImporting(true);
    try {
      await importPlaylistShareToChannel(channelId, token, importName.trim() || undefined);
      showToast(t("share.playlist.imported"), "success");
      router.push(`/channel/${channelId}?tab=admin`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("share.playlist.importFailed"), "error");
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="mx-auto max-w-md p-8 text-center text-sm text-muted-foreground">
        {t("share.playlist.invalid")}
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href="/dashboard">{t("nav.dashboard")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4 sm:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListMusic className="h-5 w-5" />
            {preview.playlist.name}
          </CardTitle>
          <CardDescription>
            {t("share.playlist.by", { user: preview.owner_username, count: String(preview.item_count) })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {preview.items.slice(0, 30).map((item, i) => (
              <li key={item.id} className="truncate text-muted-foreground">
                {i + 1}. {item.track_detail?.title ?? `Track #${item.track}`}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("share.playlist.importTitle")}</CardTitle>
          <CardDescription>{t("share.playlist.importHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("share.playlist.channel")}</Label>
            <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              <option value="">{t("share.playlist.pickChannel")}</option>
              {channels.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("share.playlist.importName")}</Label>
            <Input value={importName} onChange={(e) => setImportName(e.target.value)} />
          </div>
          <Button type="button" disabled={!channelId || importing} onClick={() => void handleImport()}>
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("share.playlist.importCta")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
