import { getApiBase, withAuthHeaders, withAuthFormData, extractApiError, rejectIfChannelClosed } from "./client";
import {
  ChannelClosedError,
  type ChannelStateResponse,
  type GetChannelStateOptions,
  type PlaybackState,
  type ChannelControlAction,
  type JoinChannelOutcome,
  type JoinRequestRow,
  type ChannelExperienceSettings,
  type TrackSummary,
  type ChannelChatMessageRow,
  type ChannelPinnedMessageResponse,
  type ChannelTrackReactionRow,
  type PlaybackHistoryRow,
  type ChannelAuditLogRow,
  type ChannelPlaylistSuggestion,
  type ChannelNotificationPreference,
  type ChannelMember,
  type ChannelSummary,
  type QueueItemSummary,
  type PartyRecap,
  type ChannelsOnlineRow,
  type PlaylistSummary,
} from "./types";

export async function getChannelState(channelId: string, options?: GetChannelStateOptions): Promise<ChannelStateResponse> {
  const isBrowser = typeof window !== "undefined";
  const fetchInit: RequestInit = { cache: "no-store" };
  if (isBrowser) {
    fetchInit.credentials = "include";
  } else if (options?.cookieHeader) {
    fetchInit.headers = { ...(fetchInit.headers as Record<string, string>), Cookie: options.cookieHeader };
  }

  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/state`, fetchInit);
  if (res.status === 410) throw new ChannelClosedError();
  if (!res.ok) throw new Error("Cannot load channel state");
  return (await res.json()) as ChannelStateResponse;
}

export async function controlChannel(channelId: string, action: ChannelControlAction, payload?: Record<string, unknown>) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${channelId}/control`,
    await withAuthHeaders({
    method: "POST",
      body: JSON.stringify({ action, ...payload }),
    }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot send control action"));
  return (await res.json()) as PlaybackState;
}

export async function joinChannel(channelId: string, token?: string): Promise<JoinChannelOutcome> {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/join`, await withAuthHeaders({ method: "POST", body: JSON.stringify({ token }) }));
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 202) {
    return {
      status: "pending",
      channel: raw.channel as number,
      request_id: raw.request_id as number | undefined,
    };
  }
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot join channel"));
  return {
    status: "joined",
    channel: raw.channel as number,
    raw,
  };
}

export async function joinChannelFromLink(link: string, token?: string): Promise<JoinChannelOutcome> {
  const body: Record<string, string | undefined> = { link: link.trim() };
  if (token?.trim()) body.token = token.trim();
  const res = await fetch(`${getApiBase()}/api/channels/join-from-link`, await withAuthHeaders({ method: "POST", body: JSON.stringify(body) }));
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 202) {
    return {
      status: "pending",
      channel: raw.channel as number,
      request_id: raw.request_id as number | undefined,
    };
  }
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot join from this link"));
  return {
    status: "joined",
    channel: raw.channel as number,
    raw,
  };
}

export async function listChannelJoinRequests(channelId: string) {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/join-requests`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load join requests"));
  return (await res.json()) as { results: JoinRequestRow[] };
}

export async function approveJoinRequest(channelId: string, requestId: number) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${channelId}/join-requests/${requestId}/approve`,
    await withAuthHeaders({ method: "POST", body: "{}" }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot approve request"));
  return res.json();
}

export async function rejectJoinRequest(channelId: string, requestId: number) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${channelId}/join-requests/${requestId}/reject`,
    await withAuthHeaders({ method: "POST", body: "{}" }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot reject request"));
  return res.json();
}

export async function listChannelInvites(channelId: string) {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/invite`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load invites"));
  return (await res.json()) as { results: Array<{ id: number; token: string; is_active: boolean }> };
}

export async function createInvite(channelId: string) {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/invite`, await withAuthHeaders({ method: "POST" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot create invite"));
  return (await res.json()) as { token: string; invite_url: string };
}

export async function rotatePrivateInvite(channelId: string) {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/invite/rotate`, await withAuthHeaders({ method: "POST" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot rotate private invite"));
  return (await res.json()) as { token: string; invite_url: string };
}

export async function rotatePublicLink(channelId: string) {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/public-link/rotate`, await withAuthHeaders({ method: "POST" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot rotate public link"));
  return (await res.json()) as { public_url: string };
}

export async function updateChannelSettings(
  channelId: string,
  payload: {
    name?: string;
    description?: string;
    privacy?: "public" | "private" | "unlisted";
    member_limit?: number;
    join_requires_approval?: boolean;
    public_join_slug?: string | null;
    experience?: ChannelExperienceSettings;
    brand_logo_clear?: boolean;
  },
) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${channelId}/settings`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update channel settings"));
  return res.json();
}

export async function uploadChannelBrandLogo(channelId: string, file: File) {
  const body = new FormData();
  body.append("brand_logo", file);
  const res = await fetch(
    `${getApiBase()}/api/channels/${channelId}/settings`,
    await withAuthFormData({ method: "PATCH", body }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot upload channel logo"));
  const data = (await res.json()) as { brand_logo_url?: string | null };
  return data.brand_logo_url ?? null;
}

export async function clearChannelBrandLogo(channelId: string) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${channelId}/settings`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify({ brand_logo_clear: true }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot remove channel logo"));
  const data = (await res.json()) as { brand_logo_url?: string | null };
  return data.brand_logo_url ?? null;
}

export async function getSimilarTracks(channelId: string, fromTrackId: number) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/tracks/similar?from_track=${encodeURIComponent(String(fromTrackId))}`,
    { credentials: "include", cache: "no-store" },
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load similar tracks"));
  return (await res.json()) as { results: TrackSummary[] };
}

export async function listChannelChatMessages(channelId: string, options?: { limit?: number; before?: number }) {
  const sp = new URLSearchParams();
  if (options?.limit != null) sp.set("limit", String(options.limit));
  if (options?.before != null) sp.set("before", String(options.before));
  const q = sp.toString();
  const res = await fetch(`${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/chat${q ? `?${q}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load chat"));
  return (await res.json()) as { results: ChannelChatMessageRow[] };
}

export async function getPinnedChannelMessage(channelId: string) {
  const res = await fetch(`${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/chat/pin`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load pinned message"));
  return (await res.json()) as ChannelPinnedMessageResponse;
}

export async function setPinnedChannelMessage(channelId: string, messageId: number | null) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/chat/pin`,
    await withAuthHeaders({ method: "PUT", body: JSON.stringify({ message_id: messageId }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update pinned message"));
  return (await res.json()) as ChannelPinnedMessageResponse;
}

export async function listTrackReactions(channelId: string, trackId?: number) {
  const q = trackId ? `?track_id=${encodeURIComponent(String(trackId))}` : "";
  const res = await fetch(`${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/track-reactions${q}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load track reactions"));
  return (await res.json()) as { results: ChannelTrackReactionRow[] };
}

export async function addTrackReaction(channelId: string, payload: { track_id: number; emoji: string }) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/track-reactions`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot add track reaction"));
  return (await res.json()) as ChannelTrackReactionRow;
}

export async function listPlaybackHistory(channelId: string, limit = 60) {
  const res = await fetch(`${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/history?limit=${encodeURIComponent(String(limit))}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load playback history"));
  return (await res.json()) as { results: PlaybackHistoryRow[] };
}

export async function listChannelAuditLog(channelId: string, limit = 80) {
  const res = await fetch(`${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/audit-log?limit=${encodeURIComponent(String(limit))}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load audit log"));
  return (await res.json()) as { results: ChannelAuditLogRow[] };
}

export function getAuditLogExportUrl(channelId: string) {
  return `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/audit-log/export`;
}

export async function listChannelSuggestions(channelId: string, status?: ChannelPlaylistSuggestion["status"]) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await fetch(`${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/suggestions${q}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load suggestions"));
  return (await res.json()) as { results: ChannelPlaylistSuggestion[] };
}

export async function createChannelSuggestion(
  channelId: string,
  payload: { track_id?: number; external_url?: string; external_title?: string; external_artist?: string; note?: string },
) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/suggestions`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot create suggestion"));
  return (await res.json()) as ChannelPlaylistSuggestion;
}

export async function reviewChannelSuggestion(channelId: string, payload: { suggestion_id: number; action: "approve" | "reject" }) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/suggestions`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot review suggestion"));
  return (await res.json()) as ChannelPlaylistSuggestion;
}

export async function getChannelNotificationSettings(channelId: string) {
  const res = await fetch(`${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/notification-settings`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load channel notification settings"));
  return (await res.json()) as ChannelNotificationPreference;
}

export async function updateChannelNotificationSettings(channelId: string, patch: Partial<ChannelNotificationPreference>) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/notification-settings`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(patch) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update channel notification settings"));
  return (await res.json()) as ChannelNotificationPreference;
}

export async function getChannelMembers(channelId: string) {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/members`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load channel members"));
  return (await res.json()) as { results: ChannelMember[] };
}

export async function updateChannelMemberRole(channelId: string, memberId: number, role: ChannelMember["role"]) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${channelId}/members/${memberId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify({ role }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update member role"));
}

export async function removeChannelMember(channelId: string, memberId: number) {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/members/${memberId}`, await withAuthHeaders({ method: "DELETE" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot remove member"));
}

export async function leaveChannel(channelId: string) {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/leave`, await withAuthHeaders({ method: "POST" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot leave channel"));
}

export async function closeChannel(channelId: string) {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/close`, await withAuthHeaders({ method: "POST" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot close channel"));
}

export async function reopenChannel(channelId: string) {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/reopen`, await withAuthHeaders({ method: "POST" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot reopen channel"));
}

/** Deletes the channel permanently. Server allows only the channel owner. */
export async function deleteChannel(channelId: string) {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/`, await withAuthHeaders({ method: "DELETE" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot delete channel"));
}

export async function listChannels() {
  const res = await fetch(`${getApiBase()}/api/channels/`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load channels");
  return (await res.json()) as ChannelSummary[];
}

export async function createChannel(payload: {
  name: string;
  description?: string;
  privacy: "public" | "private" | "unlisted";
  member_limit?: number;
}) {
  const res = await fetch(`${getApiBase()}/api/channels/`, await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot create channel"));
  return (await res.json()) as ChannelSummary;
}

export async function playPlaylistInChannel(channelId: string, playlistId: number, startIndex = 0) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${channelId}/playlists/${playlistId}/play`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({ start_index: startIndex }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot play playlist in channel"));
  return res.json();
}

export async function playTrackInChannel(channelId: string, trackId: number) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${channelId}/tracks/${trackId}/play`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({}) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot play track on channel"));
  return res.json() as Promise<{ playback: unknown; queue: QueueItemSummary[] }>;
}

export async function shufflePlayInChannel(channelId: string, payload?: { limit?: number }) {
  const body =
    payload?.limit != null && Number.isFinite(payload.limit) && payload.limit > 0
      ? { limit: payload.limit }
      : {};
  const res = await fetch(
    `${getApiBase()}/api/channels/${channelId}/playlists/shuffle`,
    await withAuthHeaders({
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot start shuffle playback"));
  return res.json() as Promise<{ playback: unknown; queue: QueueItemSummary[] }>;
}

export async function listChannelQueue(channelId: string) {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/queue`, { credentials: "include", cache: "no-store" });
  rejectIfChannelClosed(res);
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load channel queue"));
  return (await res.json()) as { results: QueueItemSummary[] };
}

export async function reorderChannelQueueItem(channelId: string, itemId: number, position: number) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${channelId}/queue/${itemId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify({ position }) }),
  );
  rejectIfChannelClosed(res);
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot reorder queue item"));
}

export async function removeChannelQueueItem(channelId: string, itemId: number) {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/queue/${itemId}`, await withAuthHeaders({ method: "DELETE" }));
  rejectIfChannelClosed(res);
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot remove queue item"));
}

export async function jumpToChannelQueueItem(channelId: string, itemId: number) {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/queue/${itemId}/jump`, await withAuthHeaders({ method: "POST", body: JSON.stringify({}) }));
  rejectIfChannelClosed(res);
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot jump queue item"));
}

export async function upvoteChannelQueueItem(channelId: string, itemId: number) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/queue/${itemId}/upvote`,
    await withAuthHeaders({ method: "POST", body: "{}" }),
  );
  rejectIfChannelClosed(res);
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot upvote"));
}

export async function removeQueueUpvote(channelId: string, itemId: number) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/queue/${itemId}/upvote`,
    await withAuthHeaders({ method: "DELETE" }),
  );
  rejectIfChannelClosed(res);
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot remove upvote"));
}

export async function reportChatMessage(channelId: string, messageId: number, reason?: string) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/chat/report`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({ message_id: messageId, reason: reason ?? "" }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot report message"));
  return (await res.json()) as { id: number; status: string };
}

export async function listModerationReports(channelId: string) {
  const res = await fetch(`${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/moderation/reports`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load reports"));
  return (await res.json()) as {
    results: Array<{
      id: number;
      message_id: number;
      message_body: string;
      message_username: string;
      reporter_username: string;
      reason: string;
      created_at: string;
    }>;
  };
}

export async function dismissModerationReport(channelId: string, reportId: number) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/moderation/reports`,
    await withAuthHeaders({
      method: "PATCH",
      body: JSON.stringify({ report_id: reportId, status: "dismissed" }),
    }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot dismiss report"));
  return (await res.json()) as { id: number; status: string };
}

export async function banChannelMember(channelId: string, userId: number, hours: number, reason?: string) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/moderation/bans/${userId}`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({ hours, reason: reason ?? "" }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot ban member"));
  return (await res.json()) as { user_id: number; banned_until: string };
}

export async function unbanChannelMember(channelId: string, userId: number) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/moderation/bans/${userId}`,
    await withAuthHeaders({ method: "DELETE" }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot unban member"));
}

export async function getPartyRecap(channelId: string) {
  const res = await fetch(`${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/party-recap`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load party recap"));
  return (await res.json()) as PartyRecap;
}

export async function getMeChannelsOnline() {
  const res = await fetch(`${getApiBase()}/api/me/channels-online`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load online channels"));
  return (await res.json()) as { total_online: number; results: ChannelsOnlineRow[] };
}

export async function getMeChannelsPendingSuggestions() {
  const res = await fetch(`${getApiBase()}/api/me/channels-pending-suggestions`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load pending suggestions"));
  return (await res.json()) as { results: Array<{ channel_id: number; pending_count: number }> };
}

export async function importShareToChannelQueue(channelId: string, shareToken: string) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/queue/import-share`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({ share_token: shareToken }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Queue import failed"));
  return (await res.json()) as { added: number; results: QueueItemSummary[] };
}

export async function exportChannelSessionPlaylist(channelId: string, name?: string, saveToChannel = true) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/session/export-playlist`,
    await withAuthHeaders({
      method: "POST",
      body: JSON.stringify({ name, save_to_channel: saveToChannel }),
    }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Export failed"));
  return (await res.json()) as { playlist: PlaylistSummary };
}

/** Short QR for private invites — denser modules than `/join?link=…` (easier for phone cameras). */
export function buildPrivateInviteJoinUrl(inviteToken: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : getApiBase();
  const t = String(inviteToken).trim();
  return `${origin}/join/private/${encodeURIComponent(t)}`;
}

/** Public room link — uses custom slug when set, otherwise UUID `public_slug`. */
export function buildPublicJoinUrl(publicSlug: string, publicJoinSlug?: string | null): string {
  const origin = typeof window !== "undefined" ? window.location.origin : getApiBase();
  const seg = (publicJoinSlug && String(publicJoinSlug).trim()) || String(publicSlug);
  return `${origin}/join/public/${encodeURIComponent(seg)}`;
}

/** Private / slug invites: one query `link` = path such as `/join/private/…` or `/join/public/…`. */
export function buildJoinLandingUrl(joinPathOrUrl: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : getApiBase();
  const trimmed = joinPathOrUrl.trim();
  let pathOnly = trimmed;
  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const u = new URL(trimmed);
      pathOnly = `${u.pathname}${u.search}`;
    } else if (!trimmed.startsWith("/")) {
      pathOnly = `/${trimmed}`;
    }
  } catch {
    pathOnly = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }
  return `${origin}/join?link=${encodeURIComponent(pathOnly)}`;
}
