"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ListMusic, Loader2, Search } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { AddPlaylistToChannelDialog } from "@/features/playlists/components/add-playlist-to-channel-dialog";
import { getMe, listChannels, listPlaylists, type ChannelSummary, type PlaylistSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string;
  onComplete?: () => void | Promise<void>;
};

export function ImportPlaylistToChannelDialog({ open, onOpenChange, channelId, onComplete }: Props) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [picked, setPicked] = useState<PlaylistSummary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [all, ch, me] = await Promise.all([listPlaylists(), listChannels(), getMe()]);
      const cid = Number(channelId);
      setPlaylists(all.filter((p) => p.channel !== cid));
      setChannels(ch);
      setCurrentUserId(me?.user?.id ?? null);
    } catch {
      showToast(t("playlists.cannotRefresh"), "error");
    } finally {
      setLoading(false);
    }
  }, [channelId, showToast, t]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setPicked(null);
      void load();
    }
  }, [open, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return playlists;
    return playlists.filter((p) => p.name.toLowerCase().includes(q));
  }, [playlists, query]);

  function handlePick(pl: PlaylistSummary) {
    setPicked(pl);
    setConfirmOpen(true);
  }

  async function handleComplete() {
    setConfirmOpen(false);
    onOpenChange(false);
    await onComplete?.();
  }

  return (
    <>
      <Dialog open={open && !confirmOpen} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(90vh,32rem)] flex-col sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("room.admin.playlist.importTitle")}</DialogTitle>
            <DialogDescription>{t("room.admin.playlist.importDescription")}</DialogDescription>
          </DialogHeader>
          <div className="relative shrink-0">
            <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              className="ps-9"
              placeholder={t("room.admin.playlist.importSearch")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ScrollArea className="min-h-0 flex-1">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("room.admin.playlist.importEmpty")}</p>
            ) : (
              <ul className="space-y-1 pe-2">
                {filtered.map((pl) => (
                  <li key={pl.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2.5 text-start text-sm transition-colors",
                        "hover:border-border/60 hover:bg-muted/30",
                      )}
                      onClick={() => handlePick(pl)}
                    >
                      <ListMusic className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-medium">{pl.name}</span>
                      {pl.channel ? (
                        <span className="shrink-0 text-[10px] text-muted-foreground">{t("playlists.onChannel")}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
          <div className="flex shrink-0 justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddPlaylistToChannelDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        playlist={picked}
        channels={channels}
        currentUserId={currentUserId}
        targetChannelId={channelId}
        onComplete={handleComplete}
      />
    </>
  );
}
