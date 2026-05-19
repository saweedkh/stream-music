"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Headphones,
  LifeBuoy,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Search,
  Send,
  Shield,
  X,
} from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast-provider";
import { UsernameWithBadges } from "@/components/ui/user-verified-badge";
import { useSupportStaffInboxSocket } from "@/hooks/use-support-staff-inbox-socket";
import { useSupportTicketSocket } from "@/hooks/use-support-ticket-socket";
import {
  createSupportTicket,
  getSupportCategories,
  getSupportTicket,
  listSupportStaffUsers,
  listSupportTicketMessages,
  listSupportTickets,
  patchSupportTicket,
  postSupportTicketMessage,
  type AuthUser,
  type SupportInboxStats,
  type SupportMessageRow,
  type SupportTicketPriority,
  type SupportTicketRow,
  type SupportTicketStatus,
} from "@/lib/api";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

const STATUS_KEYS: Record<SupportTicketStatus, MessageKey> = {
  open: "support.status.open",
  in_progress: "support.status.in_progress",
  waiting_user: "support.status.waiting_user",
  waiting_staff: "support.status.waiting_staff",
  resolved: "support.status.resolved",
  closed: "support.status.closed",
};

const PRIORITY_KEYS: Record<SupportTicketPriority, MessageKey> = {
  low: "support.priority.low",
  normal: "support.priority.normal",
  high: "support.priority.high",
  urgent: "support.priority.urgent",
};

const STATUS_FILTERS = ["all", "open", "waiting_staff", "waiting_user", "in_progress", "resolved", "closed"] as const;

function statusVariant(status: SupportTicketStatus): "default" | "success" | "warning" | "secondary" {
  if (status === "closed" || status === "resolved") return "secondary";
  if (status === "waiting_staff") return "warning";
  if (status === "in_progress") return "success";
  return "default";
}

function priorityVariant(priority: SupportTicketPriority): "default" | "success" | "warning" | "secondary" {
  if (priority === "urgent") return "warning";
  if (priority === "high") return "warning";
  if (priority === "low") return "secondary";
  return "default";
}

function upsertTicket(list: SupportTicketRow[], row: SupportTicketRow): SupportTicketRow[] {
  const i = list.findIndex((t) => t.id === row.id);
  const next = i === -1 ? [row, ...list] : list.map((t) => (t.id === row.id ? { ...t, ...row } : t));
  return [...next].sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return tb - ta;
  });
}

function upsertMessage(list: SupportMessageRow[], msg: SupportMessageRow): SupportMessageRow[] {
  const i = list.findIndex((m) => m.id === msg.id);
  if (i === -1) return [...list, msg].sort((a, b) => a.id - b.id);
  const copy = [...list];
  copy[i] = msg;
  return copy;
}

function formatMessageTime(iso: string | null, locale: string): string {
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

type SupportHubProps = {
  user: AuthUser | null;
};

export function SupportHub({ user }: SupportHubProps) {
  const { t, locale } = useTranslations();
  const { showToast } = useToast();
  const isStaff = Boolean(user?.is_staff || user?.is_superuser);

  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [stats, setStats] = useState<SupportInboxStats | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [activeTicket, setActiveTicket] = useState<SupportTicketRow | null>(null);
  const [messages, setMessages] = useState<SupportMessageRow[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; label: string }>>([]);
  const [staffUsers, setStaffUsers] = useState<Array<{ id: number; username: string }>>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [compose, setCompose] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newBody, setNewBody] = useState("");
  const [creating, setCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedTicket = useMemo(
    () => tickets.find((x) => x.id === selectedId) ?? activeTicket,
    [activeTicket, selectedId, tickets],
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadTickets = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await listSupportTickets({ status: statusFilter, search: debouncedSearch, limit: 80 });
      setTickets(data.results);
      if (data.stats) setStats(data.stats);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("support.loadFailed"), "error");
    } finally {
      setLoadingList(false);
    }
  }, [debouncedSearch, showToast, statusFilter, t]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    void getSupportCategories()
      .then((r) => {
        setCategories(r.categories);
        if (r.categories.length > 0) setNewCategory((prev) => prev || r.categories[0].id);
      })
      .catch(() => {});
    if (isStaff) {
      void listSupportStaffUsers()
        .then((r) => setStaffUsers(r.results))
        .catch(() => {});
    }
  }, [isStaff]);

  const openTicket = useCallback(
    async (ticket: SupportTicketRow) => {
      setSelectedId(ticket.id);
      setActiveTicket(ticket);
      setLoadingMessages(true);
      try {
        const [detail, msgs] = await Promise.all([
          getSupportTicket(ticket.id),
          listSupportTicketMessages(ticket.id, { limit: 120 }),
        ]);
        setActiveTicket(detail.ticket);
        setTickets((prev) => upsertTicket(prev, detail.ticket));
        setMessages(msgs.messages.sort((a, b) => a.id - b.id));
      } catch (e) {
        showToast(e instanceof Error ? e.message : t("support.loadFailed"), "error");
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    },
    [showToast, t],
  );

  const handleSocketPayload = useCallback(
    (raw: unknown) => {
      if (!raw || typeof raw !== "object") return;
      const o = raw as Record<string, unknown>;
      const type = String(o.type || "");

      if (type === "SUPPORT_SYNC") {
        const ticket = o.ticket as SupportTicketRow | undefined;
        const msgs = Array.isArray(o.messages) ? (o.messages as SupportMessageRow[]) : [];
        if (ticket) {
          setActiveTicket(ticket);
          setTickets((prev) => upsertTicket(prev, ticket));
        }
        if (msgs.length) setMessages(msgs.sort((a, b) => a.id - b.id));
        return;
      }

      if (type === "SUPPORT_EVENT") {
        const ticket = o.ticket as SupportTicketRow | undefined;
        const msg = o.message as SupportMessageRow | undefined;
        if (ticket) {
          setActiveTicket((prev) => (prev?.id === ticket.id ? { ...prev, ...ticket } : prev));
          setTickets((prev) => upsertTicket(prev, ticket));
        }
        if (msg?.id) setMessages((prev) => upsertMessage(prev, msg));
        return;
      }

      if (type === "SUPPORT_HISTORY") {
        const older = Array.isArray(o.messages) ? (o.messages as SupportMessageRow[]) : [];
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const merged = [...older.filter((m) => !ids.has(m.id)), ...prev];
          return merged.sort((a, b) => a.id - b.id);
        });
        return;
      }

      if (type === "SUPPORT_ERROR") {
        showToast(String(o.code || t("support.sendFailed")), "error");
      }
    },
    [showToast, t],
  );

  const { socketState, send } = useSupportTicketSocket({
    ticketId: selectedId,
    enabled: selectedId != null,
    onMessage: handleSocketPayload,
  });

  useSupportStaffInboxSocket({
    enabled: isStaff,
    onMessage: (raw) => {
      if (!raw || typeof raw !== "object") return;
      const o = raw as Record<string, unknown>;
      if (o.type === "SUPPORT_INBOX" && o.ticket) {
        setTickets((prev) => upsertTicket(prev, o.ticket as SupportTicketRow));
      }
      if (o.type === "SUPPORT_INBOX_SYNC" && o.stats) {
        setStats(o.stats as SupportInboxStats);
      }
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, selectedId, loadingMessages]);

  async function handleCreateTicket() {
    const subject = newSubject.trim();
    const body = newBody.trim();
    if (!subject || !body) return;
    setCreating(true);
    try {
      const res = await createSupportTicket({ subject, category: newCategory, body });
      setTickets((prev) => upsertTicket(prev, res.ticket));
      setShowCreate(false);
      setNewSubject("");
      setNewBody("");
      showToast(t("support.ticketCreated"), "success");
      await openTicket(res.ticket);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("support.createFailed"), "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleSend() {
    const body = compose.trim();
    if (!body || selectedId == null) return;
    setSending(true);
    try {
      const payload = { action: "send", body, is_internal: internalNote && isStaff };
      const viaSocket = send(payload);
      if (!viaSocket) {
        const res = await postSupportTicketMessage(selectedId, {
          body,
          is_internal: internalNote && isStaff,
        });
        setMessages((prev) => upsertMessage(prev, res.message));
        setActiveTicket(res.ticket);
        setTickets((prev) => upsertTicket(prev, res.ticket));
      }
      setCompose("");
      if (internalNote) setInternalNote(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("support.sendFailed"), "error");
    } finally {
      setSending(false);
    }
  }

  async function patchField(field: string, value: unknown) {
    if (selectedId == null) return;
    const viaSocket = isStaff && send({ action: "patch_ticket", [field]: value });
    if (viaSocket) return;
    try {
      const res = await patchSupportTicket(selectedId, { [field]: value } as Parameters<typeof patchSupportTicket>[1]);
      setActiveTicket(res.ticket);
      setTickets((prev) => upsertTicket(prev, res.ticket));
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("support.updateFailed"), "error");
    }
  }

  const closed = selectedTicket?.status === "closed";

  const connectionLabel =
    socketState === "connected"
      ? t("support.connected")
      : socketState === "connecting" || socketState === "reconnecting"
        ? t("support.connecting")
        : t("support.offline");

  return (
    <div className="flex flex-1 flex-col max-lg:overflow-visible md:rounded-xl md:border md:border-border/60 md:bg-card/30 md:shadow-sm lg:min-h-0 lg:flex-row lg:overflow-hidden">
      {/* Sidebar — ticket list */}
      <aside className="flex w-full shrink-0 flex-col max-lg:overflow-visible max-lg:border-b max-lg:border-border/50 lg:max-w-[20rem] lg:min-h-0 lg:overflow-hidden lg:border-b-0 lg:border-e max-lg:max-h-none md:max-h-[min(42vh,20rem)] md:overflow-hidden">
        <div className="shrink-0 space-y-3 border-b border-border/50 bg-muted/10 px-4 py-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold tracking-tight">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand/25 bg-brand/10 text-brand">
                  <LifeBuoy className="h-4 w-4" aria-hidden />
                </span>
                {t("support.title")}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {isStaff ? t("support.staffSubtitle") : t("support.userSubtitle")}
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="shrink-0"
              onClick={() => void loadTickets()}
              aria-label={t("common.refresh")}
            >
              <RefreshCw className={cn("h-4 w-4", loadingList && "animate-spin")} />
            </Button>
          </div>

          {isStaff && stats ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("support.stats.waiting")}
                </p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{stats.waiting_staff}</p>
              </div>
              <div className="rounded-lg border border-brand/25 bg-brand/10 px-2.5 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("support.stats.active")}
                </p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{stats.total_active}</p>
              </div>
            </div>
          ) : null}

          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              className="h-9 bg-background/80 ps-9 text-sm"
              placeholder={t("support.search")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pb-0.5">
            <div className="flex w-max gap-1.5">
              {STATUS_FILTERS.map((st) => (
                <Button
                  key={st}
                  type="button"
                  size="sm"
                  variant={statusFilter === st ? "default" : "outline"}
                  className={cn(
                    "h-7 shrink-0 rounded-full px-3 text-xs",
                    statusFilter === st && "bg-brand text-brand-foreground hover:bg-brand-strong",
                  )}
                  onClick={() => setStatusFilter(st)}
                >
                  {st === "all" ? t("support.filter.all") : t(STATUS_KEYS[st as SupportTicketStatus])}
                </Button>
              ))}
            </div>
          </div>

          <Button
            type="button"
            className="w-full gap-2 bg-brand text-brand-foreground hover:bg-brand-strong"
            onClick={() => setShowCreate((v) => !v)}
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden />
            {t("support.newTicket")}
          </Button>
        </div>

        {showCreate ? (
          <div className="shrink-0 border-b border-border/50 bg-muted/5 px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">{t("support.createFormTitle")}</p>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowCreate(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <form
              className="space-y-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreateTicket();
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="support-new-subject" className="text-xs">
                  {t("support.subject")}
                </Label>
                <Input
                  id="support-new-subject"
                  className="h-9 bg-background/80 text-sm"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="support-new-category" className="text-xs">
                  {t("support.category")}
                </Label>
                <Select
                  id="support-new-category"
                  className="h-9 text-sm"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="support-new-body" className="text-xs">
                  {t("support.messagePlaceholder")}
                </Label>
                <textarea
                  id="support-new-body"
                  className="min-h-[4.5rem] w-full resize-y rounded-lg border border-border/90 bg-background/80 px-3 py-2 text-sm text-foreground shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                />
              </div>
              <Button type="submit" size="sm" className="w-full" disabled={creating || !newSubject.trim() || !newBody.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : t("support.submitTicket")}
              </Button>
            </form>
          </div>
        ) : null}

        <div className="flex-1 max-lg:overflow-visible lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain px-2 py-2">
          {loadingList ? (
            <div className="space-y-2 p-1">
              <Skeleton className="h-[4.5rem] rounded-xl" />
              <Skeleton className="h-[4.5rem] rounded-xl" />
              <Skeleton className="h-[4.5rem] rounded-xl" />
            </div>
          ) : tickets.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t("support.emptyList")}</p>
          ) : (
            <ul className="space-y-1">
              {tickets.map((tk) => {
                const active = tk.id === selectedId;
                return (
                  <li key={tk.id}>
                    <button
                      type="button"
                      onClick={() => void openTicket(tk)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2.5 text-start transition-all",
                        active
                          ? "border-brand/45 bg-brand/12 shadow-sm shadow-brand/10"
                          : "border-transparent bg-transparent hover:border-border/60 hover:bg-muted/20",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{tk.subject}</span>
                        {tk.unread_count > 0 ? (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-foreground">
                            {tk.unread_count > 9 ? "9+" : tk.unread_count}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{tk.reference}</p>
                      {isStaff && tk.requester_username ? (
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">@{tk.requester_username}</p>
                      ) : null}
                      {tk.last_message_preview ? (
                        <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground/90">{tk.last_message_preview}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <Badge variant={statusVariant(tk.status)} className="text-[10px]">
                          {t(STATUS_KEYS[tk.status])}
                        </Badge>
                        {tk.priority !== "normal" ? (
                          <Badge variant={priorityVariant(tk.priority)} className="text-[10px]">
                            {t(PRIORITY_KEYS[tk.priority])}
                          </Badge>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Main — conversation */}
      <main className="flex min-w-0 flex-1 flex-col max-lg:overflow-visible lg:min-h-0 lg:overflow-hidden bg-background/40">
        {!selectedTicket ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-muted/20">
              <Headphones className="h-8 w-8 text-muted-foreground/60" aria-hidden />
            </span>
            <p className="max-w-xs text-sm text-muted-foreground">{t("support.selectTicket")}</p>
            <Button type="button" variant="secondary" className="gap-2" onClick={() => setShowCreate(true)}>
              <MessageSquarePlus className="h-4 w-4" />
              {t("support.newTicket")}
            </Button>
          </div>
        ) : (
          <>
            <header className="shrink-0 space-y-3 border-b border-border/50 px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display text-base font-semibold">{selectedTicket.subject}</h3>
                  <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{selectedTicket.reference}</p>
                  {isStaff && selectedTicket.requester_username ? (
                    <div className="mt-1.5">
                      <UsernameWithBadges
                        username={selectedTicket.requester_username}
                        flags={selectedTicket.requester}
                        size="xs"
                        usernameClassName="text-xs text-muted-foreground"
                      />
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-normal",
                      socketState === "connected" && "border-brand/40 text-brand",
                      socketState === "reconnecting" && "border-amber-500/40 text-amber-600",
                    )}
                  >
                    <span
                      className={cn(
                        "me-1.5 inline-block h-1.5 w-1.5 rounded-full",
                        socketState === "connected"
                          ? "bg-brand"
                          : socketState === "reconnecting"
                            ? "animate-pulse bg-amber-500"
                            : "bg-muted-foreground",
                      )}
                    />
                    {connectionLabel}
                  </Badge>
                  <Badge variant={statusVariant(selectedTicket.status)}>{t(STATUS_KEYS[selectedTicket.status])}</Badge>
                </div>
              </div>

              {isStaff ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{t("support.statusLabel")}</Label>
                    <Select
                      className="h-9 text-xs"
                      value={selectedTicket.status}
                      onChange={(e) => void patchField("status", e.target.value)}
                    >
                      {Object.keys(STATUS_KEYS).map((st) => (
                        <option key={st} value={st}>
                          {t(STATUS_KEYS[st as SupportTicketStatus])}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{t("support.priorityLabel")}</Label>
                    <Select
                      className="h-9 text-xs"
                      value={selectedTicket.priority}
                      onChange={(e) => void patchField("priority", e.target.value)}
                    >
                      {Object.keys(PRIORITY_KEYS).map((pr) => (
                        <option key={pr} value={pr}>
                          {t(PRIORITY_KEYS[pr as SupportTicketPriority])}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{t("support.assigneeLabel")}</Label>
                    <Select
                      className="h-9 text-xs"
                      value={selectedTicket.assigned_to_id != null ? String(selectedTicket.assigned_to_id) : ""}
                      onChange={(e) =>
                        void patchField("assigned_to_id", e.target.value ? Number(e.target.value) : null)
                      }
                    >
                      <option value="">{t("support.unassigned")}</option>
                      {staffUsers.map((su) => (
                        <option key={su.id} value={su.id}>
                          @{su.username}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              ) : !closed ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void patchField("status", "resolved")}>
                    {t("support.markResolved")}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void patchField("status", "closed")}>
                    {t("support.closeTicket")}
                  </Button>
                </div>
              ) : null}
            </header>

            <div className="flex-1 max-lg:overflow-visible lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain px-4 py-4 sm:px-5">
              {loadingMessages ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("support.loadingMessages")}
                </div>
              ) : messages.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">{t("support.noMessages")}</p>
              ) : (
                <ul className="space-y-3">
                  {messages.map((m) => (
                    <li
                      key={m.id}
                      className={cn(
                        "flex",
                        m.is_mine ? "justify-end" : "justify-start",
                        m.is_internal && "justify-center",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[min(100%,28rem)] rounded-2xl border px-3.5 py-2.5 text-sm shadow-sm",
                          m.is_internal
                            ? "border-amber-500/35 bg-amber-500/10"
                            : m.is_mine
                              ? "border-brand/35 bg-brand/12"
                              : "border-border/60 bg-card/80",
                        )}
                      >
                        <div className="mb-1.5 flex flex-wrap items-center gap-2">
                          <UsernameWithBadges
                            username={m.author?.username ?? "?"}
                            flags={m.author}
                            prefix=""
                            size="xs"
                            usernameClassName="text-[11px] font-semibold text-foreground"
                          />
                          {m.is_internal ? (
                            <Badge variant="warning" className="gap-0.5 text-[9px]">
                              <Shield className="h-3 w-3" aria-hidden />
                              {t("support.internal")}
                            </Badge>
                          ) : null}
                          <span className="ms-auto text-[10px] tabular-nums text-muted-foreground">
                            {formatMessageTime(m.created_at, locale)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap break-words leading-relaxed text-foreground">{m.body}</p>
                      </div>
                    </li>
                  ))}
                  <div ref={messagesEndRef} className="h-px shrink-0" aria-hidden />
                </ul>
              )}
            </div>

            {!closed ? (
              <footer className="shrink-0 space-y-2 border-t border-border/50 bg-muted/10 px-4 py-3 sm:px-5">
                {isStaff ? (
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <Switch checked={internalNote} onCheckedChange={setInternalNote} />
                    {t("support.internalNote")}
                  </label>
                ) : null}
                <div className="flex gap-2">
                  <textarea
                    className="min-h-[2.75rem] max-h-32 flex-1 resize-y rounded-xl border border-border/90 bg-background px-3 py-2 text-sm shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
                    placeholder={t("support.replyPlaceholder")}
                    value={compose}
                    onChange={(e) => setCompose(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="h-11 w-11 shrink-0 bg-brand text-brand-foreground hover:bg-brand-strong"
                    disabled={sending || !compose.trim()}
                    onClick={() => void handleSend()}
                    aria-label={t("support.replyPlaceholder")}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </footer>
            ) : (
              <p className="shrink-0 border-t border-border/50 px-4 py-3 text-center text-xs text-muted-foreground sm:px-5">
                {t("support.ticketClosed")}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
