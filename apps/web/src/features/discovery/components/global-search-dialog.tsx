"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, ListMusic, Music, Radio, Search, User, Share2 } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/ui/command";
import { useToast } from "@/shared/ui/toast-provider";
import { Button } from "@/shared/ui/button";
import {
  followUser,
  getUserFollow,
  globalSearch,
  unfollowUser,
  type ChannelSummary,
  type PlaylistSummary,
  type TrackSummary,
} from "@/lib/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GlobalSearchDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [followState, setFollowState] = useState<Record<string, boolean>>({});
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [users, setUsers] = useState<Array<{ id: number; username: string; display_name: string }>>([]);
  const [sharedPlaylists, setSharedPlaylists] = useState<
    Array<{ token: string; playlist_name: string; owner_username: string }>
  >([]);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setTracks([]);
      setPlaylists([]);
      setChannels([]);
      setUsers([]);
      setSharedPlaylists([]);
      return;
    }
    setLoading(true);
    try {
      const res = await globalSearch(trimmed);
      setTracks(res.tracks);
      setPlaylists(res.playlists);
      setChannels(res.channels);
      const foundUsers = res.users ?? [];
      setUsers(foundUsers);
      setSharedPlaylists(res.shared_playlists ?? []);
      const nextFollow: Record<string, boolean> = {};
      await Promise.all(
        foundUsers.map(async (u) => {
          try {
            const st = await getUserFollow(u.username);
            nextFollow[u.username] = st.following;
          } catch {
            nextFollow[u.username] = false;
          }
        }),
      );
      setFollowState(nextFollow);
    } catch {
      setTracks([]);
      setPlaylists([]);
      setChannels([]);
      setUsers([]);
      setSharedPlaylists([]);
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

  const empty =
    !loading &&
    query.trim().length >= 2 &&
    !tracks.length &&
    !playlists.length &&
    !channels.length &&
    !users.length &&
    !sharedPlaylists.length;

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
        {users.length > 0 ? (
          <CommandGroup heading={t("search.global.users")}>
            {users.map((u) => {
              const following = followState[u.username] === true;
              return (
                <CommandItem
                  key={`u-${u.id}`}
                  onSelect={() => go(`/users/${encodeURIComponent(u.username)}`)}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <User className="h-4 w-4 shrink-0" />
                    <span className="truncate">@{u.username}</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={following ? "secondary" : "outline"}
                    className="h-7 shrink-0 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      void (async () => {
                        try {
                          if (following) {
                            await unfollowUser(u.username);
                            setFollowState((s) => ({ ...s, [u.username]: false }));
                            showToast(t("search.global.unfollowed"), "success");
                          } else {
                            await followUser(u.username);
                            setFollowState((s) => ({ ...s, [u.username]: true }));
                            showToast(t("search.global.followed"), "success");
                          }
                        } catch (err) {
                          showToast(err instanceof Error ? err.message : t("search.global.followFailed"), "error");
                        }
                      })();
                    }}
                  >
                    {following ? t("search.global.unfollow") : t("search.global.follow")}
                  </Button>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}
        {sharedPlaylists.length > 0 ? (
          <CommandGroup heading={t("search.global.sharedPlaylists")}>
            {sharedPlaylists.map((sp) => (
              <CommandItem key={`sp-${sp.token}`} onSelect={() => go(`/share/playlist/${sp.token}`)}>
                <Share2 className="h-4 w-4" />
                <span className="truncate">
                  {sp.playlist_name}
                  {sp.owner_username ? ` — @${sp.owner_username}` : ""}
                </span>
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
