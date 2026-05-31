import { getApiBase, withAuthFormData, withAuthHeaders, extractApiError } from "./client";
import type {
  GlobalSearchResult,
  ExploreFeed,
  PublicUserProfile,
  PremiumLimits,
  ChannelFollowState,
  FollowingChannelRow,
} from "./types";

export async function globalSearch(q: string): Promise<GlobalSearchResult> {
  const params = new URLSearchParams({ q: q.trim() });
  const res = await fetch(`${getApiBase()}/api/search/global?${params}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Search failed");
  return (await res.json()) as GlobalSearchResult;
}

export async function getExploreFeed(params?: { q?: string; lang?: string; genre?: string; live_only?: boolean }) {
  const sp = new URLSearchParams();
  if (params?.q?.trim()) sp.set("q", params.q.trim());
  if (params?.lang?.trim()) sp.set("lang", params.lang.trim());
  if (params?.genre?.trim()) sp.set("genre", params.genre.trim());
  if (params?.live_only) sp.set("live_only", "1");
  const qs = sp.toString();
  const res = await fetch(`${getApiBase()}/api/explore${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load explore"));
  return (await res.json()) as ExploreFeed;
}

export async function getPublicUserProfile(username: string): Promise<PublicUserProfile> {
  const res = await fetch(`${getApiBase()}/api/users/${encodeURIComponent(username)}/profile`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Profile not found"));
  return (await res.json()) as PublicUserProfile;
}

export type MePublicProfilePayload = {
  bio: string;
  is_public: boolean;
  avatar_url: string | null;
};

export async function patchMePublicProfile(payload: { bio?: string; is_public?: boolean }) {
  const res = await fetch(
    `${getApiBase()}/api/auth/me/public-profile`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update profile"));
  return (await res.json()) as MePublicProfilePayload;
}

export async function uploadMeAvatar(file: File): Promise<MePublicProfilePayload> {
  const body = new FormData();
  body.append("avatar", file);
  const res = await fetch(
    `${getApiBase()}/api/auth/me/public-profile`,
    await withAuthFormData({ method: "PATCH", body }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot upload avatar"));
  return (await res.json()) as MePublicProfilePayload;
}

export async function clearMeAvatar(): Promise<MePublicProfilePayload> {
  const res = await fetch(
    `${getApiBase()}/api/auth/me/public-profile`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify({ avatar_clear: true }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot remove avatar"));
  return (await res.json()) as MePublicProfilePayload;
}

export async function getUserFollow(username: string) {
  const res = await fetch(`${getApiBase()}/api/users/${encodeURIComponent(username)}/follow`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Cannot load follow state");
  return (await res.json()) as { following: boolean; follower_count: number; following_count: number };
}

export async function followUser(username: string) {
  const res = await fetch(
    `${getApiBase()}/api/users/${encodeURIComponent(username)}/follow`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({}) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Follow failed"));
  return (await res.json()) as { following: boolean };
}

export async function unfollowUser(username: string) {
  const res = await fetch(
    `${getApiBase()}/api/users/${encodeURIComponent(username)}/follow`,
    await withAuthHeaders({ method: "DELETE" }),
  );
  if (!res.ok) throw new Error("Unfollow failed");
  return (await res.json()) as { following: boolean };
}

export async function listFollowingChannels() {
  const res = await fetch(`${getApiBase()}/api/me/following-channels`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load following feed"));
  return (await res.json()) as { results: FollowingChannelRow[] };
}

export async function getChannelFollow(channelId: string): Promise<ChannelFollowState> {
  const res = await fetch(`${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/follow`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Cannot load follow state");
  return (await res.json()) as ChannelFollowState;
}

export async function followChannel(channelId: string, notifyLive = true): Promise<ChannelFollowState> {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/follow`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({ notify_live: notifyLive }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Follow failed"));
  return (await res.json()) as ChannelFollowState;
}

export async function unfollowChannel(channelId: string): Promise<{ following: boolean }> {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/follow`,
    await withAuthHeaders({ method: "DELETE" }),
  );
  if (!res.ok) throw new Error("Unfollow failed");
  return (await res.json()) as { following: boolean };
}

export async function getPremiumLimits(): Promise<PremiumLimits> {
  const res = await fetch(`${getApiBase()}/api/auth/me/premium-limits`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load limits");
  return (await res.json()) as PremiumLimits;
}
