import type { APIRequestContext } from "@playwright/test";
import { apiURL, fetchCsrf } from "./auth";

export type ChannelJson = { id: number; name: string; privacy?: string; public_slug?: string; public_join_slug?: string | null };

export async function createChannel(
  request: APIRequestContext,
  payload: { name: string; description?: string; privacy?: "public" | "private" | "unlisted" },
): Promise<ChannelJson> {
  const csrf = await fetchCsrf(request);
  const res = await request.post(`${apiURL}/api/channels/`, {
    data: payload,
    headers: { "X-CSRFToken": csrf },
  });
  if (!res.ok()) throw new Error(`create channel failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as ChannelJson;
}

export async function followChannelApi(request: APIRequestContext, channelId: number, notifyLive = true): Promise<void> {
  const csrf = await fetchCsrf(request);
  const res = await request.post(`${apiURL}/api/channels/${channelId}/follow`, {
    data: { notify_live: notifyLive },
    headers: { "X-CSRFToken": csrf },
  });
  if (!res.ok()) throw new Error(`follow channel failed: ${res.status()} ${await res.text()}`);
}

export async function listFollowingChannelsApi(request: APIRequestContext) {
  const res = await request.get(`${apiURL}/api/me/following-channels`);
  if (!res.ok()) throw new Error(`following feed failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as {
    results: Array<{ channel: ChannelJson; is_live: boolean; is_member: boolean; notify_live: boolean }>;
  };
}

export async function getExploreApi(request: APIRequestContext) {
  const res = await request.get(`${apiURL}/api/explore`);
  if (!res.ok()) throw new Error(`explore failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as {
    live_channels: ChannelJson[];
    popular_channels: Array<{ channel: ChannelJson; event_count: number }>;
    shared_playlists: unknown[];
  };
}

export async function patchPublicProfile(request: APIRequestContext, payload: { bio?: string; is_public?: boolean }) {
  const csrf = await fetchCsrf(request);
  const res = await request.patch(`${apiURL}/api/auth/me/public-profile`, {
    data: payload,
    headers: { "X-CSRFToken": csrf },
  });
  if (!res.ok()) throw new Error(`public profile patch failed: ${res.status()} ${await res.text()}`);
}

export async function followUserApi(request: APIRequestContext, username: string): Promise<void> {
  const csrf = await fetchCsrf(request);
  const res = await request.post(`${apiURL}/api/users/${encodeURIComponent(username)}/follow`, {
    data: {},
    headers: { "X-CSRFToken": csrf },
  });
  if (!res.ok()) throw new Error(`follow user failed: ${res.status()} ${await res.text()}`);
}

export async function getUserFollowApi(request: APIRequestContext, username: string) {
  const res = await request.get(`${apiURL}/api/users/${encodeURIComponent(username)}/follow`);
  if (!res.ok()) throw new Error(`user follow state failed: ${res.status()} ${await res.text()}`);
  return (await res.json()) as { following: boolean; follower_count: number };
}
