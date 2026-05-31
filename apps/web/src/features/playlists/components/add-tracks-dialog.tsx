"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Music2, Plus, Search } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Progress } from "@/shared/ui/progress";
import { useTranslations } from "@/shared/providers/locale-provider";
import { listTracks, normalizeTrackList, type TrackSummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import { PlaylistFormDialog } from "@/features/playlists/components/playlist-form-dialog";

const PAGE = 30;

type AddTracksDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlistName: string;
  existingTrackIds: Set<number>;
  onAdd: (trackIds: number[]) => Promise<void>;
  bulkBusy?: boolean;
  bulkProgress?: number;
};

export function AddTracksDialog({
  open,
  onOpenChange,
  playlistName,
  existingTrackIds,
  onAdd,
  bulkBusy = false,
  bulkProgress = 0,
}: AddTracksDialogProps) {
  const { t } = useTranslations();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 300);
    return () => window.clearTimeout(id);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listTracks({ search: debounced || undefined, limit: PAGE, offset: 0 });
      setTracks(normalizeTrackList(data));
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(new Set());
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [debounced, load, open]);

  const selectable = useMemo(
    () => tracks.filter((tr) => !existingTrackIds.has(tr.id)),
    [existingTrackIds, tracks],
  );

  const allSelected = selectable.length > 0 && selectable.every((tr) => selected.has(tr.id));

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(selectable.map((tr) => tr.id)));
  }

  return (
    <PlaylistFormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Plus}
      title={t("playlists.addTracksTitle")}
      description={t("playlists.addTracksDescription", { name: playlistName })}
      className="max-h-[min(90dvh,640px)] overflow-y-auto sm:max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={selected.size === 0 || bulkBusy}
            onClick={() => void onAdd(Array.from(selected))}
          >
            {bulkBusy ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("playlists.addTracksConfirm", { count: selected.size })}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            className="ps-9"
            placeholder={t("playlists.addTracksSearch")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="font-normal">
            {t("playlists.addTracksSelectable", { count: selectable.length })}
          </Badge>
          {selectable.length > 0 ? (
            <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={toggleAll}>
              {allSelected ? t("playlists.deselectAllPage") : t("playlists.selectAllPage")}
            </Button>
          ) : null}
        </div>

        <div className="max-h-64 overflow-y-auto rounded-lg border border-border/60 p-1">
          {loading ? (
            <div className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              {t("playlists.addTracksLoading")}
            </div>
          ) : selectable.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("playlists.addTracksEmpty")}</p>
          ) : (
            <ul className="space-y-1">
              {selectable.map((tr) => {
                const checked = selected.has(tr.id);
                return (
                  <li key={tr.id}>
                    <button
                      type="button"
                      onClick={() => toggle(tr.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start transition-colors",
                        checked ? "bg-brand/10" : "hover:bg-muted/50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded border",
                          checked ? "border-brand bg-brand text-brand-foreground" : "border-border",
                        )}
                        aria-hidden
                      >
                        {checked ? <Check className="size-2.5" strokeWidth={3} /> : null}
                      </span>
                      <Music2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{tr.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {tr.artist || t("playlists.noArtist")}
                          {tr.album ? ` · ${tr.album}` : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {bulkBusy && bulkProgress > 0 ? <Progress value={bulkProgress} /> : null}
      </div>
    </PlaylistFormDialog>
  );
}
