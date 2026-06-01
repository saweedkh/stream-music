import type { SupportInboxStats, SupportMessageRow, SupportTicketRow } from "@/lib/api";

export type ParsedSupportSocket =
  | { kind: "sync"; ticket: SupportTicketRow | null; messages: SupportMessageRow[] }
  | { kind: "event_message"; message: SupportMessageRow; ticket: SupportTicketRow | null }
  | { kind: "event_ticket"; ticket: SupportTicketRow }
  | { kind: "history"; messages: SupportMessageRow[] }
  | { kind: "inbox"; ticket: SupportTicketRow }
  | { kind: "inbox_sync"; stats: SupportInboxStats }
  | { kind: "error"; code: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asTicket(v: unknown): SupportTicketRow | null {
  return isRecord(v) && typeof v.id === "number" ? (v as SupportTicketRow) : null;
}

function asMessage(v: unknown): SupportMessageRow | null {
  return isRecord(v) && typeof v.id === "number" ? (v as SupportMessageRow) : null;
}

function asMessages(v: unknown): SupportMessageRow[] {
  if (!Array.isArray(v)) return [];
  return v.map(asMessage).filter((m): m is SupportMessageRow => m !== null);
}

export function parseSupportSocketPayload(payload: unknown): ParsedSupportSocket | null {
  if (!isRecord(payload)) return null;
  const type = String(payload.type || "");

  if (type === "SUPPORT_SYNC") {
    return {
      kind: "sync",
      ticket: asTicket(payload.ticket),
      messages: asMessages(payload.messages),
    };
  }

  if (type === "SUPPORT_EVENT") {
    const event = String(payload.event || "");
    if (event === "message") {
      const message = asMessage(payload.message);
      if (!message) return null;
      return { kind: "event_message", message, ticket: asTicket(payload.ticket) };
    }
    if (event === "ticket") {
      const ticket = asTicket(payload.ticket);
      if (!ticket) return null;
      return { kind: "event_ticket", ticket };
    }
    return null;
  }

  if (type === "SUPPORT_HISTORY") {
    return { kind: "history", messages: asMessages(payload.messages) };
  }

  if (type === "SUPPORT_INBOX") {
    const ticket = asTicket(payload.ticket);
    if (!ticket) return null;
    return { kind: "inbox", ticket };
  }

  if (type === "SUPPORT_INBOX_SYNC") {
    if (!isRecord(payload.stats)) return null;
    return { kind: "inbox_sync", stats: payload.stats as SupportInboxStats };
  }

  if (type === "SUPPORT_ERROR") {
    return { kind: "error", code: String(payload.code || "unknown") };
  }

  return null;
}
