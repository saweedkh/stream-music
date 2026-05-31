"use client";

import { ChevronDown, Disc3, Link2, ListMusic, Plus, Radio, Search, Trash2, Unlink, X } from "lucide-react";
import { PlaylistTrackRow } from "@/features/playlists/components/playlist-track-row";
import { WorkspaceEmpty } from "@/shared/layout/workspace";
import { useTranslations } from "@/shared/providers/locale-provider";
import { FavoriteStarButton } from "@/shared/ui/favorite-star-button";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import type { PlaylistSummary } from "@/lib/api";
import type { PlaylistItemSummary } from "@/lib/api";

type PlaylistDetailProps = {
  playlist: PlaylistSummary | null;
  channelName: string | null;
  items: PlaylistItemSummary[];
  totalItems: number;
  itemsLoading: boolean;
  search: string;
  onSearchChange: (q: string) => void;
  isFiltering: boolean;
  draggingId: number | null;
  onDragStart: (id: number) => void;
  onDrop: (index: number) => void;
  onMoveItem: (itemId: number, targetIndex: number) => void;
  onRemoveItem: (id: number) => void;
  onAddTracks: () => void;
  onAddToChannel: () => void;
  onRemoveFromChannel: () => void;
  onShare: () => void;
  onDelete: () => void;
  shareBusy: boolean;
  hasChannels: boolean;
  canRemoveFromChannel: boolean;
  favoriteBusy?: boolean;
  onToggleFavorite?: () => void;
};

export function PlaylistDetail({
  playlist,
  channelName,
  items,
  totalItems,
  itemsLoading,
  search,
  onSearchChange,
  isFiltering,
  draggingId,
  onDragStart,
  onDrop,
  onMoveItem,
  onRemoveItem,
  onAddTracks,
  onAddToChannel,
  onRemoveFromChannel,
  onShare,
  onDelete,
  shareBusy,
  hasChannels,
  canRemoveFromChannel,
  favoriteBusy = false,
  onToggleFavorite,
}: PlaylistDetailProps) {
  const { t } = useTranslations();

  if (!playlist) {
    return (
      <WorkspaceEmpty icon={ListMusic} title={t("playlists.selectPlaylistHint")} className="min-h-[16rem] py-12">
        {t("playlists.selectPlaylistHintDetail")}
      </WorkspaceEmpty>
    );
  }

  const subtitle = [
    t("playlists.trackCount", { count: String(totalItems) }),
    channelName ?? t("playlists.personalBadge"),
  ].join(" · ");

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 text-start">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-xl font-semibold tracking-tight">{playlist.name}</h3>
            {onToggleFavorite ? (
              <FavoriteStarButton
                favorited={Boolean(playlist.is_favorited)}
                busy={favoriteBusy}
                label={playlist.is_favorited ? t("favorites.remove") : t("favorites.add")}
                onToggle={onToggleFavorite}
              />
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" size="sm" className="gap-1.5" onClick={onAddTracks}>
            <Plus className="size-4" aria-hidden />
            {t("playlists.addTracksAction")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="icon" variant="outline" className="size-9" aria-label={t("playlists.moreActions")}>
                <ChevronDown className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[250] w-52">
              {hasChannels ? (
                <DropdownMenuItem onClick={onAddToChannel}>
                  <Radio className="me-2 size-4" aria-hidden />
                  {playlist.channel ? t("playlists.moveChannel") : t("playlists.addToChannel")}
                </DropdownMenuItem>
              ) : null}
              {!playlist.channel ? (
                <DropdownMenuItem disabled={shareBusy} onClick={onShare}>
                  <Link2 className="me-2 size-4" aria-hidden />
                  {t("share.playlist.create")}
                </DropdownMenuItem>
              ) : null}
              {canRemoveFromChannel ? (
                <DropdownMenuItem onClick={onRemoveFromChannel}>
                  <Unlink className="me-2 size-4" aria-hidden />
                  {t("playlists.removeFromChannel")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={onDelete}>
                <Trash2 className="me-2 size-4" aria-hidden />
                {t("playlists.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          className="h-9 ps-9 pe-9"
          placeholder={t("playlists.searchInPlaylist")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label={t("playlists.searchInPlaylist")}
        />
        {search ? (
          <button
            type="button"
            className="absolute end-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50"
            onClick={() => onSearchChange("")}
            aria-label={t("playlists.clearSearch")}
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {!isFiltering ? <p className="text-xs text-muted-foreground">{t("playlists.reorderHint")}</p> : null}

      {itemsLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <WorkspaceEmpty
          icon={Disc3}
          title={isFiltering ? t("playlists.noSearchResults") : t("playlists.playlistEmptyNew")}
          className="py-10"
          action={
            !isFiltering ? (
              <Button type="button" size="sm" className="gap-1.5" onClick={onAddTracks}>
                <Plus className="size-4" aria-hidden />
                {t("playlists.addTracksAction")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-border/50 rounded-lg border border-border/50">
          {items.map((item, index) => (
            <PlaylistTrackRow
              key={item.id}
              item={item}
              index={index}
              total={items.length}
              isDragging={draggingId === item.id}
              dragEnabled={!isFiltering}
              onDragStart={() => onDragStart(item.id)}
              onDrop={() => onDrop(index)}
              onMoveUp={() => onMoveItem(item.id, index - 1)}
              onMoveDown={() => onMoveItem(item.id, index + 1)}
              onRemove={() => onRemoveItem(item.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
