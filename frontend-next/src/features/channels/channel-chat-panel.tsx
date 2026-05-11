"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Eraser,
  Loader2,
  Maximize2,
  MessageCircle,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/toast-provider";
import { useReconnectingChannelChatSocket } from "@/hooks/use-reconnecting-channel-chat-socket";
import { getMe, type ChannelChatMessageRow, type ChannelChatReaction } from "@/lib/api";
import { cn } from "@/lib/utils";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎵"] as const;

function parseMessage(raw: unknown): ChannelChatMessageRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "number" || typeof o.user_id !== "number" || typeof o.username !== "string") return null;
  if (typeof o.body !== "string" || typeof o.created_at !== "string") return null;
  const channel = typeof o.channel === "number" ? o.channel : Number(o.channel);
  if (!Number.isFinite(channel)) return null;
  const reactions: ChannelChatReaction[] = Array.isArray(o.reactions)
    ? (o.reactions
        .map((r) => {
          if (!r || typeof r !== "object") return null;
          const x = r as Record<string, unknown>;
          if (typeof x.user_id !== "number" || typeof x.username !== "string" || typeof x.emoji !== "string") return null;
          return { user_id: x.user_id, username: x.username, emoji: x.emoji };
        })
        .filter((x): x is ChannelChatReaction => x != null))
    : [];
  return {
    id: o.id,
    channel,
    user_id: o.user_id,
    username: o.username,
    body: o.body,
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
};

export function ChannelChatPanel({ channelId, channelIsActive, connectEnabled, variant, canModerate }: Props) {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<ChannelChatMessageRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [openActionsId, setOpenActionsId] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void getMe().then((res) => setMyUserId(res?.user?.id ?? null));
  }, []);

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
      showToast("Fullscreen is not available in this browser or was blocked.", "error");
    }
  }

  const handleChatPayload = useCallback(
    (payload: unknown) => {
      const data = (payload ?? {}) as Record<string, unknown>;
      const type = String(data.type ?? "").toUpperCase();
      if (type === "CHAT_ERROR") {
        const code = String(data.code ?? "error");
        const human: Record<string, string> = {
          invalid_body: "Message is empty or too long.",
          channel_closed: "Room is closed — chat is read-only.",
          forbidden: "You cannot do that.",
          not_found: "Message not found.",
          invalid_emoji: "Invalid reaction.",
          auth: "Please sign in again.",
        };
        showToast(human[code] ?? `Chat: ${code}`, "error");
        return;
      }
      if (type === "CHAT_SYNC") {
        const raw = data.messages;
        if (!Array.isArray(raw)) return;
        const rows = raw.map(parseMessage).filter(Boolean) as ChannelChatMessageRow[];
        setMessages(rows.sort(sortMessages));
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
        if (msg) setMessages((prev) => upsertMessages(prev, msg));
        return;
      }
      if (type === "CHAT_PURGED") {
        setMessages([]);
        return;
      }
    },
    [showToast],
  );

  const { chatSocketState, sendChat } = useReconnectingChannelChatSocket({
    channelId,
    onMessage: handleChatPayload,
    enabled: connectEnabled,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, hydrated]);

  const connected = chatSocketState === "connected";

  const requestOlder = useCallback(() => {
    if (!messages.length || loadingOlder || !connected) return;
    const oldest = messages[0];
    if (!oldest?.id) return;
    setLoadingOlder(true);
    const ok = sendChat({ action: "history", before: oldest.id, limit: 40 });
    if (!ok) {
      setLoadingOlder(false);
      showToast("Chat offline — cannot load older.", "error");
    }
  }, [connected, loadingOlder, messages, sendChat, showToast]);

  function submitSend() {
    const text = draft.trim();
    if (!text || !channelIsActive || sending || !connected) return;
    setSending(true);
    try {
      const ok = sendChat({ action: "send", body: text });
      if (ok) setDraft("");
      else showToast("Chat offline.", "error");
    } finally {
      setSending(false);
    }
  }

  function submitEdit() {
    if (editingId == null || !connected) return;
    const text = editDraft.trim();
    if (!text) return;
    const ok = sendChat({ action: "edit", message_id: editingId, body: text });
    if (!ok) showToast("Chat offline.", "error");
    setEditingId(null);
    setEditDraft("");
  }

  function confirmDelete(id: number) {
    if (!connected) return;
    if (!window.confirm("Delete this message for everyone?")) return;
    const ok = sendChat({ action: "delete", message_id: id });
    if (!ok) showToast("Chat offline.", "error");
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
    if (
      !window.confirm(
        "Delete the entire chat history for everyone in this channel? This cannot be undone.",
      )
    )
      return;
    const ok = sendChat({ action: "purge_all" });
    if (!ok) showToast("Chat offline.", "error");
  }

  const shellClass =
    variant === "listener"
      ? cn(
          "relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-zinc-950/95 via-emerald-950/20 to-zinc-950/95",
          "shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_25px_80px_-20px_rgba(0,0,0,0.85)] backdrop-blur-2xl",
          "before:pointer-events-none before:absolute before:inset-0 before:rounded-3xl before:bg-[radial-gradient(800px_circle_at_20%_-10%,rgba(52,211,153,0.12),transparent_45%)]",
        )
      : "overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/50 shadow-lg shadow-black/25";

  const headerTitle = variant === "listener" ? "Live room chat" : "Channel chat";
  const headerSubtitle =
    variant === "listener" ? "Synced with the room — reactions & edits update live." : "WebSocket channel — separate from playback.";

  const scrollMinH = variant === "listener" ? "min-h-[min(420px,52vh)] h-[min(420px,52vh)]" : "h-[min(280px,40vh)]";
  const scrollAreaClass = cn(
    "rounded-2xl border",
    isFullscreen ? "min-h-0 flex-1 basis-0" : scrollMinH,
    variant === "listener" ? "border-white/[0.06] bg-black/25" : "border-zinc-800/60 bg-zinc-950/60",
  );

  return (
    <div
      ref={shellRef}
      id="channel-chat-panel"
      className={cn(shellClass, isFullscreen && "flex max-h-none min-h-0 flex-1 flex-col rounded-none shadow-none")}
    >
      <div
        className={cn(
          "flex items-start gap-3 border-b px-4 py-3 sm:px-5",
          variant === "listener" ? "border-white/[0.06] bg-black/20" : "border-zinc-800/70",
        )}
      >
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
            variant === "listener"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-emerald-500/25 bg-emerald-950/40 text-emerald-400",
          )}
        >
          <MessageCircle className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-50 sm:text-base">{headerTitle}</h2>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                connected ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200",
              )}
            >
              {connected ? "Live" : chatSocketState === "closed" ? "Offline" : "Connecting…"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">{headerSubtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 self-start pt-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 text-zinc-400 hover:text-white"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={() => void toggleFullscreen()}
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          {canModerate ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 gap-1.5 text-xs text-amber-200/95 hover:bg-amber-950/40 hover:text-amber-100"
              disabled={!connected}
              onClick={() => void confirmPurgeAll()}
            >
              <Eraser className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Clear all</span>
            </Button>
          ) : null}
        </div>
      </div>

      <div className={cn("flex min-h-0 flex-1 flex-col gap-2 p-3 sm:p-4", variant === "listener" && "sm:p-5", isFullscreen && "min-h-0 flex-1")}>
        {messages.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 self-center text-xs text-zinc-400 hover:text-zinc-200"
            disabled={loadingOlder || !connected}
            onClick={() => void requestOlder()}
          >
            {loadingOlder ? <Loader2 className="size-3.5 animate-spin" /> : "Load older messages"}
          </Button>
        ) : null}

        <ScrollArea className={scrollAreaClass}>
          <div className="space-y-3 p-3 pr-2 sm:p-4">
            {!hydrated && connectEnabled ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-zinc-500">
                <Loader2 className="size-8 animate-spin text-emerald-500/60" />
                <span>Joining chat…</span>
              </div>
            ) : messages.length === 0 ? (
              <p className="py-16 text-center text-sm text-zinc-500">No messages yet — say hi to the room.</p>
            ) : (
              messages.map((m) => {
                const mine = myUserId != null && m.user_id === myUserId;
                const deleted = Boolean(m.deleted_at);
                const canEdit = mine && !deleted && channelIsActive;
                const canDelete = (mine || canModerate) && !deleted && channelIsActive;
                const summary = reactionSummary(m.reactions);
                const showActions = openActionsId === m.id;

                return (
                  <div key={m.id} className="group relative">
                    <div className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "relative max-w-[min(92%,28rem)] rounded-2xl border px-3.5 py-2.5 text-sm shadow-md transition-[box-shadow,transform]",
                          mine
                            ? "border-emerald-600/35 bg-emerald-950/55 text-emerald-50"
                            : variant === "listener"
                              ? "border-white/[0.07] bg-zinc-900/70 text-zinc-100"
                              : "border-zinc-700/60 bg-zinc-900/85 text-zinc-100",
                          variant === "listener" && mine && "shadow-emerald-900/20",
                        )}
                      >
                        {!mine ? (
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{m.username}</p>
                        ) : null}
                        {editingId === m.id ? (
                          <div className="space-y-2">
                            <Input
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              maxLength={2000}
                              className="border-zinc-700 bg-zinc-950/80 text-sm"
                            />
                            <div className="flex justify-end gap-2">
                              <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                Cancel
                              </Button>
                              <Button type="button" size="sm" onClick={() => void submitEdit()}>
                                Save
                              </Button>
                            </div>
                          </div>
                        ) : deleted ? (
                          <p className="italic text-zinc-500">This message was deleted.</p>
                        ) : (
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] tabular-nums text-zinc-500">
                          <span>{new Date(m.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                          {m.edited_at ? <span className="text-zinc-600">edited</span> : null}
                        </div>
                      </div>

                      {!deleted && channelIsActive ? (
                        <div className="flex shrink-0 flex-col items-center gap-1 pt-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8 text-zinc-400 hover:text-white"
                            aria-label="Message actions"
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
                          variant === "listener" ? "border-white/[0.08] bg-black/35" : "border-zinc-800 bg-zinc-950/90",
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
                            className="h-8 gap-1 text-xs text-zinc-300"
                            onClick={() => {
                              setEditingId(m.id);
                              setEditDraft(m.body);
                              setOpenActionsId(null);
                            }}
                          >
                            <Pencil className="size-3.5" /> Edit
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-xs text-red-300 hover:text-red-200"
                            onClick={() => confirmDelete(m.id)}
                          >
                            <Trash2 className="size-3.5" /> Delete
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
                                : "border-zinc-700/80 bg-zinc-900/80 hover:bg-zinc-800",
                            )}
                            onClick={() => toggleReaction(m.id, s.emoji)}
                          >
                            <span>{s.emoji}</span>
                            <span className="tabular-nums text-zinc-400">{s.count}</span>
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

        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            placeholder={channelIsActive ? "Message the channel…" : "Room is closed — chat is read-only."}
            disabled={!channelIsActive || sending || !connected}
            className={cn(
              "border text-sm",
              variant === "listener" ? "border-white/10 bg-black/30 text-zinc-100 placeholder:text-zinc-600" : "border-zinc-800 bg-zinc-900/80",
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submitSend();
              }
            }}
          />
          <Button
            type="button"
            className="shrink-0 gap-1.5 bg-emerald-600 hover:bg-emerald-500"
            disabled={!channelIsActive || sending || !connected || !draft.trim()}
            onClick={() => void submitSend()}
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send
          </Button>
        </div>
        {!channelIsActive ? <p className="text-center text-xs text-zinc-500">Reopen the channel to send new messages.</p> : null}
      </div>
    </div>
  );
}
