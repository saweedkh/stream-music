"use client";

import { Disc3, Globe, Lock, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  fromBackendVisibility,
  TRACK_ACCESS_LABEL_KEYS,
  type TrackAccess,
} from "@/features/tracks/model/track-access";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { FavoriteStarButton } from "@/shared/ui/favorite-star-button";
import type { TrackSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

type TrackLibraryRowProps = {
  track: TrackSummary;
  favoriteBusy: boolean;
  onToggleFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function AccessPill({ access }: { access: TrackAccess }) {
  const { t } = useTranslations();
  const isPublic = access === "public";
  const Icon = isPublic ? Globe : Lock;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium sm:text-[11px]",
        isPublic ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {t(TRACK_ACCESS_LABEL_KEYS[access])}
    </span>
  );
}

export function TrackLibraryRow({ track, favoriteBusy, onToggleFavorite, onEdit, onDelete }: TrackLibraryRowProps) {
  const { t } = useTranslations();
  const access = fromBackendVisibility(track.visibility);
  const meta = [track.artist, track.album].filter(Boolean).join(" · ");

  return (
    <li className="group flex items-center gap-2.5 rounded-xl border border-transparent px-2 py-2.5 transition-colors hover:border-border/50 hover:bg-muted/20 sm:gap-3 sm:px-3">
      <FavoriteStarButton
        favorited={Boolean(track.is_favorited)}
        busy={favoriteBusy}
        label={track.is_favorited ? t("favorites.remove") : t("favorites.add")}
        onToggle={onToggleFavorite}
      />

      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand/20 via-violet-500/15 to-brand/5 text-brand shadow-inner sm:size-11"
        aria-hidden
      >
        <Disc3 className="size-5 opacity-90" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="truncate text-sm font-semibold leading-tight">{track.title}</p>
          <AccessPill access={access} />
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta || t("tracks.noMeta")}</p>
      </div>

      <div className="hidden shrink-0 items-center gap-0.5 sm:flex">
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 opacity-70 group-hover:opacity-100" aria-label={t("tracks.edit")} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-rose-500/80 opacity-70 hover:text-rose-600 group-hover:opacity-100"
          aria-label={t("tracks.delete")}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0 sm:hidden" aria-label={t("tracks.rowActions")}>
            <MoreVertical className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[250] w-44">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="me-2 h-4 w-4" aria-hidden />
            {t("tracks.edit")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={onDelete}>
            <Trash2 className="me-2 h-4 w-4" aria-hidden />
            {t("tracks.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
