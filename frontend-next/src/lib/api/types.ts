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
  chat_slow_mode_seconds?: number;
  chat_word_filters?: string[];
  suggestion_rate_limit_per_hour?: number;
  theme_primary?: string;
  theme_surface?: string;
  theme_font?: string;
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
  owner_username?: string | null;
  public_slug?: string;
  public_join_slug?: string | null;
  member_limit?: number;
  is_playing?: boolean;
  join_requires_approval?: boolean;
  is_active?: boolean;
  /** False after leaving the room; user can reconnect via join. */
  membership_is_active?: boolean | null;
  brand_logo_url?: string | null;
};

/** Thrown when GET /channels/:id/state returns 410 (room closed for non-owners). */
export class ChannelClosedError extends Error {
  constructor() {
    super("channel_closed");
    this.name = "ChannelClosedError";
  }
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
  owner?: number;
  channel: number | null;
  is_auto_generated: boolean;
  is_favorited?: boolean;
};

export type CopyPlaylistToChannelResult = {
  playlist: PlaylistSummary;
  added: number;
  skipped_inaccessible: number;
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
  track_owner_premium?: boolean;
  premium_boosted?: boolean;
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

export type GetChannelStateOptions = {
  /**
   * Required for server-side (RSC) calls: the browser never attaches cookies to fetches
   * from Next.js to INTERNAL_API_BASE_URL, so forward the incoming `Cookie` header.
   */
  cookieHeader?: string | null;
};

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
  reply_to_id?: number | null;
  reply_preview?: { id: number; username: string; body: string } | null;
  track_previews?: Array<{ id: number; title: string; artist: string; album: string }>;
};

export type ChannelPinnedMessageResponse = { message: ChannelChatMessageRow | null };

export type ChannelTrackReactionRow = {
  id: number;
  channel: number;
  track: number;
  user: number;
  username: string;
  emoji: string;
  created_at: string;
};

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

export type ChannelPlaylistSuggestion = {
  id: number;
  channel: number;
  track: number | null;
  track_title?: string | null;
  external_url?: string;
  external_title?: string;
  external_artist?: string;
  external_source?: string;
  user: number;
  username?: string;
  status: "pending" | "approved" | "rejected";
  note?: string;
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: number | null;
};

export type ChannelNotificationPreference = {
  muted: boolean;
  notify_room_started: boolean;
  notify_queue_turn: boolean;
  notify_skip_threshold: boolean;
  notify_moderation: boolean;
  updated_at: string;
};

export type PartyRecapHeatmapBucket = {
  index: number;
  score: number;
  intensity: number;
  label: string;
};

export type PartyRecap = {
  channel_id: number;
  channel_name: string;
  description: string;
  total_events: number;
  top_tracks: Array<{ id: number; title: string; artist: string; play_count: number }>;
  timeline: Array<{ track_id: number | null; title: string | null; event_type: string; at: string }>;
  excitement_heatmap?: {
    buckets: PartyRecapHeatmapBucket[];
    peak_index: number | null;
    peak_score: number;
  };
  listener_peaks?: PartyRecapHeatmapBucket[];
  generated_at?: string;
};

export type ChannelsOnlineRow = {
  channel: ChannelSummary;
  online_count: number;
  members: Array<{ id: number; username: string }>;
  pending_suggestions?: number;
};

export type GlobalSearchUser = { id: number; username: string; display_name: string };
export type GlobalSearchSharedPlaylist = {
  token: string;
  playlist_name: string;
  owner_username: string;
};

export type GlobalSearchResult = {
  tracks: TrackSummary[];
  playlists: PlaylistSummary[];
  channels: ChannelSummary[];
  users: GlobalSearchUser[];
  shared_playlists: GlobalSearchSharedPlaylist[];
};

export type TrackFacets = { genres: string[]; albums: string[]; tags: string[] };

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
  public_playlists?: PlaylistSummary[];
  stats?: {
    sessions_joined: number;
    tracks_played: number;
    channel_follows: number | null;
    user_followers: number;
  };
  following_count: number;
  follower_count?: number;
  user_following?: boolean;
  is_self: boolean;
};

export type PremiumLimits = {
  is_premium: boolean;
  owned_channels: number;
  max_owned_channels: number;
  max_member_limit: number;
  premium_queue_boost: boolean;
};

export type PlaylistShareLinkInfo = {
  active?: boolean;
  token?: string;
  share_url?: string;
  privacy?: string;
  expires_at?: string | null;
};

export type ChannelFollowState = {
  following: boolean;
  notify_live: boolean;
  follower_count: number;
};

export type FollowingChannelRow = {
  channel: ChannelSummary;
  notify_live: boolean;
  is_live: boolean;
  is_member: boolean;
  followed_at: string | null;
};

export type ExploreFeed = {
  live_channels: ChannelSummary[];
  popular_channels: Array<{ channel: ChannelSummary; event_count: number }>;
  shared_playlists: Array<{
    token: string;
    share_url: string;
    playlist: PlaylistSummary;
    owner_username: string;
    item_count: number;
  }>;
};
