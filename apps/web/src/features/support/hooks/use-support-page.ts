"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupportStatusFilter } from "@/features/support/model/support-ticket-meta";
import { upsertMessage, upsertTicket } from "@/features/support/model/support-ticket-store";
import {
  createSupportTicket,
  getSupportCategories,
  getSupportTicket,
  listSupportTicketMessages,
  listSupportTickets,
  patchSupportTicket,
  postSupportTicketMessage,
  type SupportMessageRow,
  type SupportTicketRow,
} from "@/lib/api";

export type SupportScreen = "list" | "chat";

type UseSupportPageOptions = {
  onError: (code: string) => void;
};

const CHAT_POLL_MS = 12_000;

export function useSupportPage({ onError }: UseSupportPageOptions) {
  const [screen, setScreen] = useState<SupportScreen>("list");
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
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

  const [categories, setCategories] = useState<Array<{ id: string; label: string }>>([]);
  const [createSubject, setCreateSubject] = useState("");
  const [createCategory, setCreateCategory] = useState("general");
  const [createBody, setCreateBody] = useState("");
  const [creating, setCreating] = useState(false);

  const upsertListTicket = useCallback((row: SupportTicketRow) => {
    setTickets((prev) => upsertTicket(prev, row));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const refreshList = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await listSupportTickets({ status: statusFilter, search: debouncedSearch, limit: 80 });
      setTickets(data.results);
    } catch (e) {
      onError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoadingList(false);
    }
  }, [debouncedSearch, onError, statusFilter]);

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
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (screen !== "chat" || chatTicketId == null) return;
    const id = window.setInterval(() => void loadChat(chatTicketId, { silent: true }), CHAT_POLL_MS);
    return () => window.clearInterval(id);
  }, [chatTicketId, loadChat, screen]);

  const sendReply = useCallback(async () => {
    const body = compose.trim();
    if ((!body && !pendingFile) || chatTicketId == null) return;
    setSending(true);
    try {
      const res = await postSupportTicketMessage(chatTicketId, { body, file: pendingFile });
      setMessages((prev) => upsertMessage(prev, res.message));
      setTicket(res.ticket);
      upsertListTicket(res.ticket);
      setCompose("");
      setPendingFile(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "send_failed";
      onError(msg.includes("attachment") ? msg : "send_failed");
    } finally {
      setSending(false);
    }
  }, [chatTicketId, compose, onError, pendingFile, upsertListTicket]);

  const patchTicket = useCallback(
    async (field: string, value: unknown) => {
      if (chatTicketId == null) return;
      try {
        const res = await patchSupportTicket(chatTicketId, { [field]: value } as Parameters<typeof patchSupportTicket>[1]);
        setTicket(res.ticket);
        upsertListTicket(res.ticket);
      } catch (e) {
        onError(e instanceof Error ? e.message : "update_failed");
      }
    },
    [chatTicketId, onError, upsertListTicket],
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
    screen,
    tickets,
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
    compose,
    pendingFile,
    sending,
    setCompose,
    setPendingFile,
    openChat,
    backToList,
    sendReply,
    patchTicket,
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
