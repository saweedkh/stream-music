"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Link2, Loader2, Radio } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import {
  assignPlaylistToChannel,
  copyPlaylistToChannel,
  type ChannelSummary,
  type PlaylistSummary,
} from "@/lib/api";
import { PlaylistFormDialog } from "@/features/playlists/components/playlist-form-dialog";

export type AddPlaylistToChannelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlist: PlaylistSummary | null;
  channels: ChannelSummary[];
  currentUserId: number | null;
  targetChannelId?: string;
  onComplete?: () => void | Promise<void>;
};

export function AddPlaylistToChannelDialog({
  open,
  onOpenChange,
  playlist,
  channels,
  currentUserId,
  targetChannelId,
  onComplete,
}: AddPlaylistToChannelDialogProps) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const lockChannel = Boolean(targetChannelId);

  const activeChannels = useMemo(
    () => channels.filter((ch) => ch.is_active !== false),
    [channels],
  );

  const canLink = useMemo(() => {
    if (!playlist || currentUserId == null) return false;
    if (playlist.channel != null) return false;
    return Number(playlist.owner) === Number(currentUserId);
  }, [playlist, currentUserId]);

  const [channelId, setChannelId] = useState("");
  const [mode, setMode] = useState<"copy" | "link">("copy");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const defaultId = targetChannelId ?? (activeChannels[0] ? String(activeChannels[0].id) : "");
    setChannelId(defaultId);
    setMode(canLink ? "link" : "copy");
  }, [open, targetChannelId, activeChannels, canLink]);

  async function handleConfirm() {
    if (!playlist || !channelId) return;
    setBusy(true);
    try {
      if (mode === "link") {
        await assignPlaylistToChannel(playlist.id, { channel_id: Number(channelId) });
        showToast(t("playlists.assignToChannelSuccess"), "success");
      } else {
        const result = await copyPlaylistToChannel(playlist.id, { channel_id: Number(channelId) });
        if (result.skipped_inaccessible > 0) {
          showToast(t("playlists.copySkippedTracks", { count: result.skipped_inaccessible }), "info");
        }
        showToast(t("playlists.copyToChannelSuccess"), "success");
      }
      onOpenChange(false);
      await onComplete?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      showToast(
        msg || (mode === "link" ? t("playlists.assignToChannelFailed") : t("playlists.copyToChannelFailed")),
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  const noChannels = activeChannels.length === 0 && !lockChannel;

  return (
    <PlaylistFormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Radio}
      title={t("playlists.addToChannelTitle")}
      description={
        playlist ? (
          <>
            <span className="font-medium text-foreground">{playlist.name}</span>
            {" — "}
            {t("playlists.addToChannelModeTitle")}
          </>
        ) : (
          t("playlists.addToChannelModeTitle")
        )
      }
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!playlist || !channelId || busy || noChannels}
            onClick={() => void handleConfirm()}
          >
            {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {mode === "link" ? t("playlists.modeLinkTitle") : t("playlists.modeCopyTitle")}
          </Button>
        </>
      }
    >
      {noChannels ? (
        <p className="text-sm text-muted-foreground">{t("playlists.noChannelsForImport")}</p>
      ) : (
        <div className="grid gap-4">
          <Tabs
            value={mode}
            onValueChange={(value) => {
              if (value === "link" && !canLink) return;
              setMode(value as "copy" | "link");
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="copy" className="gap-1.5 text-xs sm:text-sm">
                <Copy className="size-3.5 shrink-0" aria-hidden />
                {t("playlists.modeCopyTitle")}
              </TabsTrigger>
              <TabsTrigger value="link" disabled={!canLink} className="gap-1.5 text-xs sm:text-sm">
                <Link2 className="size-3.5 shrink-0" aria-hidden />
                {t("playlists.modeLinkTitle")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="copy" className="mt-2">
              <p className="text-sm text-muted-foreground">{t("playlists.modeCopyDescription")}</p>
            </TabsContent>
            <TabsContent value="link" className="mt-2">
              <p className="text-sm text-muted-foreground">
                {canLink ? t("playlists.modeLinkDescription") : t("playlists.modeLinkDisabled")}
              </p>
            </TabsContent>
          </Tabs>

          {!lockChannel ? (
            <div className="space-y-1.5">
              <Label htmlFor="playlist-channel-select">{t("playlists.selectChannel")}</Label>
              <Select
                id="playlist-channel-select"
                value={channelId}
                valid={Boolean(channelId)}
                onChange={(e) => setChannelId(e.target.value)}
              >
                <option value="">{t("playlists.selectChannel")}</option>
                {activeChannels.map((ch) => (
                  <option key={ch.id} value={String(ch.id)}>
                    {ch.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("playlists.targetChannelLocked", {
                name: activeChannels.find((c) => String(c.id) === channelId)?.name ?? "",
              })}
            </p>
          )}
        </div>
      )}
    </PlaylistFormDialog>
  );
}
