import type { UserBadge } from "./user";

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
