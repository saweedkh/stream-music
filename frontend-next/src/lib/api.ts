/**
 * In the browser we always use the page origin (e.g. http://192.168.x.x:8080 on a phone on LAN).
 * For local `npm run dev` against a remote prod stack, set DEV_REMOTE_ORIGIN in `.env.local`;
 * Next.js rewrites proxy /api, /ws, and /audio to that host while the browser stays on localhost.
 * On the server (RSC) we call Django via INTERNAL_* or DEV_REMOTE_ORIGIN.
 */
function devRemoteOrigin(): string | undefined {
  const raw = process.env.DEV_REMOTE_ORIGIN?.replace(/\/$/, "");
  return raw || undefined;
}

export function getApiBase(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return (
    process.env.INTERNAL_API_BASE_URL ||
    devRemoteOrigin() ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8000"
  );
}

/** WebSocket must use the same host as the page so the dev proxy can upgrade /ws/ behind :3000. */
export function getWsBase(): string {
  if (typeof window !== "undefined") {
    return window.location.protocol === "https:" ? `wss://${window.location.host}` : `ws://${window.location.host}`;
  }
  if (process.env.INTERNAL_WS_BASE_URL) return process.env.INTERNAL_WS_BASE_URL;
  const remote = devRemoteOrigin();
  if (remote) return remote.replace(/^http/i, "ws");
  return process.env.NEXT_PUBLIC_WS_BASE_URL || "ws://localhost:8000";
}

let csrfReady = false;

export type UserBadge = {
  slug: string;
  label: string;
  description?: string;
  icon: string;
  color: string;
  priority: number;
  is_system?: boolean;
};

export type UserBadgeFlags = {
  is_staff?: boolean;
  is_superuser?: boolean;
  is_premium?: boolean;
  badges?: UserBadge[];
};

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_superuser?: boolean;
  is_premium?: boolean;
  badges?: UserBadge[];
  bio?: string;
  is_public?: boolean;
  /** ISO datetime from Django `User.date_joined`. */
  date_joined?: string;
};

export type UserNotificationSettings = {
  chat_notify: "muted" | "mentions" | "all";
  admin_notify_reactions: boolean;
  admin_notify_votes: boolean;
  push_quiet_hours_start?: number | null;
  push_quiet_hours_end?: number | null;
  push_category_playback?: boolean;
  push_category_chat?: boolean;
  push_category_moderation?: boolean;
  updated_at: string;
};

export type MeBootstrap = {
  user: AuthUser;
  notification_settings?: UserNotificationSettings;
  webpush?: { vapid_public_key: string };
};

export type PlaybackState = {
  started_at_server_time: number | null;
  paused_at_position: number | null;
  is_playing: boolean;
  queue_version?: number;
  track?: { file?: string | null; title?: string | null } | null;
};

/** Room experience flags (stored on `Channel.experience` JSON). */
export type ChannelExperienceSettings = {
  accent?: string;
  rehearsal_mode?: boolean;
  rehearsal_lift_until?: string | null;
  queue_locked?: boolean;
  blind_playlist_id?: number | null;
  intro_preview_seconds?: number;
  veto_skip_threshold?: number;
  anti_repeat_window?: number;
  weighted_shuffle_bias?: number;
  suggestions_enabled?: boolean;
  dj_rotation_enabled?: boolean;
  dj_rotation_every_n?: number;
  current_dj_user_id?: number | null;
  listening_party_only?: boolean;
  radio_mode?: boolean;
  scheduled_start_at?: string | null;
  queue_end_mode?: "loop" | "stop" | "repeat_one";
  room_rules?: string;
};

export type ChannelStateResponse = {
  channel: {
    id: number;
    name: string;
    owner?: number;
    privacy?: string;
    description?: string;
    member_limit?: number;
    public_slug?: string;
    public_join_slug?: string | null;
    join_requires_approval?: boolean;
    is_active?: boolean;
    membership_is_active?: boolean | null;
    experience?: ChannelExperienceSettings | Record<string, unknown> | null;
    brand_logo_url?: string | null;
  };
  playback: PlaybackState;
};
export type ChannelSummary = {
  id: number;
  name: string;
  description: string;
  privacy: "public" | "private" | "unlisted";
  owner?: number;
  member_limit?: number;
  is_playing?: boolean;
  join_requires_approval?: boolean;
  is_active?: boolean;
  /** False after leaving the room; user can reopen / reconnect via join. */
  membership_is_active?: boolean | null;
};

/** Thrown when GET /channels/:id/state returns 410 (room closed for non-owners). */
export class ChannelClosedError extends Error {
  constructor() {
    super("channel_closed");
    this.name = "ChannelClosedError";
  }
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

export type JoinRequestRow = {
  id: number;
  channel: number;
  user: number;
  username: string;
  status: string;
  created_at: string;
};

export type JoinChannelOutcome =
  | { status: "joined"; channel: number; raw: Record<string, unknown> }
  | { status: "pending"; channel: number; request_id?: number };
export type TrackSummary = {
  id: number;
  title: string;
  artist: string;
  album: string;
  file: string;
  visibility: "private" | "shared_with_users" | "shared_with_channels" | "public_lan";
  is_favorited?: boolean;
};
export type PlaylistSummary = {
  id: number;
  name: string;
  channel: number | null;
  is_auto_generated: boolean;
  is_favorited?: boolean;
};

export type PaginatedTracks = {
  results: TrackSummary[];
  total: number;
  offset: number;
  limit: number;
};

export function normalizeTrackList(data: TrackSummary[] | PaginatedTracks): TrackSummary[] {
  return Array.isArray(data) ? data : data.results;
}
export type PlaylistItemSummary = {
  id: number;
  playlist: number;
  track: number;
  track_detail?: TrackSummary;
  position: number;
};
export type QueueItemSummary = {
  id: number;
  channel: number;
  track: number;
  track_detail?: TrackSummary;
  position: number;
  added_by: number | null;
  added_by_username?: string | null;
  created_at: string;
  upvote_count?: number;
  user_upvoted?: boolean;
};
export type TrackSharePermission = {
  id: number;
  track: number;
  user: number | null;
  channel: number | null;
  username?: string;
  channel_name?: string;
};

export type ChannelControlAction = "play" | "pause" | "seek" | "next" | "prev";

function rejectIfChannelClosed(res: Response): void {
  if (res.status === 410) throw new ChannelClosedError();
}

async function extractApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string; max?: number } | Record<string, unknown>;
    if (typeof (body as { detail?: string })?.detail === "string") {
      const detail = (body as { detail: string }).detail;
      const { localizeMessage, localizeMessageWithVars } = await import("@/lib/i18n/localize-message");
      if (detail === "too_many_tracks" && typeof (body as { max?: number }).max === "number") {
        return localizeMessageWithVars(detail, { max: (body as { max: number }).max });
      }
      return localizeMessage(detail);
    }
    if (body && typeof body === "object") {
      const firstEntry = Object.entries(body)[0];
      if (firstEntry) {
        const [field, value] = firstEntry;
        if (Array.isArray(value) && typeof value[0] === "string") {
          return `${field}: ${value[0]}`;
        }
        if (typeof value === "string") {
          return `${field}: ${value}`;
        }
      }
    }
  } catch {
    // ignore parse issues and use fallback
  }
  return fallback;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split("=")[1]) : null;
}

export async function ensureCsrfCookie() {
  if (csrfReady && readCookie("csrftoken")) return;
  await fetch(`${getApiBase()}/api/auth/csrf`, { credentials: "include" });
  csrfReady = true;
}

async function withAuthHeaders(init: RequestInit = {}): Promise<RequestInit> {
  await ensureCsrfCookie();
  const csrfToken = readCookie("csrftoken");
  return {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken ?? "",
      ...(init.headers ?? {}),
    },
  };
}

async function withAuthFormData(init: RequestInit = {}): Promise<RequestInit> {
  await ensureCsrfCookie();
  const csrfToken = readCookie("csrftoken");
  return {
    ...init,
    credentials: "include",
    headers: {
      "X-CSRFToken": csrfToken ?? "",
      ...(init.headers ?? {}),
    },
  };
}

export type GetChannelStateOptions = {
  /**
   * Required for server-side (RSC) calls: the browser never attaches cookies to fetches
   * from Next.js to INTERNAL_API_BASE_URL, so forward the incoming `Cookie` header.
   */
  cookieHeader?: string | null;
};

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

export async function getServerTime() {
  const t0 = Date.now();
  const res = await fetch(`${getApiBase()}/api/time`, { cache: "no-store" });
  const t1 = Date.now();
  const body = await res.json();
  const latency = (t1 - t0) / 2;
  const offset = body.time * 1000 - (t0 + latency);
  return { serverTime: body.time, offset };
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

export async function loginUser(username: string, password: string) {
  const res = await fetch(`${getApiBase()}/api/auth/login`, await withAuthHeaders({ method: "POST", body: JSON.stringify({ username, password }) }));
  if (!res.ok) throw new Error(await extractApiError(res, "Login failed"));
  return (await res.json()) as { user: AuthUser };
}

export async function registerUser(username: string, email: string, password: string) {
  const res = await fetch(
    `${getApiBase()}/api/auth/register`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({ username, email, password }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Register failed"));
  return (await res.json()) as { user: AuthUser };
}

export async function logoutUser() {
  const res = await fetch(`${getApiBase()}/api/auth/logout`, await withAuthHeaders({ method: "POST" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Logout failed"));
}

export async function getMe(): Promise<MeBootstrap | null> {
  const res = await fetch(`${getApiBase()}/api/auth/me`, { credentials: "include", cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as MeBootstrap;
}

export async function patchMeProfile(payload: {
  email?: string;
  first_name?: string;
  last_name?: string;
}): Promise<MeBootstrap> {
  const res = await fetch(
    `${getApiBase()}/api/auth/me`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update profile"));
  return (await res.json()) as MeBootstrap;
}

export async function postChangePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/api/auth/me/password`,
    await withAuthHeaders({
      method: "POST",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot change password"));
}

export async function checkApiHealth(): Promise<{ status: string; db: boolean; redis: boolean }> {
  const res = await fetch(`${getApiBase()}/api/health`, { cache: "no-store" });
  const data = (await res.json()) as { status: string; db: boolean; redis: boolean };
  return data;
}

export async function sendPushTest(): Promise<void> {
  const res = await fetch(`${getApiBase()}/api/auth/me/push-test`, await withAuthHeaders({ method: "POST", body: "{}" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Push test failed"));
}

export async function patchNotificationSettings(payload: Partial<UserNotificationSettings>): Promise<UserNotificationSettings> {
  const res = await fetch(
    `${getApiBase()}/api/auth/me/notification-settings`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot save notification settings"));
  return (await res.json()) as UserNotificationSettings;
}

export async function registerWebPushSubscription(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/api/auth/me/push-subscription`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(subscription) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot register push subscription"));
}

export async function deleteWebPushSubscriptions(endpoint?: string): Promise<void> {
  const res = await fetch(
    `${getApiBase()}/api/auth/me/push-subscription`,
    await withAuthHeaders({
      method: "DELETE",
      body: endpoint ? JSON.stringify({ endpoint }) : JSON.stringify({}),
    }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot remove push subscription"));
}

export type ChannelMember = {
  id: number;
  user_id: number;
  username: string;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_premium?: boolean;
  badges?: UserBadge[];
  role: "owner" | "moderator" | "member";
  is_active: boolean;
  joined_at: string;
};

export type AdminOverview = {
  users: { total: number; active: number; staff: number; superuser: number };
  channels: { total: number; active: number; playing: number };
  tracks_total: number;
  playlists_total: number;
  memberships_active: number;
};

export type AdminUserRow = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  is_superuser: boolean;
  is_premium?: boolean;
  badges?: UserBadge[];
  date_joined: string | null;
  last_login: string | null;
};

export type AdminBadgeDefinition = UserBadge & {
  id: number;
  description: string;
  is_active: boolean;
  is_system?: boolean;
};

export type AdminChannelRow = {
  id: number;
  name: string;
  privacy: string;
  owner_id: number;
  owner_username: string | null;
  is_active: boolean;
  member_count: number;
  is_playing: boolean;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const res = await fetch(`${getApiBase()}/api/admin/overview`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load admin overview"));
  return (await res.json()) as AdminOverview;
}

export async function listAdminUsers(options?: { search?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (options?.search?.trim()) params.set("search", options.search.trim());
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const qs = params.toString();
  const res = await fetch(`${getApiBase()}/api/admin/users${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load users"));
  return (await res.json()) as { results: AdminUserRow[]; total: number; offset: number; limit: number };
}

export async function patchAdminUser(
  userId: number,
  payload: Partial<Pick<AdminUserRow, "is_active" | "is_staff" | "is_superuser">> & { badge_slugs?: string[] },
) {
  const res = await fetch(
    `${getApiBase()}/api/admin/users/${userId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update user"));
  return (await res.json()) as AdminUserRow;
}

export async function listAdminBadges() {
  const res = await fetch(`${getApiBase()}/api/admin/badges`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load badges"));
  return (await res.json()) as { results: AdminBadgeDefinition[] };
}

export async function createAdminBadge(payload: {
  slug: string;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
  priority?: number;
  is_active?: boolean;
}) {
  const res = await fetch(
    `${getApiBase()}/api/admin/badges`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot create badge"));
  return (await res.json()) as AdminBadgeDefinition;
}

export async function patchAdminBadge(
  badgeId: number,
  payload: Partial<Pick<AdminBadgeDefinition, "label" | "description" | "icon" | "color" | "priority" | "is_active">>,
) {
  const res = await fetch(
    `${getApiBase()}/api/admin/badges/${badgeId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update badge"));
  return (await res.json()) as AdminBadgeDefinition;
}

export async function deleteAdminBadge(badgeId: number) {
  const res = await fetch(
    `${getApiBase()}/api/admin/badges/${badgeId}`,
    await withAuthHeaders({ method: "DELETE" }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot delete badge"));
}

export async function listAdminChannels(options?: { search?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (options?.search?.trim()) params.set("search", options.search.trim());
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const qs = params.toString();
  const res = await fetch(`${getApiBase()}/api/admin/channels${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load channels"));
  return (await res.json()) as { results: AdminChannelRow[]; total: number; offset: number; limit: number };
}

export async function getAdminHealth() {
  const res = await fetch(`${getApiBase()}/api/admin/health`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load health"));
  return (await res.json()) as { status: string; db: boolean; redis: boolean };
}

export type SupportTicketStatus =
  | "open"
  | "in_progress"
  | "waiting_user"
  | "waiting_staff"
  | "resolved"
  | "closed";

export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";

export type SupportTicketRow = {
  id: number;
  reference: string;
  subject: string;
  category: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  assigned_to_id: number | null;
  assigned_to_username: string | null;
  requester_id?: number;
  requester_username?: string;
  requester?: { id: number; username: string; badges?: UserBadge[]; is_staff?: boolean; is_superuser?: boolean };
  created_at: string | null;
  updated_at: string | null;
  closed_at: string | null;
  last_message_at: string | null;
  last_message_preview: string;
  unread_count: number;
  is_mine?: boolean;
};

export type SupportMessageRow = {
  id: number;
  ticket_id: number;
  author_id: number;
  author: { id: number; username: string; badges?: UserBadge[]; is_staff?: boolean; is_superuser?: boolean };
  body: string;
  is_internal: boolean;
  is_mine: boolean;
  created_at: string | null;
  edited_at?: string | null;
};

export type SupportInboxStats = {
  open: number;
  in_progress: number;
  waiting_staff: number;
  waiting_user: number;
  total_active: number;
};

export async function getSupportCategories() {
  const res = await fetch(`${getApiBase()}/api/support/categories`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load categories"));
  return (await res.json()) as { categories: Array<{ id: string; label: string }> };
}

export async function listSupportTickets(options?: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.search?.trim()) params.set("search", options.search.trim());
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const qs = params.toString();
  const res = await fetch(`${getApiBase()}/api/support/tickets${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load tickets"));
  return (await res.json()) as {
    results: SupportTicketRow[];
    total: number;
    offset: number;
    limit: number;
    stats?: SupportInboxStats;
  };
}

export async function createSupportTicket(payload: {
  subject: string;
  category: string;
  body: string;
  priority?: SupportTicketPriority;
}) {
  const res = await fetch(
    `${getApiBase()}/api/support/tickets`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot create ticket"));
  return (await res.json()) as { ticket: SupportTicketRow; message: SupportMessageRow };
}

export async function getSupportTicket(ticketId: number) {
  const res = await fetch(`${getApiBase()}/api/support/tickets/${ticketId}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load ticket"));
  return (await res.json()) as { ticket: SupportTicketRow };
}

export async function patchSupportTicket(
  ticketId: number,
  payload: Partial<{
    status: SupportTicketStatus;
    priority: SupportTicketPriority;
    assigned_to_id: number | null;
    category: string;
  }>,
) {
  const res = await fetch(
    `${getApiBase()}/api/support/tickets/${ticketId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update ticket"));
  return (await res.json()) as { ticket: SupportTicketRow };
}

export async function listSupportTicketMessages(ticketId: number, options?: { limit?: number; before?: number }) {
  const params = new URLSearchParams();
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.before != null) params.set("before", String(options.before));
  const qs = params.toString();
  const res = await fetch(`${getApiBase()}/api/support/tickets/${ticketId}/messages${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load messages"));
  return (await res.json()) as { messages: SupportMessageRow[] };
}

export async function postSupportTicketMessage(
  ticketId: number,
  payload: { body: string; is_internal?: boolean },
) {
  const res = await fetch(
    `${getApiBase()}/api/support/tickets/${ticketId}/messages`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot send message"));
  return (await res.json()) as { message: SupportMessageRow; ticket: SupportTicketRow };
}

export async function listSupportStaffUsers() {
  const res = await fetch(`${getApiBase()}/api/support/staff-users`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load staff"));
  return (await res.json()) as { results: Array<{ id: number; username: string }> };
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
  return res.json() as Promise<{ brand_logo_url?: string | null }>;
}

export async function getSimilarTracks(channelId: string, fromTrackId: number) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/tracks/similar?from_track=${encodeURIComponent(String(fromTrackId))}`,
    { credentials: "include", cache: "no-store" },
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load similar tracks"));
  return (await res.json()) as { results: TrackSummary[] };
}

export type ChannelChatReaction = {
  user_id: number;
  username: string;
  emoji: string;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_premium?: boolean;
  badges?: UserBadge[];
};

export type ChannelChatMessageRow = {
  id: number;
  channel: number;
  user_id: number;
  username: string;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_premium?: boolean;
  badges?: UserBadge[];
  body: string;
  is_pinned?: boolean;
  pinned_at?: string | null;
  pinned_by_username?: string | null;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  reactions?: ChannelChatReaction[];
};

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

export type ChannelPinnedMessageResponse = { message: ChannelChatMessageRow | null };

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

export type ChannelTrackReactionRow = {
  id: number;
  channel: number;
  track: number;
  user: number;
  username: string;
  emoji: string;
  created_at: string;
};

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

export type PlaybackHistoryRow = {
  id: number;
  channel: number;
  actor?: number | null;
  actor_username?: string;
  track?: number | null;
  track_title?: string;
  event_type: string;
  source?: string;
  payload?: Record<string, unknown>;
  emitted_at: string;
};

export async function listPlaybackHistory(channelId: string, limit = 60) {
  const res = await fetch(`${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/history?limit=${encodeURIComponent(String(limit))}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load playback history"));
  return (await res.json()) as { results: PlaybackHistoryRow[] };
}

export type ChannelAuditLogRow = {
  id: number;
  channel: number;
  actor?: number | null;
  actor_username?: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export async function listChannelAuditLog(channelId: string, limit = 80) {
  const res = await fetch(`${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/audit-log?limit=${encodeURIComponent(String(limit))}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load audit log"));
  return (await res.json()) as { results: ChannelAuditLogRow[] };
}

export type ChannelPlaylistSuggestion = {
  id: number;
  channel: number;
  track: number;
  track_title?: string;
  user: number;
  username?: string;
  status: "pending" | "approved" | "rejected";
  note?: string;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: number | null;
};

export async function listChannelSuggestions(channelId: string, status?: ChannelPlaylistSuggestion["status"]) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await fetch(`${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/suggestions${q}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load suggestions"));
  return (await res.json()) as { results: ChannelPlaylistSuggestion[] };
}

export async function createChannelSuggestion(channelId: string, payload: { track_id: number; note?: string }) {
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

export type ChannelNotificationPreference = {
  muted: boolean;
  notify_room_started: boolean;
  notify_queue_turn: boolean;
  notify_skip_threshold: boolean;
  notify_moderation: boolean;
  updated_at: string;
};

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

export async function listTracks(options?: {
  search?: string;
  genre?: string;
  album?: string;
  tag?: string;
  limit?: number;
  offset?: number;
  favorited?: boolean;
}): Promise<TrackSummary[] | PaginatedTracks> {
  const params = new URLSearchParams();
  const q = (options?.search ?? "").trim();
  if (q) params.set("search", q);
  if (options?.genre?.trim()) params.set("genre", options.genre.trim());
  if (options?.album?.trim()) params.set("album", options.album.trim());
  if (options?.tag?.trim()) params.set("tag", options.tag.trim());
  if (options?.limit != null && Number.isFinite(options.limit)) {
    params.set("limit", String(Math.floor(options.limit)));
  }
  if (options?.offset != null && Number.isFinite(options.offset)) {
    params.set("offset", String(Math.floor(options.offset)));
  }
  if (options?.favorited) params.set("favorited", "true");
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${getApiBase()}/api/tracks/${suffix}`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load tracks");
  const data = await res.json();
  if (Array.isArray(data)) return data as TrackSummary[];
  return data as PaginatedTracks;
}

export async function setTrackFavorite(trackId: number, favorited: boolean): Promise<{ is_favorited: boolean }> {
  const res = await fetch(
    `${getApiBase()}/api/tracks/${trackId}/favorite/`,
    await withAuthHeaders({ method: favorited ? "POST" : "DELETE", body: "{}" }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update favorite"));
  return (await res.json()) as { is_favorited: boolean };
}

const CHUNK_UPLOAD_THRESHOLD_BYTES = 2 * 1024 * 1024;
const CHUNK_UPLOAD_PART_SIZE = 4 * 1024 * 1024;

export async function getChunkUploadStatus(uploadId: string) {
  const res = await fetch(`${getApiBase()}/api/tracks/upload/${encodeURIComponent(uploadId)}/status`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot read upload status"));
  return (await res.json()) as {
    upload_id: string;
    written: number;
    size: number;
    filename?: string;
    title?: string;
    visibility?: string;
  };
}

export async function uploadTrackChunked(
  payload: {
    title: string;
    artist?: string;
    album?: string;
    genre?: string;
    tags?: string[];
    visibility: TrackSummary["visibility"];
    file: File;
  },
  options?: {
    onProgress?: (percent: number) => void;
    resumeUploadId?: string;
    startOffset?: number;
    onCheckpoint?: (info: { uploadId: string; written: number }) => void;
  },
): Promise<TrackSummary> {
  const { file } = payload;
  if (file.size <= CHUNK_UPLOAD_THRESHOLD_BYTES) {
    return uploadTrack(payload, options);
  }
  await ensureCsrfCookie();
  const csrfToken = readCookie("csrftoken") ?? "";
  let upload_id = options?.resumeUploadId ?? "";
  let uploaded = options?.startOffset ?? 0;

  if (upload_id) {
    try {
      const st = await getChunkUploadStatus(upload_id);
      uploaded = Math.min(file.size, st.written);
    } catch {
      upload_id = "";
      uploaded = 0;
    }
  }

  if (!upload_id) {
    const initRes = await fetch(`${getApiBase()}/api/tracks/upload/init`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify({
        filename: file.name,
        size: file.size,
        title: payload.title,
        artist: payload.artist ?? "",
        album: payload.album ?? "",
        genre: payload.genre ?? "",
        tags: payload.tags ?? [],
        visibility: payload.visibility,
      }),
    });
    if (!initRes.ok) throw new Error(await extractApiError(initRes, "Cannot start upload"));
    const initBody = (await initRes.json()) as { upload_id: string; written?: number };
    upload_id = initBody.upload_id;
    uploaded = initBody.written ?? 0;
    options?.onCheckpoint?.({ uploadId: upload_id, written: uploaded });
  }

  while (uploaded < file.size) {
    const end = Math.min(uploaded + CHUNK_UPLOAD_PART_SIZE, file.size);
    const slice = file.slice(uploaded, end);
    const buf = await slice.arrayBuffer();
    const putRes = await fetch(`${getApiBase()}/api/tracks/upload/${upload_id}/chunk`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "X-CSRFToken": csrfToken,
        "Content-Type": "application/octet-stream",
      },
      body: buf,
    });
    if (!putRes.ok) throw new Error(await extractApiError(putRes, "Chunk upload failed"));
    const body = (await putRes.json()) as { written: number };
    uploaded = body.written;
    options?.onCheckpoint?.({ uploadId: upload_id, written: uploaded });
    options?.onProgress?.(Math.min(99, Math.round((uploaded / file.size) * 100)));
  }

  const finRes = await fetch(`${getApiBase()}/api/tracks/upload/${upload_id}/finalize`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
  });
  if (!finRes.ok) throw new Error(await extractApiError(finRes, "Cannot finalize upload"));
  options?.onProgress?.(100);
  const track = (await finRes.json()) as TrackSummary;
  return track;
}

export async function getPartyRecap(channelId: string) {
  const res = await fetch(`${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/party-recap`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load party recap"));
  return (await res.json()) as {
    channel_id: number;
    channel_name: string;
    description: string;
    total_events: number;
    top_tracks: Array<{ id: number; title: string; artist: string; play_count: number }>;
    timeline: Array<{ track_id: number | null; title: string | null; event_type: string; at: string }>;
  };
}

export async function getApiMetrics() {
  const res = await fetch(`${getApiBase()}/api/metrics`, { cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load metrics");
  return (await res.json()) as {
    server_time: number;
    channels_active: number;
    channels_playing: number;
    memberships_active: number;
    tracks_total: number;
    users_active: number;
  };
}

export async function uploadTrack(
  payload: { title: string; artist?: string; album?: string; visibility: TrackSummary["visibility"]; file: File },
  options?: { onProgress?: (percent: number) => void; timeoutMs?: number },
) {
  const formData = new FormData();
  formData.append("title", payload.title);
  formData.append("artist", payload.artist ?? "");
  formData.append("album", payload.album ?? "");
  formData.append("visibility", payload.visibility);
  formData.append("file", payload.file);
  await ensureCsrfCookie();
  const csrfToken = readCookie("csrftoken") ?? "";

  return await new Promise<TrackSummary>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${getApiBase()}/api/tracks/`);
    xhr.withCredentials = true;
    xhr.timeout = options?.timeoutMs ?? 1000 * 60 * 20;
    xhr.setRequestHeader("X-CSRFToken", csrfToken);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !options?.onProgress) return;
      options.onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as TrackSummary);
        } catch {
          reject(new Error("Upload succeeded but response parsing failed"));
        }
        return;
      }
      let message = "Cannot upload track";
      try {
        const body = JSON.parse(xhr.responseText) as { detail?: string } | Record<string, unknown>;
        if (typeof (body as { detail?: string }).detail === "string") {
          message = (body as { detail: string }).detail;
        }
      } catch {
        // keep fallback message
      }
      reject(new Error(message));
    };

    xhr.onerror = () => reject(new Error("Network error while uploading track"));
    xhr.ontimeout = () => reject(new Error("Upload timeout. Please retry with a stable connection."));
    xhr.send(formData);
  });
}

export async function listPlaylists(channelId?: string, options?: { favorited?: boolean }) {
  const params = new URLSearchParams();
  if (channelId != null && channelId !== "") params.set("channel", channelId);
  if (options?.favorited) params.set("favorited", "true");
  const qs = params.toString();
  const url = `${getApiBase()}/api/playlists/${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load playlists");
  return (await res.json()) as PlaylistSummary[];
}

export async function setPlaylistFavorite(playlistId: number, favorited: boolean): Promise<{ is_favorited: boolean }> {
  const res = await fetch(
    `${getApiBase()}/api/playlists/${playlistId}/favorite/`,
    await withAuthHeaders({ method: favorited ? "POST" : "DELETE", body: "{}" }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update favorite"));
  return (await res.json()) as { is_favorited: boolean };
}

export async function createPlaylist(payload: { name: string; channel?: number | null }) {
  const res = await fetch(
    `${getApiBase()}/api/playlists/`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({ name: payload.name, channel: payload.channel ?? null }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot create playlist"));
  return (await res.json()) as PlaylistSummary;
}

export async function listPlaylistItems(playlistId?: number) {
  let url = `${getApiBase()}/api/playlist-items/`;
  if (playlistId != null && !Number.isNaN(playlistId)) {
    url += `?playlist=${playlistId}`;
  }
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load playlist items");
  return (await res.json()) as PlaylistItemSummary[];
}

export async function addPlaylistItem(payload: { playlist: number; track: number; position: number }) {
  const res = await fetch(`${getApiBase()}/api/playlist-items/`, await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }));
  if (!res.ok) throw new Error("Cannot add playlist item");
  return (await res.json()) as PlaylistItemSummary;
}

/** Server caps each request (see PLAYLIST_BULK_ADD_MAX); send smaller chunks for very large selections. */
export async function bulkAddTracksToPlaylist(playlistId: number, trackIds: number[]) {
  const res = await fetch(
    `${getApiBase()}/api/playlists/${playlistId}/add-tracks/`,
    await withAuthHeaders({
      method: "POST",
      body: JSON.stringify({ track_ids: trackIds }),
    }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot add tracks to playlist"));
  return (await res.json()) as { added: number; requested: number; skipped_not_allowed: number };
}

export async function reorderPlaylistItem(itemId: number, position: number) {
  const res = await fetch(
    `${getApiBase()}/api/playlist-items/${itemId}/`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify({ position }) }),
  );
  if (!res.ok) throw new Error("Cannot reorder playlist item");
  return (await res.json()) as PlaylistItemSummary;
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

export async function deletePlaylistItem(itemId: number) {
  const res = await fetch(`${getApiBase()}/api/playlist-items/${itemId}/`, await withAuthHeaders({ method: "DELETE" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot remove track from playlist"));
}

export async function deletePlaylist(playlistId: number) {
  const res = await fetch(`${getApiBase()}/api/playlists/${playlistId}/`, await withAuthHeaders({ method: "DELETE" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot delete playlist"));
}

export async function updatePlaylist(playlistId: number, payload: { name?: string; channel?: number | null }) {
  const res = await fetch(
    `${getApiBase()}/api/playlists/${playlistId}/`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update playlist"));
  return (await res.json()) as PlaylistSummary;
}

export async function deleteTrack(trackId: number) {
  const res = await fetch(`${getApiBase()}/api/tracks/${trackId}/`, await withAuthHeaders({ method: "DELETE" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot delete track"));
}

export async function updateTrack(
  trackId: number,
  payload: { title?: string; artist?: string; album?: string; visibility?: TrackSummary["visibility"] },
) {
  const res = await fetch(
    `${getApiBase()}/api/tracks/${trackId}/`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update track"));
  return (await res.json()) as TrackSummary;
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

export function getAuditLogExportUrl(channelId: string) {
  return `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/audit-log/export`;
}

export async function listUsers() {
  const res = await fetch(`${getApiBase()}/api/auth/users`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load users");
  return (await res.json()) as { results: Array<{ id: number; username: string }> };
}

export async function listTrackSharePermissions(trackId: number) {
  const res = await fetch(`${getApiBase()}/api/tracks/${trackId}/share-permissions`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load track share permissions");
  return (await res.json()) as { results: TrackSharePermission[] };
}

export async function addTrackSharePermission(trackId: number, payload: { user_id?: number; channel_id?: number }) {
  const res = await fetch(
    `${getApiBase()}/api/tracks/${trackId}/share-permissions`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error("Cannot add track share permission");
  return (await res.json()) as TrackSharePermission;
}

export async function removeTrackSharePermission(trackId: number, shareId: number) {
  const res = await fetch(
    `${getApiBase()}/api/tracks/${trackId}/share-permissions`,
    await withAuthHeaders({ method: "DELETE", body: JSON.stringify({ share_id: shareId }) }),
  );
  if (!res.ok) throw new Error("Cannot remove track share permission");
}

export type GlobalSearchResult = {
  tracks: TrackSummary[];
  playlists: PlaylistSummary[];
  channels: ChannelSummary[];
};

export async function globalSearch(q: string): Promise<GlobalSearchResult> {
  const params = new URLSearchParams({ q: q.trim() });
  const res = await fetch(`${getApiBase()}/api/search/global?${params}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Search failed");
  return (await res.json()) as GlobalSearchResult;
}

export type TrackFacets = { genres: string[]; albums: string[]; tags: string[] };

export async function getTrackFacets(): Promise<TrackFacets> {
  const res = await fetch(`${getApiBase()}/api/tracks/facets`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load facets");
  return (await res.json()) as TrackFacets;
}

export type PublicUserProfile = {
  user: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
    badges: UserBadge[];
    date_joined: string | null;
  };
  profile: { bio: string; is_public: boolean };
  public_channels: ChannelSummary[];
  following_count: number;
  is_self: boolean;
};

export async function getPublicUserProfile(username: string): Promise<PublicUserProfile> {
  const res = await fetch(`${getApiBase()}/api/users/${encodeURIComponent(username)}/profile`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Profile not found"));
  return (await res.json()) as PublicUserProfile;
}

export async function patchMePublicProfile(payload: { bio?: string; is_public?: boolean }) {
  const res = await fetch(
    `${getApiBase()}/api/auth/me/public-profile`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update profile"));
  return (await res.json()) as { bio: string; is_public: boolean };
}

export type PremiumLimits = {
  is_premium: boolean;
  owned_channels: number;
  max_owned_channels: number;
  max_member_limit: number;
  premium_queue_boost: boolean;
};

export async function getPremiumLimits(): Promise<PremiumLimits> {
  const res = await fetch(`${getApiBase()}/api/auth/me/premium-limits`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load limits");
  return (await res.json()) as PremiumLimits;
}

export type PlaylistShareLinkInfo = {
  active?: boolean;
  token?: string;
  share_url?: string;
  privacy?: string;
  expires_at?: string | null;
};

export async function getPlaylistShareLink(playlistId: number): Promise<PlaylistShareLinkInfo> {
  const res = await fetch(`${getApiBase()}/api/playlists/${playlistId}/share`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load share link");
  return (await res.json()) as PlaylistShareLinkInfo;
}

export async function createPlaylistShareLink(
  playlistId: number,
  payload?: { privacy?: string; expires_in_hours?: number },
): Promise<PlaylistShareLinkInfo & { token: string; share_url: string }> {
  const res = await fetch(
    `${getApiBase()}/api/playlists/${playlistId}/share`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(payload ?? {}) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot create share link"));
  return (await res.json()) as PlaylistShareLinkInfo & { token: string; share_url: string };
}

export async function previewPlaylistShare(token: string) {
  const res = await fetch(`${getApiBase()}/api/playlists/share/${token}`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Invalid share link"));
  return (await res.json()) as {
    playlist: PlaylistSummary;
    owner_username: string;
    items: PlaylistItemSummary[];
    item_count: number;
  };
}

export async function importPlaylistShareToChannel(channelId: string, shareToken: string, name?: string) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${encodeURIComponent(channelId)}/playlists/import-share`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({ share_token: shareToken, name }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Import failed"));
  return (await res.json()) as { playlist: PlaylistSummary };
}

export type ChannelFollowState = {
  following: boolean;
  notify_live: boolean;
  follower_count: number;
};

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
