"use client";

import { ListMusic, Plus } from "lucide-react";
import { PlaylistSidebarItem } from "@/features/playlists/components/playlist-sidebar-item";
import { WorkspaceEmpty } from "@/shared/layout/workspace";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";
import type { ChannelSummary, PlaylistSummary } from "@/lib/api";

export type PlaylistSidebarProps = {
  playlists: PlaylistSummary[];
  channels: ChannelSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCreateClick: () => void;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => void;
  onAddToChannel: (playlist: PlaylistSummary) => void;
};

export function PlaylistSidebar({
  playlists,
  channels,
  selectedId,
  onSelect,
  onCreateClick,
  onRename,
  onDelete,
  onAddToChannel,
}: PlaylistSidebarProps) {
  const { t } = useTranslations();

  if (playlists.length === 0) {
    return (
      <WorkspaceEmpty icon={ListMusic} title={t("playlists.emptyList")} className="py-10">
        <Button type="button" size="sm" className="mt-3 gap-1.5" onClick={onCreateClick}>
          <Plus className="size-4" aria-hidden />
          {t("playlists.new")}
        </Button>
      </WorkspaceEmpty>
    );
  }

  return (
    <ul className="max-h-[min(32rem,60vh)] space-y-0.5 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
      {playlists.map((pl) => (
        <PlaylistSidebarItem
          key={pl.id}
          playlist={pl}
          channelName={pl.channel ? (channels.find((c) => c.id === pl.channel)?.name ?? null) : null}
          selected={selectedId === pl.id}
          onSelect={() => onSelect(pl.id)}
          onRename={(name) => onRename(pl.id, name)}
          onDelete={() => onDelete(pl.id)}
          onAddToChannel={() => onAddToChannel(pl)}
          hasChannels={channels.length > 0}
        />
      ))}
    </ul>
  );
}
