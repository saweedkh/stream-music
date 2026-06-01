import { getApiBase, withAuthFormData, withAuthHeaders, extractApiError } from "./client";
import type {
  SupportTicketStatus,
  SupportTicketPriority,
  SupportTicketRow,
  SupportMessageRow,
  SupportInboxStats,
} from "./types";

export async function getSupportCategories() {
  const res = await fetch(`${getApiBase()}/api/support/categories`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load categories"));
  return (await res.json()) as { categories: Array<{ id: string; label: string }> };
}

export async function listSupportTickets(options?: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.search?.trim()) params.set("search", options.search.trim());
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.offset != null) params.set("offset", String(options.offset));
  const qs = params.toString();
  const res = await fetch(`${getApiBase()}/api/support/tickets${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load tickets"));
  return (await res.json()) as {
    results: SupportTicketRow[];
    total: number;
    offset: number;
    limit: number;
    stats?: SupportInboxStats;
  };
}

export async function createSupportTicket(payload: {
  subject: string;
  category: string;
  body: string;
  priority?: SupportTicketPriority;
}) {
  const res = await fetch(
    `${getApiBase()}/api/support/tickets`,
    await withAuthHeaders({ method: "POST", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot create ticket"));
  return (await res.json()) as { ticket: SupportTicketRow; message: SupportMessageRow };
}

export async function getSupportTicket(ticketId: number) {
  const res = await fetch(`${getApiBase()}/api/support/tickets/${ticketId}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load ticket"));
  return (await res.json()) as { ticket: SupportTicketRow };
}

export async function patchSupportTicket(
  ticketId: number,
  payload: Partial<{
    status: SupportTicketStatus;
    priority: SupportTicketPriority;
    assigned_to_id: number | null;
    category: string;
  }>,
) {
  const res = await fetch(
    `${getApiBase()}/api/support/tickets/${ticketId}`,
    await withAuthHeaders({ method: "PATCH", body: JSON.stringify(payload) }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot update ticket"));
  return (await res.json()) as { ticket: SupportTicketRow };
}

export async function listSupportTicketMessages(ticketId: number, options?: { limit?: number; before?: number }) {
  const params = new URLSearchParams();
  if (options?.limit != null) params.set("limit", String(options.limit));
  if (options?.before != null) params.set("before", String(options.before));
  const qs = params.toString();
  const res = await fetch(`${getApiBase()}/api/support/tickets/${ticketId}/messages${qs ? `?${qs}` : ""}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load messages"));
  return (await res.json()) as { messages: SupportMessageRow[] };
}

export async function postSupportTicketMessage(
  ticketId: number,
  payload: { body: string; is_internal?: boolean; file?: File | null },
) {
  const form = new FormData();
  form.append("body", payload.body);
  if (payload.is_internal) form.append("is_internal", "true");
  if (payload.file) form.append("attachment", payload.file);

  const res = await fetch(
    `${getApiBase()}/api/support/tickets/${ticketId}/messages`,
    await withAuthFormData({ method: "POST", body: form }),
  );
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot send message"));
  return (await res.json()) as { message: SupportMessageRow; ticket: SupportTicketRow };
}

export async function listSupportStaffUsers() {
  const res = await fetch(`${getApiBase()}/api/support/staff-users`, { credentials: "include", cache: "no-store" });
  if (!res.ok) throw new Error(await extractApiError(res, "Cannot load staff"));
  return (await res.json()) as { results: Array<{ id: number; username: string }> };
}
