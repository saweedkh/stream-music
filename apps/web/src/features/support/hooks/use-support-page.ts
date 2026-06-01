"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupportStatusFilter } from "@/features/support/model/support-ticket-meta";
import { parseSupportSocketPayload } from "@/features/support/model/support-socket-events";
import { upsertMessage, upsertTicket } from "@/features/support/model/support-ticket-store";
import {
  createSupportTicket,
  getSupportCategories,
  getSupportTicket,
  listSupportStaffUsers,
  listSupportTicketMessages,
  listSupportTickets,
  patchSupportTicket,
  postSupportTicketMessage,
  type SupportInboxStats,
  type SupportMessageRow,
  type SupportTicketPriority,
  type SupportTicketRow,
  type SupportTicketStatus,
} from "@/lib/api";
import { useSupportStaffInboxSocket } from "@/shared/hooks/use-support-staff-inbox-socket";
import { useSupportTicketSocket } from "@/shared/hooks/use-support-ticket-socket";

export type SupportPageMode = "user" | "staff";

export type SupportScreen = "list" | "chat";

type UseSupportPageOptions = {
  onError: (code: string) => void;
  mode?: SupportPageMode;
};

const CHAT_POLL_MS = 12_000;

export function useSupportPage({ onError, mode = "user" }: UseSupportPageOptions) {
  const isStaffMode = mode === "staff";
  const [screen, setScreen] = useState<SupportScreen>("list");
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [stats, setStats] = useState<SupportInboxStats | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupportStatusFilter>("all");

  const [chatTicketId, setChatTicketId] = useState<number | null>(null);
  const [ticket, setTicket] = useState<SupportTicketRow | null>(null);
  const [messages, setMessages] = useState<SupportMessageRow[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [compose, setCompose] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [internalNote, setInternalNote] = useState(false);
  const [staffUsers, setStaffUsers] = useState<Array<{ id: number; username: string }>>([]);
  const [patching, setPatching] = useState(false);

  const [categories, setCategories] = useState<Array<{ id: string; label: string }>>([]);
  const [createSubject, setCreateSubject] = useState("");
  const [createCategory, setCreateCategory] = useState("general");
  const [createBody, setCreateBody] = useState("");
  const [creating, setCreating] = useState(false);

  const upsertListTicket = useCallback((row: SupportTicketRow) => {
    setTickets((prev) => upsertTicket(prev, row));
  }, []);

  const handleTicketSocketMessage = useCallback(
    (payload: unknown) => {
      const parsed = parseSupportSocketPayload(payload);
      if (!parsed) return;

      if (parsed.kind === "sync") {
        if (parsed.ticket) {
          setTicket(parsed.ticket);
          upsertListTicket(parsed.ticket);
        }
        if (parsed.messages.length > 0) {
          setMessages(parsed.messages.sort((a, b) => a.id - b.id));
        }
        setLoadingChat(false);
        return;
      }

      if (parsed.kind === "event_message") {
        setMessages((prev) => upsertMessage(prev, parsed.message));
        if (parsed.ticket) {
          setTicket(parsed.ticket);
          upsertListTicket(parsed.ticket);
        }
        return;
      }

      if (parsed.kind === "event_ticket") {
        setTicket(parsed.ticket);
        upsertListTicket(parsed.ticket);
        return;
      }

      if (parsed.kind === "error") {
        onError(parsed.code);
      }
    },
    [onError, upsertListTicket],
  );

  const chatSocketEnabled = screen === "chat" && chatTicketId != null;
  const { socketState: chatSocketState, send: sendTicketSocket } = useSupportTicketSocket({
    ticketId: chatTicketId,
    onMessage: handleTicketSocketMessage,
    enabled: chatSocketEnabled,
  });

  const handleInboxSocketMessage = useCallback(
    (payload: unknown) => {
      const parsed = parseSupportSocketPayload(payload);
      if (!parsed) return;
      if (parsed.kind === "inbox" && parsed.ticket) {
        upsertListTicket(parsed.ticket);
      }
      if (parsed.kind === "inbox_sync") {
        setStats(parsed.stats);
      }
    },
    [upsertListTicket],
  );

  const inboxSocketEnabled = isStaffMode && screen === "list";
  const { socketState: inboxSocketState } = useSupportStaffInboxSocket({
    enabled: inboxSocketEnabled,
    onMessage: handleInboxSocketMessage,
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const refreshList = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await listSupportTickets({ status: statusFilter, search: debouncedSearch, limit: 80 });
      const rows = isStaffMode ? data.results : data.results.filter((row) => row.is_mine !== false);
      setTickets(rows);
      setStats(data.stats ?? null);
    } catch (e) {
      onError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoadingList(false);
    }
  }, [debouncedSearch, isStaffMode, onError, statusFilter]);

  useEffect(() => {
    if (!isStaffMode) return;
    void listSupportStaffUsers()
      .then((r) => setStaffUsers(r.results))
      .catch(() => {});
  }, [isStaffMode]);

  useEffect(() => {
    if (screen === "list") void refreshList();
  }, [refreshList, screen]);

  useEffect(() => {
    void getSupportCategories()
      .then((r) => {
        setCategories(r.categories);
        if (r.categories.length > 0) setCreateCategory((prev) => prev || r.categories[0].id);
      })
      .catch(() => {});
  }, []);

  const loadChat = useCallback(
    async (ticketId: number, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoadingChat(true);
      try {
        const [detail, msgs] = await Promise.all([
          getSupportTicket(ticketId),
          listSupportTicketMessages(ticketId, { limit: 120 }),
        ]);
        setTicket(detail.ticket);
        upsertListTicket(detail.ticket);
        setMessages(msgs.messages.sort((a, b) => a.id - b.id));
      } catch (e) {
        onError(e instanceof Error ? e.message : "load_failed");
      } finally {
        if (!opts?.silent) setLoadingChat(false);
      }
    },
    [onError, upsertListTicket],
  );

  const openChat = useCallback(
    async (row: SupportTicketRow) => {
      setChatTicketId(row.id);
      setScreen("chat");
      setCompose("");
      setPendingFile(null);
      setInternalNote(false);
      await loadChat(row.id);
    },
    [loadChat],
  );

  const backToList = useCallback(() => {
    setScreen("list");
    setChatTicketId(null);
    setTicket(null);
    setMessages([]);
    setCompose("");
    setPendingFile(null);
    setInternalNote(false);
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (screen !== "chat" || chatTicketId == null) return;
    if (chatSocketState === "connected") return;
    const id = window.setInterval(() => void loadChat(chatTicketId, { silent: true }), CHAT_POLL_MS);
    return () => window.clearInterval(id);
  }, [chatTicketId, chatSocketState, loadChat, screen]);

  const sendReply = useCallback(async () => {
    const body = compose.trim();
    if ((!body && !pendingFile) || chatTicketId == null) return;

    if (!pendingFile && body && chatSocketState === "connected") {
      setSending(true);
      try {
        const sent = sendTicketSocket({
          action: "send",
          body,
          is_internal: isStaffMode && internalNote,
        });
        if (sent) {
          setCompose("");
          if (isStaffMode) setInternalNote(false);
          return;
        }
      } finally {
        setSending(false);
      }
    }

    setSending(true);
    try {
      const res = await postSupportTicketMessage(chatTicketId, {
        body,
        file: pendingFile,
        is_internal: isStaffMode && internalNote,
      });
      setMessages((prev) => upsertMessage(prev, res.message));
      setTicket(res.ticket);
      upsertListTicket(res.ticket);
      setCompose("");
      setPendingFile(null);
      if (isStaffMode) setInternalNote(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "send_failed";
      onError(msg.includes("attachment") ? msg : "send_failed");
    } finally {
      setSending(false);
    }
  }, [
    chatSocketState,
    chatTicketId,
    compose,
    internalNote,
    isStaffMode,
    onError,
    pendingFile,
    sendTicketSocket,
    upsertListTicket,
  ]);

  const patchTicket = useCallback(
    async (field: string, value: unknown) => {
      if (chatTicketId == null) return;
      setPatching(true);
      try {
        const res = await patchSupportTicket(chatTicketId, { [field]: value } as Parameters<typeof patchSupportTicket>[1]);
        setTicket(res.ticket);
        upsertListTicket(res.ticket);
      } catch (e) {
        onError(e instanceof Error ? e.message : "update_failed");
      } finally {
        setPatching(false);
      }
    },
    [chatTicketId, onError, upsertListTicket],
  );

  const patchTicketFields = useCallback(
    async (fields: Partial<{ status: SupportTicketStatus; priority: SupportTicketPriority; assigned_to_id: number | null; category: string }>) => {
      if (chatTicketId == null) return;

      if (isStaffMode && chatSocketState === "connected") {
        setPatching(true);
        try {
          const sent = sendTicketSocket({ action: "patch_ticket", ...fields });
          if (sent) return;
        } finally {
          setPatching(false);
        }
      }

      setPatching(true);
      try {
        const res = await patchSupportTicket(chatTicketId, fields);
        setTicket(res.ticket);
        upsertListTicket(res.ticket);
      } catch (e) {
        onError(e instanceof Error ? e.message : "update_failed");
      } finally {
        setPatching(false);
      }
    },
    [chatSocketState, chatTicketId, isStaffMode, onError, sendTicketSocket, upsertListTicket],
  );

  const resetCreateForm = useCallback(() => {
    setCreateSubject("");
    setCreateBody("");
    if (categories.length > 0) setCreateCategory(categories[0].id);
  }, [categories]);

  const submitCreate = useCallback(async (): Promise<SupportTicketRow | null> => {
    const subject = createSubject.trim();
    const body = createBody.trim();
    if (!subject || !body) return null;
    setCreating(true);
    try {
      const res = await createSupportTicket({ subject, category: createCategory, body });
      upsertListTicket(res.ticket);
      resetCreateForm();
      return res.ticket;
    } catch (e) {
      onError(e instanceof Error ? e.message : "create_failed");
      return null;
    } finally {
      setCreating(false);
    }
  }, [createBody, createCategory, createSubject, onError, resetCreateForm, upsertListTicket]);

  return {
    mode,
    isStaffMode,
    screen,
    tickets,
    stats,
    loadingList,
    search,
    statusFilter,
    setSearch,
    setStatusFilter,
    refreshList,
    chatTicketId,
    ticket,
    messages,
    loadingChat,
    chatSocketState,
    inboxSocketState,
    compose,
    pendingFile,
    sending,
    patching,
    internalNote,
    staffUsers,
    setCompose,
    setPendingFile,
    setInternalNote,
    openChat,
    backToList,
    sendReply,
    patchTicket,
    patchTicketFields,
    categories,
    createSubject,
    createCategory,
    createBody,
    creating,
    setCreateSubject,
    setCreateCategory,
    setCreateBody,
    submitCreate,
  };
}
