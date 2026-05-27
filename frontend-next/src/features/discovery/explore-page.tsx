"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, UserRound, X } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast-provider";
import {
  WorkspaceEmpty,
  WorkspaceList,
  WorkspaceNotice,
  WorkspacePage,
  WorkspaceSection,
} from "@/components/layout/workspace";
import { ExploreUserRow } from "@/features/discovery/explore-user-row";
import {
  followUser,
  getExploreFeed,
  getPublicUserProfile,
  getUserFollow,
  globalSearch,
  unfollowUser,
  type ExploreFeed,
  type PublicUserProfile,
} from "@/lib/api";

type DiscoverableUser = {
  id: number;
  username: string;
  display_name: string;
};

function displayNameFromProfile(profile: PublicUserProfile | undefined, fallback: string) {
  if (!profile) return fallback;
  const full = [profile.user.first_name, profile.user.last_name].filter(Boolean).join(" ").trim();
  return full || profile.user.username || fallback;
}

function ExploreUserRowSkeleton() {
  return (
    <li className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 sm:px-3">
      <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <Skeleton className="h-4 w-40 max-w-[70%]" />
        <Skeleton className="mt-2 h-3 w-56 max-w-[85%]" />
      </div>
      <Skeleton className="h-9 w-[7.25rem] shrink-0 rounded-lg" />
    </li>
  );
}

export function ExplorePage() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [feed, setFeed] = useState<ExploreFeed | null>(null);
  const [users, setUsers] = useState<DiscoverableUser[]>([]);
  const [suggestedPublicUsers, setSuggestedPublicUsers] = useState<DiscoverableUser[]>([]);
  const [publicProfiles, setPublicProfiles] = useState<Record<string, PublicUserProfile>>({});
  const [followState, setFollowState] = useState<Record<string, boolean>>({});
  const [followBusy, setFollowBusy] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFeed(await getExploreFeed());
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("explore.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filterPublicUsers = useCallback(async (list: DiscoverableUser[]) => {
    const checks = await Promise.all(
      list.map(async (user) => {
        try {
          const profile = await getPublicUserProfile(user.username);
          return { user, profile };
        } catch {
          return null;
        }
      }),
    );
    const publicRows = checks.filter((row): row is { user: DiscoverableUser; profile: PublicUserProfile } => row !== null);
    setPublicProfiles((prev) => {
      const next = { ...prev };
      for (const row of publicRows) {
        next[row.user.username] = row.profile;
        row.user.display_name = displayNameFromProfile(row.profile, row.user.username);
      }
      return next;
    });
    return publicRows.map((row) => row.user);
  }, []);

  const loadUsers = useCallback(async () => {
    const query = q.trim();
    if (query.length < 2) {
      setUsers([]);
      return;
    }
    setUsersLoading(true);
    try {
      const result = await globalSearch(query);
      const foundUsers = (result.users ?? []).map((u) => ({
        id: u.id,
        username: u.username,
        display_name: u.display_name?.trim() || u.username,
      }));
      const publicUsers = await filterPublicUsers(foundUsers);
      setUsers(publicUsers);
      const nextFollow: Record<string, boolean> = {};
      await Promise.all(
        publicUsers.map(async (user) => {
          try {
            const st = await getUserFollow(user.username);
            nextFollow[user.username] = st.following;
          } catch {
            nextFollow[user.username] = false;
          }
        }),
      );
      setFollowState((prev) => ({ ...prev, ...nextFollow }));
    } catch (e) {
      setUsers([]);
      showToast(e instanceof Error ? e.message : t("search.global.followFailed"), "error");
    } finally {
      setUsersLoading(false);
    }
  }, [filterPublicUsers, q, showToast, t]);

  useEffect(() => {
    const timer = setTimeout(() => void loadUsers(), 320);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  const suggestedUsers = useMemo<DiscoverableUser[]>(() => {
    if (!feed) return [];
    const seen = new Set<string>();
    const next: DiscoverableUser[] = [];
    const pushUser = (username?: string | null) => {
      const handle = username?.trim();
      if (!handle || seen.has(handle)) return;
      seen.add(handle);
      next.push({
        id: next.length + 1,
        username: handle,
        display_name: handle,
      });
    };
    for (const row of feed.shared_playlists) pushUser(row.owner_username);
    for (const row of feed.popular_channels) pushUser(row.channel.owner_username);
    for (const row of feed.live_channels) pushUser(row.owner_username);
    return next.slice(0, 12);
  }, [feed]);

  useEffect(() => {
    if (suggestedUsers.length === 0) {
      setSuggestedPublicUsers([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const filtered = await filterPublicUsers(suggestedUsers);
      const suggestedFollow: Record<string, boolean> = {};
      await Promise.all(
        filtered.map(async (user) => {
          try {
            const st = await getUserFollow(user.username);
            suggestedFollow[user.username] = st.following;
          } catch {
            suggestedFollow[user.username] = false;
          }
        }),
      );
      if (!cancelled) {
        setSuggestedPublicUsers(filtered);
        setFollowState((prev) => ({ ...suggestedFollow, ...prev }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filterPublicUsers, suggestedUsers]);

  const isSearchingPeople = q.trim().length >= 2;
  const visibleUsers = isSearchingPeople ? users : suggestedPublicUsers;

  async function toggleFollow(username: string) {
    const following = followState[username] === true;
    setFollowBusy((prev) => ({ ...prev, [username]: true }));
    try {
      if (following) {
        await unfollowUser(username);
        setFollowState((prev) => ({ ...prev, [username]: false }));
        showToast(t("search.global.unfollowed"), "success");
      } else {
        await followUser(username);
        setFollowState((prev) => ({ ...prev, [username]: true }));
        showToast(t("search.global.followed"), "success");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("search.global.followFailed"), "error");
    } finally {
      setFollowBusy((prev) => ({ ...prev, [username]: false }));
    }
  }

  if (loading && !feed) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!feed) return null;

  return (
    <WorkspacePage className="gap-4">
      <WorkspaceSection
        title={t("explore.title")}
        description={t("explore.peopleOnlySubtitle")}
      >
        <div className="space-y-3">
          <section className="surface-card p-3.5 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">{t("explore.peopleHint")}</p>
              <Badge className="ms-auto" variant={isSearchingPeople ? "default" : "secondary"}>
                {t("profile.public.followers", { count: visibleUsers.length })}
              </Badge>
            </div>
            <div className="relative mt-3">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                className="h-11 bg-transparent ps-9 pe-10"
                placeholder={t("explore.userSearchPlaceholder")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label={t("explore.userSearchPlaceholder")}
              />
              {q ? (
                <button
                  type="button"
                  className="focus-ring absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  onClick={() => setQ("")}
                  aria-label={t("channels.clearSearch")}
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
            {!isSearchingPeople ? (
              <WorkspaceNotice className="mt-3 py-2.5">
                <span className="text-sm">{t("explore.peopleEmptySuggested")}</span>
              </WorkspaceNotice>
            ) : null}
          </section>

          <section className="workspace-rail overflow-hidden">
            {usersLoading ? (
              <WorkspaceList className="gap-1 p-1.5 sm:p-2">
                {Array.from({ length: 7 }).map((_, idx) => (
                  <ExploreUserRowSkeleton key={idx} />
                ))}
              </WorkspaceList>
            ) : visibleUsers.length === 0 ? (
              <div className="p-2 sm:p-3">
                <WorkspaceEmpty icon={UserRound} title={t("explore.peopleEmpty")}>
                  <p>{isSearchingPeople ? t("explore.peopleEmpty") : t("explore.peopleEmptySuggested")}</p>
                </WorkspaceEmpty>
              </div>
            ) : (
              <WorkspaceList className="gap-0 p-1.5 sm:p-2">
                {visibleUsers.map((user) => (
                  <ExploreUserRow
                    key={user.username}
                    username={user.username}
                    displayName={displayNameFromProfile(publicProfiles[user.username], user.display_name)}
                    profile={publicProfiles[user.username]}
                    following={followState[user.username] === true}
                    busy={followBusy[user.username] === true}
                    onToggleFollow={() => void toggleFollow(user.username)}
                  />
                ))}
              </WorkspaceList>
            )}
          </section>
        </div>
      </WorkspaceSection>
    </WorkspacePage>
  );
}
