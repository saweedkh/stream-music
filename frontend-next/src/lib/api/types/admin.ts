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
