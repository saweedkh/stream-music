import type { MessageKey } from "@/lib/i18n/messages";
import type { SupportTicketPriority, SupportTicketStatus } from "@/lib/api";

export const STATUS_KEYS: Record<SupportTicketStatus, MessageKey> = {
  open: "support.status.open",
  in_progress: "support.status.in_progress",
  waiting_user: "support.status.waiting_user",
  waiting_staff: "support.status.waiting_staff",
  resolved: "support.status.resolved",
  closed: "support.status.closed",
};

export const PRIORITY_KEYS: Record<SupportTicketPriority, MessageKey> = {
  low: "support.priority.low",
  normal: "support.priority.normal",
  high: "support.priority.high",
  urgent: "support.priority.urgent",
};

export const STATUS_FILTERS = ["all", "open", "waiting_staff", "waiting_user", "in_progress", "resolved", "closed"] as const;

export type SupportStatusFilter = (typeof STATUS_FILTERS)[number];

export const CATEGORY_KEYS: Record<string, MessageKey> = {
  general: "support.category.general",
  account: "support.category.account",
  billing: "support.category.billing",
  technical: "support.category.technical",
  feature: "support.category.feature",
  other: "support.category.other",
};

export function categoryLabel(categoryId: string, t: (key: MessageKey) => string): string {
  const key = CATEGORY_KEYS[categoryId];
  return key ? t(key) : categoryId;
}

export function formatRelativeTime(iso: string | null, locale: string): string {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return locale === "fa" ? "همین الان" : "Just now";
    if (diffMin < 60) return locale === "fa" ? `${diffMin} دقیقه پیش` : `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return locale === "fa" ? `${diffHr} ساعت پیش` : `${diffHr}h ago`;
    return formatMessageTime(iso, locale);
  } catch {
    return iso;
  }
}

export function statusVariant(status: SupportTicketStatus): "default" | "success" | "warning" | "secondary" {
  if (status === "closed" || status === "resolved") return "secondary";
  if (status === "waiting_staff") return "warning";
  if (status === "in_progress") return "success";
  return "default";
}

export function priorityVariant(priority: SupportTicketPriority): "default" | "success" | "warning" | "secondary" {
  if (priority === "urgent" || priority === "high") return "warning";
  if (priority === "low") return "secondary";
  return "default";
}

export function formatMessageTime(iso: string | null, locale: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(locale === "fa" ? "fa-IR" : undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
