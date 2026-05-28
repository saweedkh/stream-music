import type { TrackSummary } from "./tracks";

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

export type PlaylistItemSummary = {
  id: number;
  playlist: number;
  track: number;
  track_detail?: TrackSummary;
  position: number;
};

export type PlaylistShareLinkInfo = {
  active?: boolean;
  token?: string;
  share_url?: string;
  privacy?: string;
  expires_at?: string | null;
};
