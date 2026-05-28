import type { PlaybackState } from "./playback";
import type { TrackSummary } from "./tracks";
import type { UserBadge } from "./user";

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

export type ChannelsOnlineRow = {
  channel: ChannelSummary;
  online_count: number;
  members: Array<{ id: number; username: string }>;
  pending_suggestions?: number;
};
