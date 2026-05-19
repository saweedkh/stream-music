"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Eraser,
  Loader2,
  Maximize2,
  MessageCircle,
  Minimize2,
  MoreHorizontal,
  Music,
  Pin,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslations } from "@/components/providers/locale-provider";
import { useToast } from "@/components/ui/toast-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { useReconnectingChannelChatSocket } from "@/hooks/use-reconnecting-channel-chat-socket";
import { UsernameWithBadges } from "@/components/ui/user-verified-badge";
import { getChannelMembers, getMe, type ChannelChatMessageRow, type ChannelChatReaction, type UserBadge } from "@/lib/api";
import type { UserBadgeFlags } from "@/lib/user-badges";
import { renderMessageWithMentions } from "@/lib/render-mentions";
import { channelChatHref, useNotificationStore } from "@/lib/notifications/store";
import { cn } from "@/lib/utils";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎵"] as const;

function parseBadge(raw: unknown): UserBadge | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.slug !== "string" || typeof o.label !== "string") return null;
  return {
    slug: o.slug,
    label: o.label,
    description: typeof o.description === "string" ? o.description : undefined,
    icon: typeof o.icon === "string" ? o.icon : "badge-check",
    color: typeof o.color === "string" ? o.color : "sky",
    priority: typeof o.priority === "number" ? o.priority : 100,
    is_system: Boolean(o.is_system),
  };
}

function parseBadgeFlags(o: Record<string, unknown>): UserBadgeFlags {
  const badges = Array.isArray(o.badges)
    ? o.badges.map(parseBadge).filter((b): b is UserBadge => b != null)
    : undefined;
  return {
    is_staff: Boolean(o.is_staff),
    is_superuser: Boolean(o.is_superuser),
    is_premium: Boolean(o.is_premium),
    badges,
  };
}

function parseMessage(raw: unknown): ChannelChatMessageRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "number" || typeof o.user_id !== "number" || typeof o.username !== "string") return null;
  if (typeof o.body !== "string" || typeof o.created_at !== "string") return null;
  const channel = typeof o.channel === "number" ? o.channel : Number(o.channel);
  if (!Number.isFinite(channel)) return null;
  const reactions: ChannelChatReaction[] = Array.isArray(o.reactions)
    ? o.reactions
        .map((r) => {
          if (!r || typeof r !== "object") return null;
          const x = r as Record<string, unknown>;
          if (typeof x.user_id !== "number" || typeof x.username !== "string" || typeof x.emoji !== "string") return null;
          return {
            user_id: x.user_id,
            username: x.username,
            emoji: x.emoji,
            ...parseBadgeFlags(x),
          } as ChannelChatReaction;
        })
        .filter((x): x is ChannelChatReaction => x != null)
    : [];
  return {
    id: o.id,
    channel,
    user_id: o.user_id,
    username: o.username,
    ...parseBadgeFlags(o),
    body: o.body,
    is_pinned: Boolean(o.is_pinned),
    pinned_at: typeof o.pinned_at === "string" ? o.pinned_at : o.pinned_at === null ? null : undefined,
    pinned_by_username: typeof o.pinned_by_username === "string" ? o.pinned_by_username : o.pinned_by_username === null ? null : undefined,
    created_at: o.created_at,
    edited_at: typeof o.edited_at === "string" ? o.edited_at : o.edited_at === null ? null : undefined,
    deleted_at: typeof o.deleted_at === "string" ? o.deleted_at : o.deleted_at === null ? null : undefined,
    reactions,
  } as ChannelChatMessageRow;
}

function sortMessages(a: ChannelChatMessageRow, b: ChannelChatMessageRow) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function upsertMessages(prev: ChannelChatMessageRow[], msg: ChannelChatMessageRow): ChannelChatMessageRow[] {
  const i = prev.findIndex((m) => m.id === msg.id);
  if (i === -1) return [...prev, msg].sort(sortMessages);
  const next = [...prev];
  next[i] = { ...msg, reactions: msg.reactions ?? [] };
  return next.sort(sortMessages);
}

function reactionSummary(reactions: ChannelChatReaction[] | undefined): { emoji: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of reactions ?? []) {
    map.set(r.emoji, (map.get(r.emoji) ?? 0) + 1);
  }
  return [...map.entries()].map(([emoji, count]) => ({ emoji, count }));
}

type Props = {
  channelId: string;
  channelIsActive: boolean;
  /** Connect after membership / auth is ready. */
  connectEnabled: boolean;
  variant: "admin" | "listener";
  /** Owner or moderator — can delete any message. */
  canModerate: boolean;
  /** Shown for "share now playing" shortcut. */
  nowPlayingLabel?: string | null;
  channelName?: string;
  /** When set, in-app chat alerts fire only if this tab is not active (or the tab is hidden). */
  roomActiveTab?: string | null;
  /** Fill the listener shell content area (dedicated chat tab). */
  fullHeight?: boolean;
};

export function ChannelChatPanel({
  channelId,
  channelIsActive,
  connectEnabled,
  variant,
  canModerate,
  nowPlayingLabel = null,
  channelName,
  roomActiveTab = null,
  fullHeight = false,
}: Props) {
  const { t } = useTranslations();
  const { showToast } = useToast();

  const chatErrorKey = (code: string): MessageKey => {
    const map: Record<string, MessageKey> = {
      invalid_body: "chat.error.invalid_body",
      channel_closed: "chat.error.channel_closed",
      forbidden: "chat.error.forbidden",
      not_found: "chat.error.not_found",
      invalid_emoji: "chat.error.invalid_emoji",
      auth: "chat.error.auth",
      rate_limited: "chat.error.rate_limited",
    };
    return map[code] ?? "chat.error.generic";
  };
  const searchParams = useSearchParams();
  const pushNotification = useNotificationStore((s) => s.push);
  const [messages, setMessages] = useState<ChannelChatMessageRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [myUsername, setMyUsername] = useState("");
  const [highlightMessageId, setHighlightMessageId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [openActionsId, setOpenActionsId] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pinnedMessage, setPinnedMessage] = useState<ChannelChatMessageRow | null>(null);
  const [showPinsOnly, setShowPinsOnly] = useState(false);
  const [roomMembers, setRoomMembers] = useState<Array<{ id: number; username: string }>>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const draftInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void getMe().then((res) => {
      setMyUserId(res?.user?.id ?? null);
      setMyUsername(res?.user?.username ?? "");
    });
  }, []);

  useEffect(() => {
    const raw = searchParams.get("message");
    if (!raw) return;
    const id = Number.parseInt(raw, 10);
    if (Number.isFinite(id)) setHighlightMessageId(id);
  }, [searchParams]);

  useEffect(() => {
    if (!connectEnabled) return;
    void getChannelMembers(channelId)
      .then((data) =>
        setRoomMembers(
          data.results
            .filter((m) => m.is_active)
            .map((m) => ({ id: m.user_id, username: m.username })),
        ),
      )
      .catch(() => setRoomMembers([]));
  }, [channelId, connectEnabled]);

  useEffect(() => {
    const onFs = () => {
      const fs =
        document.fullscreenElement ??
        (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ??
        null;
      setIsFullscreen(fs === shellRef.current);
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs as EventListener);
    };
  }, []);

  async function toggleFullscreen() {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen?.();
        const doc = document as Document & { webkitExitFullscreen?: () => void };
        doc.webkitExitFullscreen?.();
      } else {
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else {
          const hel = el as unknown as { webkitRequestFullscreen?: () => void };
          hel.webkitRequestFullscreen?.();
        }
      }
    } catch {
      showToast(t("chat.toast.fullscreenBlocked"), "error");
    }
  }

  const handleChatPayload = useCallback(
    (payload: unknown) => {
      const data = (payload ?? {}) as Record<string, unknown>;
      const type = String(data.type ?? "").toUpperCase();
      if (type === "CHAT_ERROR") {
        const code = String(data.code ?? "error");
        showToast(t(chatErrorKey(code)), "error");
        return;
      }
      if (type === "CHAT_SYNC") {
        const raw = data.messages;
        if (!Array.isArray(raw)) return;
        const rows = raw.map(parseMessage).filter(Boolean) as ChannelChatMessageRow[];
        const sorted = rows.sort(sortMessages);
        setMessages(sorted);
        setPinnedMessage(sorted.find((m) => m.is_pinned) ?? null);
        setHydrated(true);
        return;
      }
      if (type === "CHAT_HISTORY") {
        const raw = data.messages;
        if (!Array.isArray(raw)) return;
        const rows = raw.map(parseMessage).filter(Boolean) as ChannelChatMessageRow[];
        setMessages((prev) => {
          const map = new Map<number, ChannelChatMessageRow>();
          for (const m of prev) map.set(m.id, m);
          for (const r of rows) map.set(r.id, r);
          return [...map.values()].sort(sortMessages);
        });
        setLoadingOlder(false);
        return;
      }
      if (type === "CHAT_EVENT") {
        const msg = parseMessage(data.message);
        if (msg) {
          setMessages((prev) => upsertMessages(prev, msg));
          if (msg.is_pinned) setPinnedMessage(msg);
          if (myUserId != null && msg.user_id !== myUserId && !msg.deleted_at) {
            const onChatTab = roomActiveTab === "chat" || roomActiveTab == null;
            const shouldNotify = document.hidden || !onChatTab;
            if (shouldNotify) {
              const preview = msg.body.trim().replace(/\n/g, " ");
              pushNotification({
                category: "chat",
                title: channelName ? `${channelName}` : `Room #${channelId}`,
                body: `${msg.username}: ${preview.slice(0, 140)}`,
                href: channelChatHref(channelId, msg.id),
                channelId,
                messageId: msg.id,
                chatBody: msg.body,
                myUsername,
              });
            }
          }
        }
        return;
      }
      if (type === "CHAT_PINNED") {
        const msg = parseMessage(data.message);
        setPinnedMessage(msg);
        return;
      }
      if (type === "CHAT_PURGED") {
        setMessages([]);
        setPinnedMessage(null);
        return;
      }
    },
    [channelId, channelName, myUserId, myUsername, pushNotification, roomActiveTab, showToast, t],
  );

  const { chatSocketState, sendChat } = useReconnectingChannelChatSocket({
    channelId,
    onMessage: handleChatPayload,
    enabled: connectEnabled,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, hydrated]);

  useEffect(() => {
    if (highlightMessageId == null || !hydrated) return;
    const frame = window.requestAnimationFrame(() => {
      const el = document.getElementById(`chat-msg-${highlightMessageId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timer = window.setTimeout(() => setHighlightMessageId(null), 4500);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [highlightMessageId, hydrated, messages]);

  const connected = chatSocketState === "connected";

  const mentionCandidates = roomMembers.filter((m) => {
    if (myUserId != null && m.id === myUserId) return false;
    const q = mentionQuery.toLowerCase();
    return !q || m.username.toLowerCase().includes(q);
  });

  const visibleMessages = showPinsOnly ? messages.filter((m) => m.is_pinned && !m.deleted_at) : messages;

  function insertMention(username: string) {
    const at = draft.lastIndexOf("@");
    const prefix = at >= 0 ? draft.slice(0, at) : draft;
    setDraft(`${prefix}@${username} `);
    setMentionOpen(false);
    setMentionQuery("");
    draftInputRef.current?.focus();
  }

  function shareNowPlayingInChat() {
    if (!nowPlayingLabel?.trim() || !channelIsActive) return;
    const text = `🎵 Now playing: ${nowPlayingLabel.trim()}`;
    setDraft((d) => (d.trim() ? `${d} ${text}` : text));
    draftInputRef.current?.focus();
  }

  const requestOlder = useCallback(() => {
    if (!messages.length || loadingOlder || !connected) return;
    const oldest = messages[0];
    if (!oldest?.id) return;
    setLoadingOlder(true);
    const ok = sendChat({ action: "history", before: oldest.id, limit: 40 });
    if (!ok) {
      setLoadingOlder(false);
      showToast(t("chat.toast.offlineLoadOlder"), "error");
    }
  }, [connected, loadingOlder, messages, sendChat, showToast, t]);

  function submitSend() {
    const text = draft.trim();
    if (!text || !channelIsActive || sending || !connected) return;
    setSending(true);
    try {
      const ok = sendChat({ action: "send", body: text });
      if (ok) setDraft("");
      else showToast(t("chat.toast.offline"), "error");
    } finally {
      setSending(false);
    }
  }

  function submitEdit() {
    if (editingId == null || !connected) return;
    const text = editDraft.trim();
    if (!text) return;
    const ok = sendChat({ action: "edit", message_id: editingId, body: text });
    if (!ok) showToast(t("chat.toast.offline"), "error");
    setEditingId(null);
    setEditDraft("");
  }

  function confirmDelete(id: number) {
    if (!connected) return;
    if (!window.confirm(t("chat.confirm.delete"))) return;
    const ok = sendChat({ action: "delete", message_id: id });
    if (!ok) showToast(t("chat.toast.offline"), "error");
    setOpenActionsId(null);
  }

  function toggleReaction(messageId: number, emoji: string) {
    if (!connected) return;
    const msg = messages.find((m) => m.id === messageId);
    const mine = msg?.reactions?.find((r) => r.user_id === myUserId);
    const nextEmoji = mine?.emoji === emoji ? "" : emoji;
    sendChat({ action: "react", message_id: messageId, emoji: nextEmoji });
  }

  function confirmPurgeAll() {
    if (!connected || !canModerate) return;
    if (!window.confirm(t("chat.confirm.purge"))) return;
    const ok = sendChat({ action: "purge_all" });
    if (!ok) showToast(t("chat.toast.offline"), "error");
  }

  function setPin(messageId: number | null) {
    if (!connected || !canModerate) return;
    const ok = sendChat({ action: "pin", message_id: messageId ?? null });
    if (!ok) showToast("Chat offline.", "error");
  }

  const shellClass =
    variant === "listener"
      ? cn(
          "relative overflow-hidden border border-border/60 bg-gradient-to-br from-background/95 via-[var(--brand-subtle)] to-background/95 backdrop-blur-2xl",
          fullHeight
            ? cn(
                "flex h-full min-h-0 max-h-full flex-1 flex-col rounded-2xl",
                "shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_20px_60px_-24px_rgba(0,0,0,0.75)]",
                "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:bg-[radial-gradient(700px_circle_at_20%_-10%,rgba(52,211,153,0.1),transparent_50%)]",
              )
            : cn(
                "rounded-3xl",
                "shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_25px_80px_-20px_rgba(0,0,0,0.85)]",
                "before:pointer-events-none before:absolute before:inset-0 before:rounded-3xl before:bg-[radial-gradient(800px_circle_at_20%_-10%,rgba(52,211,153,0.12),transparent_45%)]",
              ),
        )
      : "overflow-hidden rounded-2xl border border-border/80 bg-card/50 shadow-lg shadow-black/25";

  const headerTitle = variant === "listener" ? t("chat.title.listener") : t("chat.title.admin");
  const headerSubtitle = variant === "listener" ? t("chat.subtitle.listener") : t("chat.subtitle.admin");

  const scrollMinH = fullHeight
    ? "min-h-0 flex-1"
    : variant === "listener"
      ? "min-h-[min(420px,52vh)] h-[min(420px,52vh)]"
      : "h-[min(280px,40vh)]";
  const scrollAreaClass = cn(
    "rounded-2xl border",
    isFullscreen || fullHeight ? "min-h-0 flex-1 basis-0" : scrollMinH,
    variant === "listener" ? "border-border/40 bg-[var(--surface-inset)]" : "border-border/60 bg-card/60",
  );

  return (
    <div
      ref={shellRef}
      id="channel-chat-panel"
      className={cn(
        shellClass,
        (isFullscreen || fullHeight) && "flex min-h-0 max-h-full flex-1 flex-col overflow-hidden shadow-none",
        isFullscreen && "rounded-none",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-start gap-3 border-b px-4 sm:px-5",
          fullHeight ? "py-3" : "py-3",
          variant === "listener" ? "border-border/40 bg-[var(--surface-inset)]" : "border-border/70",
        )}
      >
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
            variant === "listener"
              ? "border-brand/30 bg-brand/10 text-brand"
              : "border-brand/25 bg-[var(--brand-subtle)] text-brand",
          )}
        >
          <MessageCircle className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{headerTitle}</h2>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                connected ? "bg-brand/15 text-brand" : "bg-amber-500/15 text-warning",
              )}
            >
              {connected
                ? t("chat.status.live")
                : chatSocketState === "closed"
                  ? t("common.offline")
                  : t("common.connecting")}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{headerSubtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 self-start pt-0.5">
          {!fullHeight ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground hover:text-foreground"
              aria-label={isFullscreen ? t("chat.fullscreen.exit") : t("chat.fullscreen.enter")}
              onClick={() => void toggleFullscreen()}
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={showPinsOnly ? "secondary" : "ghost"}
            size="sm"
            className="h-9 gap-1 text-xs"
            onClick={() => setShowPinsOnly((v) => !v)}
            title={t("chat.pinsOnlyTitle")}
          >
            <Pin className="size-3.5" />
            <span className="hidden sm:inline">{t("chat.pinsOnly")}</span>
          </Button>
          {nowPlayingLabel ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 gap-1 text-xs text-brand/90"
              disabled={!channelIsActive}
              onClick={() => shareNowPlayingInChat()}
            >
              <Music className="size-3.5" />
              <span className="hidden sm:inline">{t("chat.nowPlaying")}</span>
            </Button>
          ) : null}
          {canModerate ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 text-xs text-warning/95 hover:bg-amber-950/40 hover:text-amber-100"
              disabled={!connected}
              onClick={() => void confirmPurgeAll()}
            >
              <Eraser className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">{t("chat.clearAll")}</span>
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-2",
          fullHeight ? "gap-2 p-3 sm:p-4" : "p-3 sm:p-4",
          variant === "listener" && !fullHeight && "sm:p-5",
          (isFullscreen || fullHeight) && "min-h-0 flex-1 overflow-hidden",
        )}
      >
        {pinnedMessage ? (
          <div className="shrink-0 rounded-xl border border-brand/25 bg-[var(--brand-subtle)] px-3 py-2 text-xs text-brand">
            <p className="font-semibold uppercase tracking-wide text-brand/90">{t("chat.pinnedLabel")}</p>
            <p className="mt-1 line-clamp-2">{pinnedMessage.body}</p>
          </div>
        ) : null}
        {messages.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 self-center text-xs text-muted-foreground hover:text-foreground"
            disabled={loadingOlder || !connected}
            onClick={() => void requestOlder()}
          >
            {loadingOlder ? <Loader2 className="size-3.5 animate-spin" /> : t("chat.loadOlder")}
          </Button>
        ) : null}

        <ScrollArea className={cn(scrollAreaClass, fullHeight && "min-h-0 flex-1")}>
          <div className="space-y-3 p-3 pr-2 sm:p-4">
            {!hydrated && connectEnabled ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-brand/60" />
                <span>{t("chat.joining")}</span>
              </div>
            ) : visibleMessages.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">{t("chat.empty")}</p>
            ) : (
              visibleMessages.map((m) => {
                const mine = myUserId != null && m.user_id === myUserId;
                const deleted = Boolean(m.deleted_at);
                const canEdit = mine && !deleted && channelIsActive;
                const canDelete = (mine || canModerate) && !deleted && channelIsActive;
                const summary = reactionSummary(m.reactions);
                const showActions = openActionsId === m.id;

                return (
                  <div
                    key={m.id}
                    id={`chat-msg-${m.id}`}
                    className={cn(
                      "group relative scroll-mt-24 rounded-lg transition-colors",
                      highlightMessageId === m.id && "ring-2 ring-brand/70 ring-offset-2 ring-offset-background",
                    )}
                  >
                    <div className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "relative max-w-[min(92%,28rem)] rounded-2xl border px-3.5 py-2.5 text-sm shadow-md transition-[box-shadow,transform]",
                          mine
                            ? "border-brand/35 bg-[var(--brand-subtle)] text-brand-foreground"
                            : variant === "listener"
                              ? "border-white/[0.07] bg-card/70 text-foreground"
                              : "border-border/60 bg-card/85 text-foreground",
                          variant === "listener" && mine && "shadow-brand/20",
                        )}
                      >
                        {!mine ? (
                          <div className="mb-1">
                            <UsernameWithBadges
                              username={m.username}
                              flags={m}
                              prefix=""
                              size="xs"
                              usernameClassName="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground"
                            />
                          </div>
                        ) : null}
                        {editingId === m.id ? (
                          <div className="space-y-2">
                            <Input
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              maxLength={2000}
                              className="border-border bg-card/80 text-sm"
                            />
                            <div className="flex justify-end gap-2">
                              <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                {t("common.cancel")}
                              </Button>
                              <Button type="button" size="sm" onClick={() => void submitEdit()}>
                                {t("common.save")}
                              </Button>
                            </div>
                          </div>
                        ) : deleted ? (
                          <p className="italic text-muted-foreground">{t("chat.deleted")}</p>
                        ) : (
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{renderMessageWithMentions(m.body)}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] tabular-nums text-muted-foreground">
                          <span>{new Date(m.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                          {m.edited_at ? <span className="text-muted-foreground">{t("common.edited")}</span> : null}
                        </div>
                      </div>

                      {!deleted && channelIsActive ? (
                        <div className="flex shrink-0 flex-col items-center gap-1 pt-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            aria-label={t("chat.messageActions")}
                            onClick={() => setOpenActionsId((id) => (id === m.id ? null : m.id))}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    {showActions && !deleted && channelIsActive ? (
                      <div
                        className={cn(
                          "mb-2 flex flex-wrap items-center gap-1 rounded-xl border p-1.5",
                          mine ? "ml-auto max-w-[min(92%,28rem)] justify-end" : "max-w-[min(92%,28rem)]",
                          variant === "listener" ? "border-border/60 bg-[var(--surface-inset)]" : "border-border bg-card/90",
                        )}
                      >
                        {QUICK_REACTIONS.map((em) => (
                          <Button
                            key={em}
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-base"
                            onClick={() => {
                              toggleReaction(m.id, em);
                              setOpenActionsId(null);
                            }}
                          >
                            {em}
                          </Button>
                        ))}
                        {canEdit ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-xs text-foreground/80"
                            onClick={() => {
                              setEditingId(m.id);
                              setEditDraft(m.body);
                              setOpenActionsId(null);
                            }}
                          >
                            <Pencil className="size-3.5" /> {t("chat.edit")}
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-xs text-red-300 hover:text-destructive"
                            onClick={() => confirmDelete(m.id)}
                          >
                            <Trash2 className="size-3.5" /> {t("chat.delete")}
                          </Button>
                        ) : null}
                        {canModerate && pinnedMessage?.id !== m.id ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-xs text-brand hover:text-brand"
                            onClick={() => {
                              setPin(m.id);
                              setOpenActionsId(null);
                            }}
                          >
                            {t("chat.pin")}
                          </Button>
                        ) : null}
                        {canModerate && pinnedMessage?.id === m.id ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-xs text-foreground/80"
                            onClick={() => {
                              setPin(null);
                              setOpenActionsId(null);
                            }}
                          >
                            {t("chat.unpin")}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}

                    {summary.length > 0 ? (
                      <div className={cn("mt-1 flex flex-wrap gap-1.5", mine ? "justify-end" : "justify-start")}>
                        {summary.map((s) => (
                          <button
                            key={`${m.id}-${s.emoji}`}
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                              variant === "listener"
                                ? "border-white/10 bg-white/5 hover:bg-white/10"
                                : "border-border/80 bg-card/80 hover:bg-muted",
                            )}
                            onClick={() => toggleReaction(m.id, s.emoji)}
                          >
                            <span>{s.emoji}</span>
                            <span className="tabular-nums text-muted-foreground">{s.count}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div
          className={cn(
            "relative flex gap-2",
            fullHeight && "mt-auto shrink-0 border-t border-border/40 bg-[var(--surface-inset)] px-0.5 pt-3",
          )}
        >
          <Input
            ref={draftInputRef}
            value={draft}
            onChange={(e) => {
              const v = e.target.value;
              setDraft(v);
              const at = v.lastIndexOf("@");
              if (at >= 0 && (at === 0 || /\s/.test(v[at - 1] ?? ""))) {
                const q = v.slice(at + 1);
                if (!q.includes(" ")) {
                  setMentionQuery(q);
                  setMentionOpen(true);
                  setMentionIndex(0);
                  return;
                }
              }
              setMentionOpen(false);
              setMentionQuery("");
            }}
            maxLength={2000}
            placeholder={channelIsActive ? t("chat.placeholder.active") : t("chat.placeholder.closed")}
            disabled={!channelIsActive || sending || !connected}
            className={cn(
              "border text-sm",
              variant === "listener" ? "border-border/60 bg-[var(--surface-inset)] text-foreground placeholder:text-muted-foreground" : "border-border bg-card/80",
            )}
            onKeyDown={(e) => {
              if (mentionOpen && mentionCandidates.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionIndex((i) => (i + 1) % mentionCandidates.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length);
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  const pick = mentionCandidates[mentionIndex];
                  if (pick) insertMention(pick.username);
                  return;
                }
                if (e.key === "Escape") {
                  setMentionOpen(false);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submitSend();
              }
            }}
          />
          {mentionOpen && mentionCandidates.length > 0 ? (
            <div className="absolute bottom-full left-0 z-20 mb-1 max-h-40 w-full overflow-auto rounded-lg border border-border bg-background py-1 shadow-xl">
              {mentionCandidates.slice(0, 8).map((m, i) => (
                <button
                  key={m.id}
                  type="button"
                  className={cn(
                    "block w-full px-3 py-1.5 text-left text-sm",
                    i === mentionIndex ? "bg-[var(--brand-subtle)] text-brand" : "text-foreground/80 hover:bg-muted",
                  )}
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    insertMention(m.username);
                  }}
                >
                  @{m.username}
                </button>
              ))}
            </div>
          ) : null}
          <Button
            type="button"
            className="shrink-0 gap-1.5 bg-brand hover:bg-brand"
            disabled={!channelIsActive || sending || !connected || !draft.trim()}
            onClick={() => void submitSend()}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {t("chat.send")}
          </Button>
        </div>
        {!channelIsActive ? (
          <p className={cn("text-center text-xs text-muted-foreground", fullHeight && "shrink-0")}>
            {t("chat.reopenToSend")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
