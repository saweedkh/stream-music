"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Radio, Trash2 } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import type { PlaylistSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

type PlaylistSidebarItemProps = {
  playlist: PlaylistSummary;
  channelName: string | null;
  selected: boolean;
  onSelect: () => void;
  onRename: (name: string) => Promise<void>;
  onDelete: () => void;
  onAddToChannel: () => void;
  hasChannels: boolean;
};

export function PlaylistSidebarItem({
  playlist,
  channelName,
  selected,
  onSelect,
  onRename,
  onDelete,
  onAddToChannel,
  hasChannels,
}: PlaylistSidebarItemProps) {
  const { t } = useTranslations();
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const meta = channelName ?? t("playlists.personalBadge");
  const initial = playlist.name.trim().charAt(0).toUpperCase() || "?";

  async function commitRename() {
    const next = renameValue.trim();
    setRenaming(false);
    if (!next || next === playlist.name) return;
    await onRename(next);
  }

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-2 rounded-lg transition-colors",
          selected ? "bg-brand/10" : "hover:bg-muted/40",
        )}
      >
        <button
          type="button"
          onClick={() => !renaming && onSelect()}
          aria-pressed={selected}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 py-2.5 ps-3 text-start",
            selected && "border-s-2 border-brand",
          )}
        >
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold",
              selected ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground",
            )}
            aria-hidden
          >
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            {renaming ? (
              <Input
                autoFocus
                value={renameValue}
                className="h-8 text-sm"
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => void commitRename()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") void commitRename();
                  if (e.key === "Escape") setRenaming(false);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className="block truncate text-sm font-medium leading-tight">{playlist.name}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{meta}</span>
              </>
            )}
          </span>
        </button>

        {!renaming ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="me-1 size-7 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                aria-label={t("playlists.moreActions")}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[250] w-44">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameValue(playlist.name);
                  setRenaming(true);
                }}
              >
                <Pencil className="me-2 size-4" aria-hidden />
                {t("playlists.rename")}
              </DropdownMenuItem>
              {hasChannels ? (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToChannel();
                  }}
                >
                  <Radio className="me-2 size-4" aria-hidden />
                  {t("playlists.addToChannel")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={() => onDelete()}>
                <Trash2 className="me-2 size-4" aria-hidden />
                {t("playlists.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </li>
  );
}
