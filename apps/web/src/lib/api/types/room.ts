import type { UserBadge } from "./user";

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
  avatar_url?: string | null;
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
