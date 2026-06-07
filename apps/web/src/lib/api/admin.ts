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
  payload: Partial<Pick<AdminUserRow, "is_active" | "is_staff" | "is_superuser">> & {
    badge_slugs?: string[];
    is_premium?: boolean;
  },
) {
  const res = await fetch(
    `${getApiBase()}/api/admin/users/${userId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update user"));
  return (await res.json()) as AdminUserRow;
}

export async function getAdminUser(userId: number) {
  const res = await fetch(`${getApiBase()}/api/admin/users/${userId}`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load user"));
  return (await res.json()) as import("./types/admin").AdminUserDetail;
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

export async function patchAdminChannel(
  channelId: number,
  payload: {
    is_active?: boolean;
    privacy?: string;
    name?: string;
    description?: string;
    member_limit?: number;
    join_requires_approval?: boolean;
  },
) {
  const res = await fetch(
    `${getApiBase()}/api/admin/channels/${channelId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update channel"));
  return (await res.json()) as { id: number; name: string; privacy: string; is_active: boolean; is_playing: boolean };
}

export async function getAdminChannel(channelId: number) {
  const res = await fetch(`${getApiBase()}/api/admin/channels/${channelId}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load channel"));
  return (await res.json()) as import("./types/admin").AdminChannelDetail;
}

export async function patchAdminTrack(
  trackId: number,
  payload: { visibility?: string; title?: string; artist?: string },
) {
  const res = await fetch(
    `${getApiBase()}/api/admin/tracks/${trackId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update track"));
  return (await res.json()) as { id: number; title: string; visibility: string };
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

function adminListUrl(path: string, options?: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  if (options) {
    for (const [key, value] of Object.entries(options)) {
      if (value != null && String(value).trim() !== "") params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `${getApiBase()}${path}${qs ? `?${qs}` : ""}`;
}

function adminDateListParams(options?: {
  search?: string;
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  return {
    search: options?.search,
    limit: options?.limit,
    offset: options?.offset,
    date_from: options?.dateFrom,
    date_to: options?.dateTo,
  };
}

export async function downloadAdminCsv(
  path: string,
  filename: string,
  options?: { search?: string; dateFrom?: string; dateTo?: string },
) {
  const res = await fetch(
    adminListUrl(path, {
      search: options?.search,
      date_from: options?.dateFrom,
      date_to: options?.dateTo,
    }),
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot export CSV"));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
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

export async function patchAdminPlaylist(playlistId: number, payload: { name?: string }) {
  const res = await fetch(
    `${getApiBase()}/api/admin/playlists/${playlistId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update playlist"));
  return (await res.json()) as { id: number; name: string };
}

export async function listAdminModerationReports(options?: {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (options?.search?.trim()) params.set("search", options.search.trim());
  if (options?.status) params.set("status", options.status);
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const qs = params.toString();
  const res = await fetch(`${getApiBase()}/api/admin/moderation/reports${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load reports"));
  return (await res.json()) as Paginated<import("./types/admin").AdminModerationReportRow>;
}

export async function patchAdminModerationReport(reportId: number, payload: { status: string }) {
  const res = await fetch(
    `${getApiBase()}/api/admin/moderation/reports/${reportId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update report"));
  return (await res.json()) as { id: number; status: string; channel_id: number };
}

export async function listAdminJoinRequests(options?: {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (options?.search?.trim()) params.set("search", options.search.trim());
  if (options?.status) params.set("status", options.status);
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const qs = params.toString();
  const res = await fetch(`${getApiBase()}/api/admin/join-requests${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load join requests"));
  return (await res.json()) as Paginated<import("./types/admin").AdminJoinRequestRow>;
}

export async function listAdminLiveSessions(options?: { search?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (options?.search?.trim()) params.set("search", options.search.trim());
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const qs = params.toString();
  const res = await fetch(`${getApiBase()}/api/admin/live-sessions${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load live sessions"));
  return (await res.json()) as Paginated<import("./types/admin").AdminLiveSessionRow>;
}

export async function listAdminPremiumRedemptions(options?: {
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (options?.search?.trim()) params.set("search", options.search.trim());
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const qs = params.toString();
  const res = await fetch(`${getApiBase()}/api/admin/premium-redemptions${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load redemptions"));
  return (await res.json()) as Paginated<import("./types/admin").AdminPremiumRedemptionRow>;
}

export async function listAdminSuggestions(options?: {
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (options?.search?.trim()) params.set("search", options.search.trim());
  if (options?.status) params.set("status", options.status);
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const qs = params.toString();
  const res = await fetch(`${getApiBase()}/api/admin/suggestions${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load suggestions"));
  return (await res.json()) as Paginated<import("./types/admin").AdminSuggestionRow>;
}

export async function getAdminAnalyticsOverview() {
  const res = await fetch(`${getApiBase()}/api/admin/analytics/overview`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load analytics"));
  return (await res.json()) as import("./types/admin").AdminAnalyticsOverview;
}

export async function listAdminAnalyticsChannels(options?: { search?: string; limit?: number; offset?: number }) {
  const res = await fetch(adminListUrl("/api/admin/analytics/channels", options), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load channel analytics"));
  return (await res.json()) as Paginated<import("./types/admin").AdminAnalyticsChannelRow>;
}

export async function listAdminGamificationProfiles(options?: { search?: string; limit?: number; offset?: number }) {
  const res = await fetch(adminListUrl("/api/admin/analytics/gamification", options), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load gamification"));
  return (await res.json()) as Paginated<import("./types/admin").AdminGamificationRow>;
}

export async function getAdminSocialOverview() {
  const res = await fetch(`${getApiBase()}/api/admin/social/overview`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load social overview"));
  return (await res.json()) as import("./types/admin").AdminSocialOverview;
}

export async function listAdminSocialProfiles(options?: {
  search?: string;
  is_public?: string;
  limit?: number;
  offset?: number;
}) {
  const res = await fetch(adminListUrl("/api/admin/social/profiles", options), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load profiles"));
  return (await res.json()) as Paginated<import("./types/admin").AdminSocialProfileRow>;
}

export async function patchAdminSocialProfile(
  userId: number,
  payload: { is_public?: boolean; bio?: string },
) {
  const res = await fetch(
    `${getApiBase()}/api/admin/social/profiles/${userId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update profile"));
  return (await res.json()) as { user_id: number; username: string; bio: string; is_public: boolean };
}

export async function listAdminSocialChannelFollows(options?: { search?: string; limit?: number; offset?: number }) {
  const res = await fetch(adminListUrl("/api/admin/social/channel-follows", options), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load channel follows"));
  return (await res.json()) as Paginated<import("./types/admin").AdminSocialChannelFollowRow>;
}

export async function listAdminSocialUserFollows(options?: { search?: string; limit?: number; offset?: number }) {
  const res = await fetch(adminListUrl("/api/admin/social/user-follows", options), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load user follows"));
  return (await res.json()) as Paginated<import("./types/admin").AdminSocialUserFollowRow>;
}

export async function listAdminReferrals(options?: { search?: string; limit?: number; offset?: number }) {
  const res = await fetch(adminListUrl("/api/admin/social/referrals", options), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load referrals"));
  return (await res.json()) as Paginated<import("./types/admin").AdminReferralRow>;
}

export async function listAdminActivityEvents(options?: {
  search?: string;
  kind?: string;
  limit?: number;
  offset?: number;
}) {
  const res = await fetch(adminListUrl("/api/admin/social/activity", options), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load activity"));
  return (await res.json()) as Paginated<import("./types/admin").AdminActivityRow>;
}

export async function listAdminAuditLog(options?: {
  search?: string;
  action?: string;
  target_type?: string;
  limit?: number;
  offset?: number;
}) {
  const res = await fetch(adminListUrl("/api/admin/audit-log", options), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load audit log"));
  return (await res.json()) as Paginated<import("./types/admin").AdminAuditLogRow>;
}

export async function getAdminBillingOverview(options?: { dateFrom?: string; dateTo?: string }) {
  const res = await fetch(adminListUrl("/api/admin/billing/overview", adminDateListParams(options)), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load billing overview"));
  return (await res.json()) as import("./types/admin").AdminBillingOverview;
}

export async function listAdminBillingStripePurchases(options?: {
  search?: string;
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const res = await fetch(adminListUrl("/api/admin/billing/stripe-purchases", adminDateListParams(options)), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load Stripe purchases"));
  return (await res.json()) as Paginated<import("./types/admin").AdminStripePurchaseRow>;
}

export async function exportAdminBillingStripePurchases(options?: {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  await downloadAdminCsv("/api/admin/billing/stripe-purchases/export", "stripe-purchases.csv", options);
}

export async function listAdminBillingPremiumUsers(options?: { search?: string; limit?: number; offset?: number }) {
  const res = await fetch(adminListUrl("/api/admin/billing/premium-users", options), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load premium users"));
  return (await res.json()) as Paginated<import("./types/admin").AdminBillingPremiumUserRow>;
}

export async function listAdminBillingReferralSignups(options?: {
  search?: string;
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const res = await fetch(adminListUrl("/api/admin/billing/referral-signups", adminDateListParams(options)), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load referral signups"));
  return (await res.json()) as Paginated<import("./types/admin").AdminBillingReferralSignupRow>;
}

export async function exportAdminBillingReferralSignups(options?: {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  await downloadAdminCsv("/api/admin/billing/referral-signups/export", "referral-signups.csv", options);
}

export async function getAdminIntegrationsOverview() {
  const res = await fetch(`${getApiBase()}/api/admin/integrations/overview`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load integrations overview"));
  return (await res.json()) as import("./types/admin").AdminIntegrationsOverview;
}

export async function listAdminWebhooks(options?: { search?: string; limit?: number; offset?: number }) {
  const res = await fetch(adminListUrl("/api/admin/integrations/webhooks", options), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load webhooks"));
  return (await res.json()) as Paginated<import("./types/admin").AdminWebhookRow>;
}

export async function patchAdminWebhook(webhookId: number, payload: { is_active: boolean }) {
  const res = await fetch(
    `${getApiBase()}/api/admin/integrations/webhooks/${webhookId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update webhook"));
  return (await res.json()) as { id: number; is_active: boolean };
}

export async function listAdminWebhookDeliveries(options?: {
  search?: string;
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const res = await fetch(adminListUrl("/api/admin/integrations/deliveries", adminDateListParams(options)), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load webhook deliveries"));
  return (await res.json()) as Paginated<import("./types/admin").AdminWebhookDeliveryRow>;
}

export async function exportAdminWebhookDeliveries(options?: { search?: string; dateFrom?: string; dateTo?: string }) {
  await downloadAdminCsv("/api/admin/integrations/deliveries/export", "webhook-deliveries.csv", options);
}

export async function listAdminApiTokens(options?: { search?: string; limit?: number; offset?: number }) {
  const res = await fetch(adminListUrl("/api/admin/integrations/api-tokens", options), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load API tokens"));
  return (await res.json()) as Paginated<import("./types/admin").AdminApiTokenRow>;
}
