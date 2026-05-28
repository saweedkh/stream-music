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
