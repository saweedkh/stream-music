"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useTranslations } from "@/components/providers/locale-provider";
import { useToast } from "@/components/ui/toast-provider";
import {
  assignPlaylistToChannel,
  copyPlaylistToChannel,
  type ChannelSummary,
  type PlaylistSummary,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export type AddPlaylistToChannelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlist: PlaylistSummary | null;
  channels: ChannelSummary[];
  currentUserId: number | null;
  /** When set, channel picker is hidden and this channel is used. */
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
    const defaultId =
      targetChannelId ??
      (activeChannels[0] ? String(activeChannels[0].id) : "");
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("playlists.addToChannelTitle")}</DialogTitle>
          <DialogDescription>
            {playlist ? (
              <>
                <span className="font-medium text-foreground">{playlist.name}</span>
                {" — "}
                {t("playlists.addToChannelModeTitle")}
              </>
            ) : (
              t("playlists.addToChannelModeTitle")
            )}
          </DialogDescription>
        </DialogHeader>

        {noChannels ? (
          <p className="py-2 text-sm text-muted-foreground">{t("playlists.noChannelsForImport")}</p>
        ) : (
          <div className="space-y-3 py-1">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className={cn(
                  "rounded-xl border p-3 text-start transition-colors",
                  mode === "copy"
                    ? "border-brand/50 bg-brand/10"
                    : "border-border/70 bg-card/40 hover:border-border",
                )}
                onClick={() => setMode("copy")}
              >
                <p className="text-sm font-medium text-foreground">{t("playlists.modeCopyTitle")}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("playlists.modeCopyDescription")}</p>
              </button>
              <button
                type="button"
                disabled={!canLink}
                className={cn(
                  "rounded-xl border p-3 text-start transition-colors",
                  !canLink && "cursor-not-allowed opacity-50",
                  mode === "link"
                    ? "border-brand/50 bg-brand/10"
                    : "border-border/70 bg-card/40 hover:border-border",
                )}
                onClick={() => {
                  if (canLink) setMode("link");
                }}
              >
                <p className="text-sm font-medium text-foreground">{t("playlists.modeLinkTitle")}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {canLink ? t("playlists.modeLinkDescription") : t("playlists.modeLinkDisabled")}
                </p>
              </button>
            </div>

            {!lockChannel ? (
              <div className="space-y-1">
                <Label>{t("playlists.selectChannel")}</Label>
                <Select
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

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            disabled={!playlist || !channelId || busy || noChannels}
            onClick={() => void handleConfirm()}
          >
            {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
            {mode === "link" ? t("playlists.modeLinkTitle") : t("playlists.modeCopyTitle")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
