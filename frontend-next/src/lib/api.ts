/**
 * In the browser we always use the page origin (e.g. http://192.168.x.x:8080 on a phone on LAN).
 * `NEXT_PUBLIC_*` pointing at localhost breaks mobile — never use hardcoded localhost for client fetches.
 * On the server (RSC) we call Django inside Docker via INTERNAL_API_BASE_URL.
 */
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return (
    process.env.INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"
  );
}

/** WebSocket must use the same host as the page so nginx can upgrade /ws/ behind :8080. */
export function getWsBase(): string {
  if (typeof window !== "undefined") {
    return window.location.protocol === "https:" ? `wss://${window.location.host}` : `ws://${window.location.host}`;
  }
  return process.env.INTERNAL_WS_BASE_URL || process.env.NEXT_PUBLIC_WS_BASE_URL || "ws://localhost:8000";
}

let csrfReady = false;

export type AuthUser = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
};

export type PlaybackState = {
  started_at_server_time: number | null;
  paused_at_position: number | null;
  is_playing: boolean;
  queue_version?: number;
  track?: { file?: string | null; title?: string | null } | null;
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
    join_requires_approval?: boolean;
    is_active?: boolean;
    membership_is_active?: boolean | null;
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

/** Shorter QR: `/join?channel=<id>` — no long URL on screen; works for public/unlisted (and server join rules). */
export function buildJoinUrlWithChannelId(channelId: string | number): string {
  const origin = typeof window !== "undefined" ? window.location.origin : getApiBase();
  return `${origin}/join?channel=${encodeURIComponent(String(channelId))}`;
}

/** Short QR for private invites — denser modules than `/join?link=…` (easier for phone cameras). */
export function buildPrivateInviteJoinUrl(inviteToken: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : getApiBase();
  const t = String(inviteToken).trim();
  return `${origin}/join/private/${encodeURIComponent(t)}`;
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
};
export type PlaylistSummary = {
  id: number;
  name: string;
  channel: number | null;
  is_auto_generated: boolean;
};
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
  position: number;
  added_by: number | null;
  created_at: string;
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

async function extractApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string } | Record<string, unknown>;
    if (typeof (body as { detail?: string })?.detail === "string") {
      return (body as { detail: string }).detail;
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

export async function getMe() {
  const res = await fetch(`${getApiBase()}/api/auth/me`, { credentials: "include", cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json()) as { user: AuthUser };
  return body.user;
}

export type ChannelMember = {
  id: number;
  user_id: number;
  username: string;
  role: "owner" | "moderator" | "member";
  is_active: boolean;
  joined_at: string;
};

export async function updateChannelSettings(
  channelId: string,
  payload: {
    name?: string;
    description?: string;
    privacy?: "public" | "private" | "unlisted";
    member_limit?: number;
    join_requires_approval?: boolean;
  },
) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${channelId}/settings`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update channel settings"));
  return res.json();
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

export async function listTracks() {
  const res = await fetch(`${getApiBase()}/api/tracks/`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load tracks");
  return (await res.json()) as TrackSummary[];
}

const CHUNK_UPLOAD_THRESHOLD_BYTES = 2 * 1024 * 1024;
const CHUNK_UPLOAD_PART_SIZE = 4 * 1024 * 1024;

export async function uploadTrackChunked(
  payload: { title: string; artist?: string; album?: string; visibility: TrackSummary["visibility"]; file: File },
  options?: { onProgress?: (percent: number) => void },
): Promise<TrackSummary> {
  const { file } = payload;
  if (file.size <= CHUNK_UPLOAD_THRESHOLD_BYTES) {
    return uploadTrack(payload, options);
  }
  await ensureCsrfCookie();
  const csrfToken = readCookie("csrftoken") ?? "";
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
      visibility: payload.visibility,
    }),
  });
  if (!initRes.ok) throw new Error(await extractApiError(initRes, "Cannot start upload"));
  const { upload_id } = (await initRes.json()) as { upload_id: string };

  let uploaded = 0;
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
  return (await finRes.json()) as TrackSummary;
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

export async function listPlaylists(channelId?: string) {
  let url = `${getApiBase()}/api/playlists/`;
  if (channelId != null && channelId !== "") {
    url += `?channel=${encodeURIComponent(channelId)}`;
  }
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load playlists");
  return (await res.json()) as PlaylistSummary[];
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

export async function reorderPlaylistItem(itemId: number, position: number) {
  const res = await fetch(
    `${getApiBase()}/api/playlist-items/${itemId}/`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify({ position }) }),
  );
  if (!res.ok) throw new Error("Cannot reorder playlist item");
  return (await res.json()) as PlaylistItemSummary;
}

export async function playPlaylistInChannel(channelId: string, playlistId: number) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${channelId}/playlists/${playlistId}/play`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({}) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot play playlist in channel"));
  return res.json();
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

export async function listChannelQueue(channelId: string) {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/queue`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load channel queue"));
  return (await res.json()) as { results: QueueItemSummary[] };
}

export async function reorderChannelQueueItem(channelId: string, itemId: number, position: number) {
  const res = await fetch(
    `${getApiBase()}/api/channels/${channelId}/queue/${itemId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify({ position }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot reorder queue item"));
}

export async function removeChannelQueueItem(channelId: string, itemId: number) {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/queue/${itemId}`, await withAuthHeaders({ method: "DELETE" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot remove queue item"));
}

export async function jumpToChannelQueueItem(channelId: string, itemId: number) {
  const res = await fetch(`${getApiBase()}/api/channels/${channelId}/queue/${itemId}/jump`, await withAuthHeaders({ method: "POST", body: JSON.stringify({}) }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot jump queue item"));
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
