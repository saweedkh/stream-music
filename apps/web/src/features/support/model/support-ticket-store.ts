import type { SupportMessageRow, SupportTicketRow } from "@/lib/api";

export function upsertTicket(list: SupportTicketRow[], row: SupportTicketRow): SupportTicketRow[] {
  const i = list.findIndex((t) => t.id === row.id);
  const next = i === -1 ? [row, ...list] : list.map((t) => (t.id === row.id ? { ...t, ...row } : t));
  return [...next].sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta;
  });
}

export function upsertMessage(list: SupportMessageRow[], msg: SupportMessageRow): SupportMessageRow[] {
  const i = list.findIndex((m) => m.id === msg.id);
  if (i === -1) return [...list, msg].sort((a, b) => a.id - b.id);
  const copy = [...list];
  copy[i] = msg;
  return copy;
}
