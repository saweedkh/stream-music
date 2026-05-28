export type TrackSummary = {
  id: number;
  title: string;
  artist: string;
  album: string;
  file: string;
  visibility: "private" | "shared_with_users" | "shared_with_channels" | "public_lan";
  is_favorited?: boolean;
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

export type TrackSharePermission = {
  id: number;
  track: number;
  user: number | null;
  channel: number | null;
  username?: string;
  channel_name?: string;
};

export type TrackFacets = { genres: string[]; albums: string[]; tags: string[] };
