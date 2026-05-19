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
} from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast-provider";
import { UsernameWithBadges } from "@/components/ui/user-verified-badge";
import { useSupportStaffInboxSocket } from "@/hooks/use-support-staff-inbox-socket";
import { useSupportTicketSocket } from "@/hooks/use-support-ticket-socket";
import {
  createSupportTicket,
  getSupportCategories,
  listSupportStaffUsers,
  listSupportTickets,
  patchSupportTicket,
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

function statusVariant(status: SupportTicketStatus): "default" | "success" | "warning" | "secondary" {
  if (status === "closed" || status === "resolved") return "secondary";
  if (status === "waiting_staff") return "warning";
  if (status === "in_progress") return "success";
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

type SupportHubProps = {
  user: AuthUser | null;
};

export function SupportHub({ user }: SupportHubProps) {
  const { t } = useTranslations();
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
  const [search, setSearch] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [compose, setCompose] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [newBody, setNewBody] = useState("");
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef<HTMLLIElement>(null);

  const selectedTicket = useMemo(
    () => tickets.find((x) => x.id === selectedId) ?? activeTicket,
    [activeTicket, selectedId, tickets],
  );

  const loadTickets = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await listSupportTickets({ status: statusFilter, search, limit: 80 });
      setTickets(data.results);
      if (data.stats) setStats(data.stats);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("support.loadFailed"), "error");
    } finally {
      setLoadingList(false);
    }
  }, [search, showToast, statusFilter, t]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    void getSupportCategories()
      .then((r) => setCategories(r.categories))
      .catch(() => {});
    if (isStaff) {
      void listSupportStaffUsers()
        .then((r) => setStaffUsers(r.results))
        .catch(() => {});
    }
  }, [isStaff]);

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
        setMessages(msgs);
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
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedId]);

  async function handleCreateTicket() {
    const subject = newSubject.trim();
    const body = newBody.trim();
    if (!subject || !body) return;
    setCreating(true);
    try {
      const res = await createSupportTicket({ subject, category: newCategory, body });
      setTickets((prev) => upsertTicket(prev, res.ticket));
      setSelectedId(res.ticket.id);
      setActiveTicket(res.ticket);
      setMessages([res.message]);
      setShowCreate(false);
      setNewSubject("");
      setNewBody("");
      showToast(t("support.ticketCreated"), "success");
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
    const payload = { action: "send", body, is_internal: internalNote && isStaff };
    const ok = send(payload);
    if (ok) {
      setCompose("");
      if (!internalNote) setInternalNote(false);
    } else {
      showToast(t("support.socketDisconnected"), "error");
    }
    setSending(false);
  }

  async function patchField(field: string, value: unknown) {
    if (selectedId == null) return;
    const viaSocket =
      isStaff &&
      send({ action: "patch_ticket", [field]: value });
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-5">
      <Card className="flex min-h-[28rem] w-full shrink-0 flex-col border-border/60 lg:max-w-sm lg:flex-1">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <LifeBuoy className="h-5 w-5 text-brand" aria-hidden />
                {t("support.title")}
              </CardTitle>
              <CardDescription>{isStaff ? t("support.staffSubtitle") : t("support.userSubtitle")}</CardDescription>
            </div>
            <Button size="sm" variant="secondary" onClick={() => void loadTickets()} aria-label={t("common.refresh")}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {isStaff && stats ? (
            <div className="flex flex-wrap gap-1.5 text-[10px]">
              <Badge variant="warning">{t("support.stats.waiting")}: {stats.waiting_staff}</Badge>
              <Badge variant="success">{t("support.stats.active")}: {stats.total_active}</Badge>
            </div>
          ) : null}
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-9"
              placeholder={t("support.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void loadTickets()}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {(["all", "open", "waiting_staff", "waiting_user", "in_progress", "resolved", "closed"] as const).map((st) => (
              <Button
                key={st}
                type="button"
                size="sm"
                variant={statusFilter === st ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setStatusFilter(st)}
              >
                {st === "all" ? t("support.filter.all") : t(STATUS_KEYS[st as SupportTicketStatus])}
              </Button>
            ))}
          </div>
          <Button type="button" className="w-full" onClick={() => setShowCreate((v) => !v)}>
            <MessageSquarePlus className="h-4 w-4 me-1.5" />
            {t("support.newTicket")}
          </Button>
          {showCreate ? (
            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-3">
              <Input
                placeholder={t("support.subject")}
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <textarea
                className="min-h-[5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={t("support.messagePlaceholder")}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
              />
              <Button type="button" size="sm" disabled={creating} onClick={() => void handleCreateTicket()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : t("support.submitTicket")}
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
          <ScrollArea className="h-[min(50vh,28rem)] px-3 pb-3">
            {loadingList ? (
              <div className="space-y-2 p-2">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
            ) : tickets.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">{t("support.emptyList")}</p>
            ) : (
              <ul className="space-y-1.5">
                {tickets.map((tk) => {
                  const active = tk.id === selectedId;
                  return (
                    <li key={tk.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(tk.id);
                          setMessages([]);
                          setActiveTicket(tk);
                        }}
                        className={cn(
                          "w-full rounded-xl border px-3 py-2.5 text-start transition-colors",
                          active
                            ? "border-brand/40 bg-brand/10"
                            : "border-border/50 bg-muted/10 hover:bg-muted/20",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{tk.subject}</span>
                          {tk.unread_count > 0 ? (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-brand-foreground">
                              {tk.unread_count}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {tk.reference}
                          {isStaff && tk.requester_username ? ` · @${tk.requester_username}` : ""}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <Badge variant={statusVariant(tk.status)} className="text-[10px]">
                            {t(STATUS_KEYS[tk.status])}
                          </Badge>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="flex min-h-[28rem] min-w-0 flex-1 flex-col border-border/60">
        {!selectedTicket ? (
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <Headphones className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t("support.selectTicket")}</p>
          </CardContent>
        ) : (
          <>
            <CardHeader className="space-y-3 border-b border-border/50 pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{selectedTicket.subject}</CardTitle>
                  <CardDescription>
                    {selectedTicket.reference}
                    {socketState === "connected" ? (
                      <span className="ms-2 text-brand">● {t("support.live")}</span>
                    ) : socketState === "reconnecting" ? (
                      <span className="ms-2 text-warning">… {t("support.reconnecting")}</span>
                    ) : null}
                  </CardDescription>
                  {isStaff && selectedTicket.requester_username ? (
                    <div className="mt-1">
                      <UsernameWithBadges
                        username={selectedTicket.requester_username}
                        flags={selectedTicket.requester}
                        size="xs"
                        usernameClassName="text-xs text-muted-foreground"
                      />
                    </div>
                  ) : null}
                </div>
                <Badge variant={statusVariant(selectedTicket.status)}>{t(STATUS_KEYS[selectedTicket.status])}</Badge>
              </div>
              {isStaff ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                    value={selectedTicket.status}
                    onChange={(e) => void patchField("status", e.target.value)}
                  >
                    {Object.keys(STATUS_KEYS).map((st) => (
                      <option key={st} value={st}>
                        {t(STATUS_KEYS[st as SupportTicketStatus])}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                    value={selectedTicket.priority}
                    onChange={(e) => void patchField("priority", e.target.value)}
                  >
                    {Object.keys(PRIORITY_KEYS).map((pr) => (
                      <option key={pr} value={pr}>
                        {t(PRIORITY_KEYS[pr as SupportTicketPriority])}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                    value={selectedTicket.assigned_to_id ?? ""}
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
                  </select>
                </div>
              ) : !closed ? (
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void patchField("status", "resolved")}>
                    {t("support.markResolved")}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void patchField("status", "closed")}>
                    {t("support.closeTicket")}
                  </Button>
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3 p-0">
              <ScrollArea className="min-h-0 flex-1 px-4 py-3">
                <ul className="space-y-3">
                  {messages.map((m) => (
                    <li
                      key={m.id}
                      className={cn(
                        "rounded-2xl border px-3 py-2.5 text-sm",
                        m.is_mine
                          ? "ms-8 border-brand/30 bg-brand/10"
                          : "me-8 border-border/60 bg-muted/15",
                        m.is_internal && "border-amber-500/30 bg-amber-500/10",
                      )}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <UsernameWithBadges
                          username={m.author?.username ?? "?"}
                          flags={m.author}
                          prefix=""
                          size="xs"
                          usernameClassName="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                        />
                        {m.is_internal ? (
                          <Badge variant="warning" className="text-[9px]">
                            <Shield className="h-3 w-3 me-0.5" />
                            {t("support.internal")}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="whitespace-pre-wrap break-words text-foreground">{m.body}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {m.created_at ? new Date(m.created_at).toLocaleString() : ""}
                      </p>
                    </li>
                  ))}
                  <li ref={scrollRef} />
                </ul>
              </ScrollArea>
              {!closed ? (
                <div className="border-t border-border/50 p-3 space-y-2">
                  {isStaff ? (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch checked={internalNote} onCheckedChange={setInternalNote} />
                      {t("support.internalNote")}
                    </label>
                  ) : null}
                  <div className="flex gap-2">
                    <textarea
                      className="min-h-[2.75rem] flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm"
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
                    <Button type="button" disabled={sending || !compose.trim()} onClick={() => void handleSend()}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="border-t border-border/50 p-3 text-center text-xs text-muted-foreground">
                  {t("support.ticketClosed")}
                </p>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
