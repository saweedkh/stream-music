export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
export const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000";
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
  queue_version: number;
  track?: { file?: string | null; title?: string | null } | null;
};

export type ChannelStateResponse = {
  channel: { id: number; name: string; privacy?: string; description?: string; member_limit?: number; public_slug?: string };
  playback: PlaybackState;
};
export type ChannelSummary = {
  id: number;
  name: string;
  description: string;
  privacy: "public" | "private" | "unlisted";
  member_limit?: number;
  is_playing?: boolean;
};
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
  await fetch(`${API_BASE}/api/auth/csrf`, { credentials: "include" });
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

export async function getChannelState(channelId: string) {
  const res = await fetch(`${API_BASE}/api/channels/${channelId}/state`, { cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load channel state");
  return (await res.json()) as ChannelStateResponse;
}

export async function getServerTime() {
  const t0 = Date.now();
  const res = await fetch(`${API_BASE}/api/time`, { cache: "no-store" });
  const t1 = Date.now();
  const body = await res.json();
  const latency = (t1 - t0) / 2;
  const offset = body.time * 1000 - (t0 + latency);
  return { serverTime: body.time, offset };
}

export async function controlChannel(channelId: string, action: ChannelControlAction, payload?: Record<string, unknown>) {
  const res = await fetch(
    `${API_BASE}/api/channels/${channelId}/control`,
    await withAuthHeaders({
    method: "POST",
      body: JSON.stringify({ action, ...payload }),
    }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot send control action"));
  return (await res.json()) as PlaybackState;
}

export async function joinChannel(channelId: string, token?: string) {
  const res = await fetch(`${API_BASE}/api/channels/${channelId}/join`, await withAuthHeaders({ method: "POST", body: JSON.stringify({ token }) }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot join channel"));
  return res.json();
}

export async function createInvite(channelId: string) {
  const res = await fetch(`${API_BASE}/api/channels/${channelId}/invite`, await withAuthHeaders({ method: "POST" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot create invite"));
  return (await res.json()) as { token: string; invite_url: string };
}

export async function loginUser(username: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, await withAuthHeaders({ method: "POST", body: JSON.stringify({ username, password }) }));
  if (!res.ok) throw new Error(await extractApiError(res, "Login failed"));
  return (await res.json()) as { user: AuthUser };
}

export async function registerUser(username: string, email: string, password: string) {
  const res = await fetch(
    `${API_BASE}/api/auth/register`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({ username, email, password }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Register failed"));
  return (await res.json()) as { user: AuthUser };
}

export async function logoutUser() {
  const res = await fetch(`${API_BASE}/api/auth/logout`, await withAuthHeaders({ method: "POST" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Logout failed"));
}

export async function getMe() {
  const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include", cache: "no-store" });
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
  payload: { name?: string; description?: string; privacy?: "public" | "private" | "unlisted"; member_limit?: number },
) {
  const res = await fetch(
    `${API_BASE}/api/channels/${channelId}/settings`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update channel settings"));
  return res.json();
}

export async function getChannelMembers(channelId: string) {
  const res = await fetch(`${API_BASE}/api/channels/${channelId}/members`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load channel members"));
  return (await res.json()) as { results: ChannelMember[] };
}

export async function updateChannelMemberRole(channelId: string, memberId: number, role: ChannelMember["role"]) {
  const res = await fetch(
    `${API_BASE}/api/channels/${channelId}/members/${memberId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify({ role }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update member role"));
}

export async function removeChannelMember(channelId: string, memberId: number) {
  const res = await fetch(`${API_BASE}/api/channels/${channelId}/members/${memberId}`, await withAuthHeaders({ method: "DELETE" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot remove member"));
}

export async function rotatePrivateInvite(channelId: string) {
  const res = await fetch(`${API_BASE}/api/channels/${channelId}/invite/rotate`, await withAuthHeaders({ method: "POST" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot rotate private invite"));
  return (await res.json()) as { token: string; invite_url: string };
}

export async function rotatePublicLink(channelId: string) {
  const res = await fetch(`${API_BASE}/api/channels/${channelId}/public-link/rotate`, await withAuthHeaders({ method: "POST" }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot rotate public link"));
  return (await res.json()) as { public_url: string };
}

export async function listChannels() {
  const res = await fetch(`${API_BASE}/api/channels/`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load channels");
  return (await res.json()) as ChannelSummary[];
}

export async function createChannel(payload: {
  name: string;
  description?: string;
  privacy: "public" | "private" | "unlisted";
  member_limit?: number;
}) {
  const res = await fetch(`${API_BASE}/api/channels/`, await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }));
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot create channel"));
  return (await res.json()) as ChannelSummary;
}

export async function listTracks() {
  const res = await fetch(`${API_BASE}/api/tracks/`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load tracks");
  return (await res.json()) as TrackSummary[];
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
    xhr.open("POST", `${API_BASE}/api/tracks/`);
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

export async function listPlaylists() {
  const res = await fetch(`${API_BASE}/api/playlists/`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load playlists");
  return (await res.json()) as PlaylistSummary[];
}

export async function createPlaylist(payload: { name: string; channel?: number | null }) {
  const res = await fetch(
    `${API_BASE}/api/playlists/`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({ name: payload.name, channel: payload.channel ?? null }) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot create playlist"));
  return (await res.json()) as PlaylistSummary;
}

export async function listPlaylistItems() {
  const res = await fetch(`${API_BASE}/api/playlist-items/`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load playlist items");
  return (await res.json()) as PlaylistItemSummary[];
}

export async function addPlaylistItem(payload: { playlist: number; track: number; position: number }) {
  const res = await fetch(`${API_BASE}/api/playlist-items/`, await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }));
  if (!res.ok) throw new Error("Cannot add playlist item");
  return (await res.json()) as PlaylistItemSummary;
}

export async function reorderPlaylistItem(itemId: number, position: number) {
  const res = await fetch(
    `${API_BASE}/api/playlist-items/${itemId}/`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify({ position }) }),
  );
  if (!res.ok) throw new Error("Cannot reorder playlist item");
  return (await res.json()) as PlaylistItemSummary;
}

export async function playPlaylistInChannel(channelId: string, playlistId: number) {
  const res = await fetch(
    `${API_BASE}/api/channels/${channelId}/playlists/${playlistId}/play`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify({}) }),
  );
  if (!res.ok) throw new Error("Cannot play playlist in channel");
  return res.json();
}

export async function listChannelQueue(channelId: string) {
  const res = await fetch(`${API_BASE}/api/channels/${channelId}/queue`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load channel queue");
  return (await res.json()) as { results: QueueItemSummary[] };
}

export async function reorderChannelQueueItem(channelId: string, itemId: number, position: number) {
  const res = await fetch(
    `${API_BASE}/api/channels/${channelId}/queue/${itemId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify({ position }) }),
  );
  if (!res.ok) throw new Error("Cannot reorder queue item");
}

export async function removeChannelQueueItem(channelId: string, itemId: number) {
  const res = await fetch(`${API_BASE}/api/channels/${channelId}/queue/${itemId}`, await withAuthHeaders({ method: "DELETE" }));
  if (!res.ok) throw new Error("Cannot remove queue item");
}

export async function jumpToChannelQueueItem(channelId: string, itemId: number) {
  const res = await fetch(`${API_BASE}/api/channels/${channelId}/queue/${itemId}/jump`, await withAuthHeaders({ method: "POST", body: JSON.stringify({}) }));
  if (!res.ok) throw new Error("Cannot jump queue item");
}

export async function listUsers() {
  const res = await fetch(`${API_BASE}/api/auth/users`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load users");
  return (await res.json()) as { results: Array<{ id: number; username: string }> };
}

export async function listTrackSharePermissions(trackId: number) {
  const res = await fetch(`${API_BASE}/api/tracks/${trackId}/share-permissions`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error("Cannot load track share permissions");
  return (await res.json()) as { results: TrackSharePermission[] };
}

export async function addTrackSharePermission(trackId: number, payload: { user_id?: number; channel_id?: number }) {
  const res = await fetch(
    `${API_BASE}/api/tracks/${trackId}/share-permissions`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error("Cannot add track share permission");
  return (await res.json()) as TrackSharePermission;
}

export async function removeTrackSharePermission(trackId: number, shareId: number) {
  const res = await fetch(
    `${API_BASE}/api/tracks/${trackId}/share-permissions`,
    await withAuthHeaders({ method: "DELETE", body: JSON.stringify({ share_id: shareId }) }),
  );
  if (!res.ok) throw new Error("Cannot remove track share permission");
}
