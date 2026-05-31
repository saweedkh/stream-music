"use client";

import { Loader2, Music2 } from "lucide-react";
import { TrackAccessPicker } from "@/features/tracks/components/track-access-picker";
import type { TrackAccess } from "@/features/tracks/model/track-access";
import { useIsLgUp } from "@/shared/hooks/use-media-query";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import type { TrackSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

type TrackEditDialogProps = {
  track: TrackSummary | null;
  title: string;
  artist: string;
  album: string;
  access: TrackAccess;
  busy: boolean;
  onTitleChange: (value: string) => void;
  onArtistChange: (value: string) => void;
  onAlbumChange: (value: string) => void;
  onAccessChange: (value: TrackAccess) => void;
  onClose: () => void;
  onSave: () => void;
};

function TrackEditFields({
  title,
  artist,
  album,
  access,
  onTitleChange,
  onArtistChange,
  onAlbumChange,
  onAccessChange,
}: Pick<
  TrackEditDialogProps,
  "title" | "artist" | "album" | "access" | "onTitleChange" | "onArtistChange" | "onAlbumChange" | "onAccessChange"
>) {
  const { t } = useTranslations();

  return (
    <div className="grid gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="edit-track-title">{t("tracks.title")}</Label>
        <Input id="edit-track-title" value={title} onChange={(e) => onTitleChange(e.target.value)} autoComplete="off" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="edit-track-artist">{t("tracks.artist")}</Label>
          <Input id="edit-track-artist" value={artist} onChange={(e) => onArtistChange(e.target.value)} autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-track-album">{t("tracks.album")}</Label>
          <Input id="edit-track-album" value={album} onChange={(e) => onAlbumChange(e.target.value)} autoComplete="off" />
        </div>
      </div>
      <TrackAccessPicker access={access} onAccessChange={onAccessChange} compact />
    </div>
  );
}

function TrackEditActions({ busy, title, onClose, onSave }: { busy: boolean; title: string; onClose: () => void; onSave: () => void }) {
  const { t } = useTranslations();
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={onClose}>
        {t("tracks.cancel")}
      </Button>
      <Button type="button" disabled={busy || !title.trim()} onClick={onSave}>
        {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" aria-hidden /> : null}
        {t("tracks.save")}
      </Button>
    </div>
  );
}

export function TrackEditDialog(props: TrackEditDialogProps) {
  const { track, busy, onClose, onSave } = props;
  const { t } = useTranslations();
  const isLgUp = useIsLgUp();
  const open = track !== null;

  const fields = (
    <TrackEditFields
      title={props.title}
      artist={props.artist}
      album={props.album}
      access={props.access}
      onTitleChange={props.onTitleChange}
      onArtistChange={props.onArtistChange}
      onAlbumChange={props.onAlbumChange}
      onAccessChange={props.onAccessChange}
    />
  );

  return (
    <>
      <Sheet open={open && !isLgUp} onOpenChange={(next) => !next && onClose()}>
        <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-hidden p-0">
          <SheetTitle className="sr-only">{t("tracks.editTitle")}</SheetTitle>
          <div className="relative z-10 border-b border-border/50 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
                <Music2 className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-display text-base font-semibold">{t("tracks.editTitle")}</p>
                <p className="truncate text-xs text-muted-foreground">{track?.title}</p>
              </div>
            </div>
          </div>
          <div className="overflow-y-auto px-4 py-4">{fields}</div>
          <div className="border-t border-border/50 bg-card px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <TrackEditActions busy={busy} title={props.title} onClose={onClose} onSave={onSave} />
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={open && isLgUp} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className={cn("max-h-[min(90dvh,36rem)] overflow-y-auto sm:max-w-lg")}>
          <DialogHeader>
            <DialogTitle>{t("tracks.editTitle")}</DialogTitle>
            <DialogDescription>{t("tracks.editDescription")}</DialogDescription>
          </DialogHeader>
          {fields}
          <DialogFooter>
            <TrackEditActions busy={busy} title={props.title} onClose={onClose} onSave={onSave} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
