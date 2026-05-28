"use client";

import { useCallback, useEffect, useState } from "react";
import {
  followUser,
  getPublicUserProfile,
  getUserFollow,
  globalSearch,
  unfollowUser,
  type PublicUserProfile,
} from "@/lib/api";
import { displayNameFromProfile } from "@/features/discovery/model/explore-utils";

export type DiscoverableUser = {
  id: number;
  username: string;
  display_name: string;
};

async function filterPublicUsers(
  list: DiscoverableUser[],
  mergeProfiles: (profiles: Record<string, PublicUserProfile>) => void,
): Promise<DiscoverableUser[]> {
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
  const profiles: Record<string, PublicUserProfile> = {};
  const users = publicRows.map(({ user, profile }) => {
    profiles[user.username] = profile;
    return {
      ...user,
      display_name: displayNameFromProfile(profile, user.username),
    };
  });
  mergeProfiles(profiles);
  return users;
}

async function loadFollowState(usernames: string[]): Promise<Record<string, boolean>> {
  const next: Record<string, boolean> = {};
  await Promise.all(
    usernames.map(async (username) => {
      try {
        const st = await getUserFollow(username);
        next[username] = st.following;
      } catch {
        next[username] = false;
      }
    }),
  );
  return next;
}

export function useDiscoverableUsers(
  query: string,
  suggestedUsernames: string[],
  onError: (message: string) => void,
  onFollowToast: { followed: string; unfollowed: string; failed: string },
  showToast: (message: string, variant: "success" | "error") => void,
) {
  const [users, setUsers] = useState<DiscoverableUser[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<DiscoverableUser[]>([]);
  const [publicProfiles, setPublicProfiles] = useState<Record<string, PublicUserProfile>>({});
  const [followState, setFollowState] = useState<Record<string, boolean>>({});
  const [followBusy, setFollowBusy] = useState<Record<string, boolean>>({});
  const [searchLoading, setSearchLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const mergeProfiles = useCallback((profiles: Record<string, PublicUserProfile>) => {
    setPublicProfiles((prev) => ({ ...prev, ...profiles }));
  }, []);

  const isSearching = query.trim().length >= 2;
  const visibleUsers = isSearching ? users : suggestedUsers;
  const loading = isSearching ? searchLoading : suggestLoading;

  const loadSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setUsers([]);
      return;
    }
    setSearchLoading(true);
    try {
      const result = await globalSearch(trimmed);
      const foundUsers = (result.users ?? []).map((u) => ({
        id: u.id,
        username: u.username,
        display_name: u.display_name?.trim() || u.username,
      }));
      const publicUsers = await filterPublicUsers(foundUsers, mergeProfiles);
      setUsers(publicUsers);
      const nextFollow = await loadFollowState(publicUsers.map((u) => u.username));
      setFollowState((prev) => ({ ...prev, ...nextFollow }));
    } catch (e) {
      setUsers([]);
      onError(e instanceof Error ? e.message : onFollowToast.failed);
    } finally {
      setSearchLoading(false);
    }
  }, [mergeProfiles, onError, onFollowToast.failed, query]);

  useEffect(() => {
    const timer = setTimeout(() => void loadSearch(), 320);
    return () => clearTimeout(timer);
  }, [loadSearch]);

  useEffect(() => {
    if (suggestedUsernames.length === 0) {
      setSuggestedUsers([]);
      setSuggestLoading(false);
      return;
    }
    let cancelled = false;
    setSuggestLoading(true);
    void (async () => {
      const list = suggestedUsernames.map((username, index) => ({
        id: index + 1,
        username,
        display_name: username,
      }));
      const filtered = await filterPublicUsers(list, mergeProfiles);
      const nextFollow = await loadFollowState(filtered.map((u) => u.username));
      if (!cancelled) {
        setSuggestedUsers(filtered);
        setFollowState((prev) => ({ ...nextFollow, ...prev }));
        setSuggestLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mergeProfiles, suggestedUsernames]);

  async function toggleFollow(username: string) {
    const following = followState[username] === true;
    setFollowBusy((prev) => ({ ...prev, [username]: true }));
    try {
      if (following) {
        await unfollowUser(username);
        setFollowState((prev) => ({ ...prev, [username]: false }));
        showToast(onFollowToast.unfollowed, "success");
      } else {
        await followUser(username);
        setFollowState((prev) => ({ ...prev, [username]: true }));
        showToast(onFollowToast.followed, "success");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : onFollowToast.failed, "error");
    } finally {
      setFollowBusy((prev) => ({ ...prev, [username]: false }));
    }
  }

  return {
    isSearching,
    visibleUsers,
    publicProfiles,
    followState,
    followBusy,
    loading,
    toggleFollow,
  };
}
