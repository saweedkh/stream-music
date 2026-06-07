import type { UserBadge } from "./user";

export type AdminOverview = {
  users: { total: number; active: number; staff: number; superuser: number };
  channels: { total: number; active: number; playing: number };
  tracks_total: number;
  playlists_total: number;
  memberships_active: number;
  pending?: {
    chat_reports_open: number;
    join_requests_pending: number;
    suggestions_pending: number;
    channels_playing: number;
    support: { open: number; waiting_staff: number; urgent: number };
  };
};

export type AdminUserDetail = AdminUserRow & {
  owned_channels: number;
  tracks_owned: number;
  playlists_owned: number;
  memberships: number;
};

export type AdminChannelDetail = AdminChannelRow & {
  description: string;
  member_limit: number;
  join_requires_approval: boolean;
  created_at: string | null;
};

export type AdminModerationReportRow = {
  id: number;
  channel_id: number;
  channel_name: string;
  message_id: number;
  message_preview: string;
  reporter_id: number;
  reporter_username: string;
  reason: string;
  status: string;
  created_at: string | null;
};

export type AdminJoinRequestRow = {
  id: number;
  channel_id: number;
  channel_name: string;
  user_id: number;
  username: string;
  status: string;
  created_at: string | null;
};

export type AdminLiveSessionRow = {
  channel_id: number;
  channel_name: string;
  owner_username: string | null;
  privacy: string;
  track_id: number | null;
  track_title: string | null;
  playback_rate: number;
  queue_version: number;
  updated_at: string | null;
};

export type AdminPremiumRedemptionRow = {
  id: number;
  code: string;
  user_id: number;
  username: string;
  redeemed_at: string | null;
};

export type AdminSuggestionRow = {
  id: number;
  channel_id: number;
  channel_name: string;
  user_id: number;
  username: string;
  title: string;
  status: string;
  created_at: string | null;
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

export type AdminTrackRow = {
  id: number;
  title: string;
  artist: string;
  owner_id: number;
  owner_username: string | null;
  visibility: string;
  import_source: string;
  source_url: string;
  duration_seconds: number;
  created_at: string | null;
};

export type AdminPlaylistRow = {
  id: number;
  name: string;
  owner_id: number;
  owner_username: string | null;
  is_auto_generated: boolean;
  channel_id: number | null;
  track_count: number;
  created_at: string | null;
};

export type AdminTrackImportRow = {
  id: number;
  title: string;
  owner_id: number;
  owner_username: string;
  import_source: string;
  source_url: string;
  visibility: string;
  created_at: string | null;
};

export type AdminPremiumCodeRow = {
  id: number;
  code: string;
  max_uses: number;
  use_count: number;
  is_active: boolean;
  expires_at: string | null;
  note: string;
};

export type Paginated<T> = {
  results: T[];
  total: number;
  offset: number;
  limit: number;
};

export type AdminAnalyticsOverview = {
  listen: {
    total_listen_seconds: number;
    total_listen_hours: number;
    total_play_events: number;
    channels_with_stats: number;
    unique_listeners_platform: number;
  };
  gamification: {
    profiles_total: number;
    total_points_awarded: number;
    active_streaks: number;
    point_events_30d: number;
  };
  top_channels: {
    channel_id: number;
    channel_name: string;
    owner_username: string | null;
    total_listen_hours: number;
    unique_listeners: number;
    total_play_events: number;
  }[];
};

export type AdminAnalyticsChannelRow = {
  channel_id: number;
  channel_name: string;
  owner_id: number;
  owner_username: string | null;
  total_listen_seconds: number;
  total_listen_hours: number;
  total_play_events: number;
  unique_listeners: number;
  updated_at: string | null;
};

export type AdminGamificationRow = {
  user_id: number;
  username: string;
  points: number;
  level: number;
  streak_days: number;
  lifetime_listen_hours: number;
  updated_at: string | null;
};

export type AdminSocialOverview = {
  profiles: { total: number; public: number; private: number; with_avatar: number };
  follows: { channel_follows_total: number; user_follows_total: number };
  referrals: { codes_total: number; total_signups: number };
  activity: { events_total: number; events_7d: number; by_kind: Record<string, number> };
};

export type AdminSocialProfileRow = {
  user_id: number;
  username: string;
  email: string;
  bio: string;
  is_public: boolean;
  has_avatar: boolean;
  follower_count: number;
  following_channels_count: number;
  updated_at: string | null;
};

export type AdminSocialChannelFollowRow = {
  id: number;
  user_id: number;
  username: string;
  channel_id: number;
  channel_name: string;
  notify_live: boolean;
  created_at: string | null;
};

export type AdminSocialUserFollowRow = {
  id: number;
  follower_id: number;
  follower_username: string;
  following_id: number;
  following_username: string;
  created_at: string | null;
};

export type AdminReferralRow = {
  user_id: number;
  username: string;
  code: string;
  signup_count: number;
  created_at: string | null;
};

export type AdminActivityRow = {
  id: number;
  kind: string;
  actor_id: number;
  actor_username: string;
  channel_id: number | null;
  channel_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string | null;
};

export type AdminAuditLogRow = {
  id: number;
  actor_id: number | null;
  actor_username: string | null;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string | null;
};

export type AdminBillingOverview = {
  stripe_configured: boolean;
  premium_users: number;
  stripe_purchases: number;
  stripe_revenue_cents: number;
  code_redemptions: number;
  active_invite_codes: number;
  referral_signups: number;
  trends: {
    stripe_purchases: AdminBillingTrendPoint[];
    referral_signups: AdminBillingTrendPoint[];
  };
};

export type AdminBillingTrendPoint = {
  date: string;
  count: number;
  revenue_cents?: number;
};

export type AdminStripePurchaseRow = {
  id: number;
  user_id: number;
  username: string;
  stripe_session_id: string;
  amount_total: number | null;
  currency: string;
  created_at: string | null;
};

export type AdminBillingPremiumUserRow = {
  user_id: number;
  username: string;
  email: string;
  stripe_purchases: number;
  code_redemptions: number;
  source: "stripe" | "code" | "manual";
};

export type AdminBillingReferralSignupRow = {
  id: number;
  code: string;
  referrer_id: number;
  referrer_username: string;
  referred_user_id: number;
  referred_username: string;
  created_at: string | null;
};

export type AdminIntegrationsOverview = {
  webhooks_total: number;
  webhooks_active: number;
  deliveries_total: number;
  deliveries_failed: number;
  api_tokens_total: number;
  api_tokens_active: number;
};

export type AdminWebhookRow = {
  id: number;
  owner_id: number;
  owner_username: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_delivery_at: string | null;
  last_error: string | null;
  created_at: string | null;
};

export type AdminWebhookDeliveryRow = {
  id: number;
  subscription_id: number;
  owner_username: string | null;
  url: string;
  event: string;
  status_code: number | null;
  success: boolean;
  created_at: string | null;
};

export type AdminApiTokenRow = {
  id: number;
  user_id: number;
  username: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  created_at: string | null;
};
