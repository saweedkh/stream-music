"use client";

import { ChevronDown, ChevronUp, Disc3, GripVertical, MoreVertical, Trash2 } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import type { PlaylistItemSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

type PlaylistTrackRowProps = {
  item: PlaylistItemSummary;
  index: number;
  total: number;
  isDragging: boolean;
  dragEnabled: boolean;
  onDragStart: () => void;
  onDrop: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
};

export function PlaylistTrackRow({
  item,
  index,
  total,
  isDragging,
  dragEnabled,
  onDragStart,
  onDrop,
  onMoveUp,
  onMoveDown,
  onRemove,
}: PlaylistTrackRowProps) {
  const { t } = useTranslations();
  const td = item.track_detail;
  const title = td?.title ?? t("tracks.trackId", { id: item.track });
  const meta = [td?.artist, td?.album].filter(Boolean).join(" · ") || t("playlists.noArtist");
  const canMoveUp = dragEnabled && index > 0;
  const canMoveDown = dragEnabled && index < total - 1;

  return (
    <li
      draggable={dragEnabled}
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={cn("group flex items-center gap-3 px-1 py-2.5 sm:px-2", isDragging && "opacity-40")}
    >
      <span className="hidden w-6 shrink-0 text-center text-xs tabular-nums text-muted-foreground sm:block">{index + 1}</span>

      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground" aria-hidden>
        <Disc3 className="size-4" />
      </span>

      <div className="min-w-0 flex-1 text-start">
        <p className="truncate text-sm font-medium leading-tight">
          <span className="me-1.5 tabular-nums text-muted-foreground sm:hidden">{index + 1}.</span>
          {title}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
      </div>

      <div className="hidden shrink-0 items-center gap-0.5 sm:flex">
        <Button type="button" size="icon" variant="ghost" className="size-8" disabled={!canMoveUp} aria-label={t("playlists.moveUp")} onClick={onMoveUp}>
          <ChevronUp className="size-4" aria-hidden />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="size-8" disabled={!canMoveDown} aria-label={t("playlists.moveDown")} onClick={onMoveDown}>
          <ChevronDown className="size-4" aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 text-muted-foreground hover:text-rose-600"
          aria-label={t("playlists.removeFromPlaylist")}
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
        {dragEnabled ? <GripVertical className="size-4 cursor-grab text-muted-foreground/30 active:cursor-grabbing" aria-hidden /> : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0 sm:hidden" aria-label={t("playlists.moreActions")}>
            <MoreVertical className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[250] w-44">
          <DropdownMenuItem disabled={!canMoveUp} onClick={onMoveUp}>
            {t("playlists.moveUp")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canMoveDown} onClick={onMoveDown}>
            {t("playlists.moveDown")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-rose-600" onClick={onRemove}>
            {t("playlists.removeFromPlaylist")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
