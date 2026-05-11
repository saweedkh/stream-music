"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HelpCircle, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast-provider";

export type ChannelExperience = {
  accent?: string;
  rehearsal_mode?: boolean;
  queue_locked?: boolean;
  blind_playlist_id?: number | null;
  intro_preview_seconds?: number;
  veto_skip_threshold?: number;
  oled_hint?: boolean;
};

type SocialPayload = {
  type?: string;
  action?: string;
  count?: number;
  members?: Array<{ id: number; username: string }>;
  emoji?: string;
  username?: string;
  message?: string;
  votes?: number;
  threshold?: number;
};

type Props = {
  channelId: string;
  sendMessage: (payload: Record<string, unknown>) => boolean;
  socketState: string;
  /** Owner / moderator — can always hear in rehearsal mode */
  canControl: boolean;
  experience: ChannelExperience;
};

const REACTIONS = ["🔥", "❤️", "😂", "👏", "🎧", "✨"];

export function RoomExperienceChrome({ channelId, sendMessage, socketState, canControl, experience }: Props) {
  const { showToast } = useToast();
  const [members, setMembers] = useState<Array<{ id: number; username: string }>>([]);
  const [count, setCount] = useState(0);
  const [lastShout, setLastShout] = useState<{ user: string; text: string } | null>(null);
  const [floaters, setFloaters] = useState<Array<{ id: number; emoji: string; x: number }>>([]);
  const [shoutDraft, setShoutDraft] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const floaterId = useRef(0);

  const accentRing = useMemo(() => {
    const a = (experience.accent || "emerald").toLowerCase();
    const map: Record<string, string> = {
      emerald: "border-emerald-500/40 shadow-emerald-900/30",
      violet: "border-violet-500/40 shadow-violet-900/30",
      rose: "border-rose-500/40 shadow-rose-900/30",
      amber: "border-amber-500/40 shadow-amber-900/30",
      sky: "border-sky-500/40 shadow-sky-900/30",
    };
    return map[a] ?? map.emerald;
  }, [experience.accent]);

  const onSocial = useCallback(
    (ev: Event) => {
      const e = ev as CustomEvent<{ channelId?: string; payload?: SocialPayload }>;
      if (String(e.detail?.channelId ?? "") !== String(channelId)) return;
      const p = e.detail?.payload;
      if (!p) return;
      const action = (p.action ?? "").toLowerCase();
      if (action === "presence_update") {
        setMembers(Array.isArray(p.members) ? p.members : []);
        setCount(typeof p.count === "number" ? p.count : 0);
      }
      if (action === "reaction" && p.emoji) {
        const id = ++floaterId.current;
        const x = 10 + Math.random() * 80;
        setFloaters((prev) => [...prev.slice(-12), { id, emoji: p.emoji ?? "♪", x }]);
        window.setTimeout(() => {
          setFloaters((prev) => prev.filter((f) => f.id !== id));
        }, 3200);
      }
      if (action === "shout" && p.message && p.username) {
        setLastShout({ user: p.username, text: p.message });
      }
      if (action === "vote_skip") {
        const v = typeof p.votes === "number" ? p.votes : 0;
        const thr = typeof p.threshold === "number" ? p.threshold : 0;
        showToast(thr > 0 ? `Skip votes: ${v} / ${thr}` : `Skip votes: ${v}`, "info");
      }
    },
    [channelId, showToast],
  );

  useEffect(() => {
    window.addEventListener("channel-social", onSocial as EventListener);
    return () => window.removeEventListener("channel-social", onSocial as EventListener);
  }, [onSocial]);

  useEffect(() => {
    if (socketState !== "connected") return;
    const tick = () => {
      sendMessage({ action: "presence_ping" });
    };
    tick();
    const id = window.setInterval(tick, 25000);
    return () => window.clearInterval(id);
  }, [sendMessage, socketState]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
      if (ev.key === "?" || (ev.key === "/" && ev.shiftKey)) {
        ev.preventDefault();
        setHelpOpen(true);
      }
      if (ev.code === "Space") {
        ev.preventDefault();
        /* Space reserved for player — avoid stealing focus */
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function sendReaction(emoji: string) {
    sendMessage({ action: "reaction", emoji });
  }

  function sendShout() {
    const t = shoutDraft.trim().slice(0, 40);
    if (!t) return;
    const ok = sendMessage({ action: "shout", message: t });
    if (ok) setShoutDraft("");
  }

  return (
    <div className={cn("relative mb-4 rounded-2xl border bg-zinc-950/50 p-4 backdrop-blur-sm", accentRing)}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex -space-x-2">
          {members.slice(0, 8).map((m) => (
            <span
              key={m.id}
              title={m.username}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs font-semibold uppercase text-zinc-200"
            >
              {(m.username || "?").slice(0, 1)}
            </span>
          ))}
          {members.length === 0 ? (
            <span className="text-xs text-zinc-500">Listening… connect to see who&apos;s here.</span>
          ) : (
            <span className="pl-2 text-xs text-zinc-400">{count} online</span>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {REACTIONS.map((r) => (
            <Button
              key={r}
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 min-w-8 px-0 text-base transition-transform active:scale-90"
              onClick={() => sendReaction(r)}
            >
              {r}
            </Button>
          ))}
        </div>
        <Button type="button" variant="ghost" size="sm" className="ml-auto gap-1 text-zinc-400" onClick={() => setHelpOpen(true)}>
          <HelpCircle className="h-4 w-4" />
          Hotkeys
        </Button>
      </div>
      {lastShout ? (
        <p className="mt-3 truncate text-sm text-zinc-300">
          <span className="font-semibold text-emerald-300/90">{lastShout.user}:</span> {lastShout.text}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          maxLength={40}
          placeholder="Shout (40 chars, 30s cooldown)"
          value={shoutDraft}
          onChange={(e) => setShoutDraft(e.target.value)}
          className="max-w-md border-zinc-800 bg-zinc-900/80"
          onKeyDown={(e) => e.key === "Enter" && sendShout()}
        />
        <Button type="button" size="sm" className="gap-1" onClick={() => sendShout()}>
          <Send className="h-3.5 w-3.5" />
          Send
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => sendMessage({ action: "vote_skip" })}>
          Vote skip ({experience.veto_skip_threshold ? `≥${experience.veto_skip_threshold}` : "tally"})
        </Button>
      </div>
      {experience.rehearsal_mode && !canControl ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-amber-200/90">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          Soundcheck mode — playback is muted for listeners until DJs go live.
        </p>
      ) : null}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
        {floaters.map((f) => (
          <span
            key={f.id}
            className="pointer-events-none absolute bottom-0 text-3xl opacity-90 animate-[floater_3.2s_ease-out_forwards]"
            style={{ left: `${f.x}%` }}
          >
            {f.emoji}
          </span>
        ))}
      </div>
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="border-zinc-800 bg-zinc-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Room hotkeys</DialogTitle>
            <DialogDescription className="text-left text-zinc-400">
              <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-xs">?</kbd> or{" "}
              <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-xs">Shift+/</kbd> — this help
              <br />
              Reactions and shouts use the live socket (no page reload).
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
