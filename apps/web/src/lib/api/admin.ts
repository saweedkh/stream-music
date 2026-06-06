import { getApiBase, withAuthHeaders, extractApiError } from "./client";
import type {
  AdminOverview,
  AdminUserRow,
  AdminBadgeDefinition,
  AdminChannelRow,
  AdminTrackRow,
  AdminPlaylistRow,
  AdminTrackImportRow,
  AdminPremiumCodeRow,
  Paginated,
} from "./types";

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

export async function patchAdminChannel(channelId: number, payload: { is_active?: boolean }) {
  const res = await fetch(
    `${getApiBase()}/api/admin/channels/${channelId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update channel"));
  return (await res.json()) as { id: number; name: string; is_active: boolean; is_playing: boolean };
}

export type AdminSystemHealth = {
  status: string;
  db: boolean;
  redis: boolean;
  server_time: number;
  channels_active: number;
  channels_playing: number;
  tracks_total: number;
  users_active: number;
  media_audio_gb: number;
  disk: { used_percent?: number; free_gb?: number; total_gb?: number; error?: string };
  celery: { workers: number; tasks_active: number; reachable: boolean };
  realtime: { channels_with_presence: number; listeners_in_presence: number };
};

export async function getAdminHealth() {
  const res = await fetch(`${getApiBase()}/api/admin/health`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load health"));
  return (await res.json()) as AdminSystemHealth;
}

function adminListUrl(path: string, options?: { search?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (options?.search?.trim()) params.set("search", options.search.trim());
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const qs = params.toString();
  return `${getApiBase()}${path}${qs ? `?${qs}` : ""}`;
}

export async function listAdminTracks(options?: { search?: string; limit?: number; offset?: number }) {
  const res = await fetch(adminListUrl("/api/admin/tracks", options), { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load tracks"));
  return (await res.json()) as Paginated<AdminTrackRow>;
}

export async function deleteAdminTrack(trackId: number) {
  const res = await fetch(
    `${getApiBase()}/api/admin/tracks/${trackId}`,
    await withAuthHeaders({ method: "DELETE" }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot delete track"));
}

export async function listAdminPlaylists(options?: { search?: string; limit?: number; offset?: number }) {
  const res = await fetch(adminListUrl("/api/admin/playlists", options), { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load playlists"));
  return (await res.json()) as Paginated<AdminPlaylistRow>;
}

export async function deleteAdminPlaylist(playlistId: number) {
  const res = await fetch(
    `${getApiBase()}/api/admin/playlists/${playlistId}`,
    await withAuthHeaders({ method: "DELETE" }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot delete playlist"));
}

export async function listAdminTrackImports(options?: { search?: string; limit?: number; offset?: number }) {
  const res = await fetch(adminListUrl("/api/admin/track-imports", options), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load imports"));
  return (await res.json()) as Paginated<AdminTrackImportRow>;
}

export async function listAdminPremiumCodes() {
  const res = await fetch(`${getApiBase()}/api/admin/premium-codes`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load premium codes"));
  return (await res.json()) as { results: AdminPremiumCodeRow[] };
}

export async function createAdminPremiumCode(payload: {
  max_uses?: number;
  expires_in_days?: number;
  note?: string;
}) {
  const res = await fetch(
    `${getApiBase()}/api/admin/premium-codes`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot create code"));
  return (await res.json()) as AdminPremiumCodeRow & { code: string };
}

export async function patchAdminPremiumCode(codeId: number, payload: { is_active?: boolean }) {
  const res = await fetch(
    `${getApiBase()}/api/admin/premium-codes/${codeId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update code"));
  return (await res.json()) as AdminPremiumCodeRow;
}
