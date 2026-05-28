import type { ChannelSummary } from "./channel";
import type { PlaylistSummary } from "./playlist";
import type { TrackSummary } from "./tracks";
import type { UserBadge } from "./user";

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
