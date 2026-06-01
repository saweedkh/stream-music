import { extractApiError, getApiBase, withAuthHeaders } from "@/lib/api/client";

export type ChannelPublicStatistics = {
  channel_id: number;
  total_listen_seconds: number;
  total_listen_hours: number;
  total_play_events: number;
  unique_listeners: number;
  updated_at: string | null;
};

export type ChannelDetailedStatistics = ChannelPublicStatistics & {
  premium_detail: boolean;
  top_tracks: {
    track_id: number;
    title: string;
    artist: string;
    listen_seconds: number;
    play_count: number;
  }[];
  top_listeners: {
    user_id: number;
    username: string;
    listen_seconds: number;
    play_count: number;
  }[];
};

export type GamificationProfile = {
  points: number;
  level: number;
  next_level_at: number;
  streak_days: number;
  lifetime_listen_hours: number;
  points_chart_30d: { date: string; points: number }[];
};

export async function getChannelStatistics(channelId: string): Promise<ChannelPublicStatistics> {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/statistics`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load statistics"));
  return (await res.json()) as ChannelPublicStatistics;
}

export async function getChannelStatisticsDetailed(
  channelId: string,
): Promise<ChannelDetailedStatistics> {
  const res = await fetch(
    `${getApiBase()}/api/channels/${channelId}/statistics/detailed`,
    await withAuthHeaders(),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load detailed statistics"));
  return (await res.json()) as ChannelDetailedStatistics;
}

export async function postChannelListenHeartbeat(
  channelId: string,
  seconds: number,
  trackId?: number | null,
): Promise<{ ok: boolean; recorded_seconds: number }> {
  const res = await fetch(
    `${getApiBase()}/api/channels/${channelId}/statistics/heartbeat`,
    await withAuthHeaders({
      method: "POST",
      body: JSON.stringify({ seconds, track_id: trackId ?? null }),
    }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Heartbeat failed"));
  return (await res.json()) as { ok: boolean; recorded_seconds: number };
}

export async function getMyGamification(): Promise<GamificationProfile> {
  const res = await fetch(`${getApiBase()}/api/auth/me/gamification`, await withAuthHeaders());
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load gamification"));
  return (await res.json()) as GamificationProfile;
}

export async function redeemPremiumCode(code: string): Promise<{ ok: boolean; is_premium: boolean }> {
  const res = await fetch(
    `${getApiBase()}/api/auth/me/premium/redeem`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({ code }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Redeem failed"));
  return (await res.json()) as { ok: boolean; is_premium: boolean };
}
