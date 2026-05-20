"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, ListMusic, Music, Radio, Search } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { globalSearch, type ChannelSummary, type PlaylistSummary, type TrackSummary } from "@/lib/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GlobalSearchDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslations();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setTracks([]);
      setPlaylists([]);
      setChannels([]);
      return;
    }
    setLoading(true);
    try {
      const res = await globalSearch(trimmed);
      setTracks(res.tracks);
      setPlaylists(res.playlists);
      setChannels(res.channels);
    } catch {
      setTracks([]);
      setPlaylists([]);
      setChannels([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => void runSearch(query), 280);
    return () => clearTimeout(timer);
  }, [open, query, runSearch]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  const empty = !loading && query.trim().length >= 2 && !tracks.length && !playlists.length && !channels.length;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={t("search.global.placeholder")}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.trim().length < 2 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("search.global.hint")}</p>
        ) : null}
        {loading ? <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t("common.loading")}</p> : null}
        {empty ? <CommandEmpty>{t("search.global.empty")}</CommandEmpty> : null}
        {tracks.length > 0 ? (
          <CommandGroup heading={t("search.global.tracks")}>
            {tracks.map((track) => (
              <CommandItem key={`t-${track.id}`} onSelect={() => go("/dashboard?tab=tracks")}>
                <Music className="h-4 w-4" />
                <span className="truncate">
                  {track.title}
                  {track.artist ? ` — ${track.artist}` : ""}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {playlists.length > 0 ? (
          <CommandGroup heading={t("search.global.playlists")}>
            {playlists.map((pl) => (
              <CommandItem key={`p-${pl.id}`} onSelect={() => go("/dashboard?tab=playlists")}>
                <ListMusic className="h-4 w-4" />
                <span className="truncate">{pl.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {channels.length > 0 ? (
          <CommandGroup heading={t("search.global.channels")}>
            {channels.map((ch) => (
              <CommandItem key={`c-${ch.id}`} onSelect={() => go(`/channel/${ch.id}`)}>
                <Radio className="h-4 w-4" />
                <span className="truncate">{ch.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        <CommandGroup heading={t("search.global.navigate")}>
          <CommandItem onSelect={() => go("/dashboard")}>
            <LayoutDashboard className="h-4 w-4" />
            {t("nav.dashboard")}
          </CommandItem>
          <CommandItem onSelect={() => go("/dashboard?tab=tracks")}>
            <Search className="h-4 w-4" />
            {t("dashboard.tab.tracks")}
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
