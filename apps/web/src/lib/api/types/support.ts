import type { UserBadge } from "./user";

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
