"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HelpCircle, Send, Share2, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { ROOM_REACTION_EMOJIS } from "@/features/channels/room-reaction-constants";
import { useChannelPresence } from "@/hooks/use-channel-presence";

export type ChannelExperience = {
  accent?: string;
  rehearsal_mode?: boolean;
  queue_locked?: boolean;
  blind_playlist_id?: number | null;
  intro_preview_seconds?: number;
  veto_skip_threshold?: number;
  rehearsal_lift_until?: string | null;
  listening_party_only?: boolean;
  room_rules?: string;
  scheduled_start_at?: string | null;
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
  currentTrackId?: number | null;
};

export function RoomExperienceChrome({
  channelId,
  sendMessage,
  socketState,
  canControl,
  experience,
  currentTrackId = null,
}: Props) {
  const { showToast } = useToast();
  const { onlineMembers: members, onlineCount: count } = useChannelPresence(channelId);
  const [lastShout, setLastShout] = useState<{ user: string; text: string } | null>(null);
  const [shoutDraft, setShoutDraft] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [skipVotes, setSkipVotes] = useState(0);
  const [skipThreshold, setSkipThreshold] = useState(0);
  const lastTrackIdRef = useRef<number | null>(null);
  const liftActive =
    experience.rehearsal_lift_until && Date.parse(experience.rehearsal_lift_until) > Date.now();
  const rehearsalMuted = Boolean(experience.rehearsal_mode && !canControl && !liftActive);

  const accentRing = useMemo(() => {
    const a = (experience.accent || "emerald").toLowerCase();
    const map: Record<string, string> = {
      emerald: "border-brand/40 shadow-brand/30",
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
      if (action === "shout" && p.message && p.username) {
        setLastShout({ user: p.username, text: p.message });
      }
      if (action === "vote_skip") {
        const v = typeof p.votes === "number" ? p.votes : 0;
        const thr = typeof p.threshold === "number" ? p.threshold : experience.veto_skip_threshold ?? 0;
        setSkipVotes(Math.max(0, v));
        setSkipThreshold(thr);
        if (thr > 0 && v >= thr) {
          showToast("Skip threshold reached — advancing track.", "success");
        }
      }
    },
    [channelId, experience.veto_skip_threshold, showToast],
  );

  useEffect(() => {
    window.addEventListener("channel-social", onSocial as EventListener);
    return () => window.removeEventListener("channel-social", onSocial as EventListener);
  }, [onSocial]);

  useEffect(() => {
    const tid = currentTrackId ?? null;
    if (lastTrackIdRef.current !== null && lastTrackIdRef.current !== tid) {
      setSkipVotes(0);
      setSkipThreshold(experience.veto_skip_threshold ?? 0);
    }
    lastTrackIdRef.current = tid;
  }, [currentTrackId, experience.veto_skip_threshold]);

  useEffect(() => {
    const onPlayback = (ev: Event) => {
      const e = ev as CustomEvent<{ channelId?: string; payload?: { track?: { id?: number } | null } }>;
      if (String(e.detail?.channelId ?? "") !== String(channelId)) return;
      const tid = e.detail?.payload?.track?.id ?? null;
      if (tid == null) return;
      if (lastTrackIdRef.current !== null && lastTrackIdRef.current !== tid) {
        setSkipVotes(0);
        setSkipThreshold(experience.veto_skip_threshold ?? 0);
      }
      lastTrackIdRef.current = tid;
    };
    window.addEventListener("channel-playback-updated", onPlayback);
    return () => window.removeEventListener("channel-playback-updated", onPlayback);
  }, [channelId, experience.veto_skip_threshold]);

  useEffect(() => {
    const onHelp = () => setHelpOpen(true);
    window.addEventListener("channel-room-help", onHelp);
    return () => window.removeEventListener("channel-room-help", onHelp);
  }, []);

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
    <div className={cn("relative mb-4 rounded-2xl border bg-card/50 p-4 backdrop-blur-sm", accentRing)}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex -space-x-2">
          {members.slice(0, 8).map((m) => (
            <Avatar key={m.id} className="h-9 w-9 border-2 border-background" title={m.username}>
              <AvatarFallback className="text-xs">{(m.username || "?").slice(0, 1)}</AvatarFallback>
            </Avatar>
          ))}
          {members.length === 0 ? (
            <span className="text-xs text-muted-foreground">Listening… connect to see who&apos;s here.</span>
          ) : (
            <span className="pl-2 text-xs text-muted-foreground">{count} online</span>
          )}
        </div>
        <div className="relative flex flex-wrap gap-1">
          {ROOM_REACTION_EMOJIS.map((r) => (
            <Button
              key={r}
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 min-w-8 px-0 text-base transition-transform active:scale-90"
              onClick={() => sendReaction(r)}
              aria-label={`React ${r}`}
            >
              {r}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto gap-1 text-muted-foreground"
          onClick={async () => {
            const url = `${window.location.origin}/channel/${channelId}`;
            try {
              if (navigator.share) await navigator.share({ title: "Stream Music room", url });
              else {
                await navigator.clipboard.writeText(url);
                showToast("Room link copied.", "success");
              }
            } catch {
              /* cancelled */
            }
          }}
        >
          <Share2 className="h-4 w-4" />
          Share
        </Button>
        <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => setHelpOpen(true)}>
          <HelpCircle className="h-4 w-4" />
          Hotkeys
        </Button>
      </div>
      {lastShout ? (
        <p className="mt-3 truncate text-sm text-foreground/80">
          <span className="font-semibold text-brand/90">{lastShout.user}:</span> {lastShout.text}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          maxLength={40}
          placeholder="Shout (40 chars, 30s cooldown)"
          value={shoutDraft}
          onChange={(e) => setShoutDraft(e.target.value)}
          className="max-w-md border-border bg-card/80"
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
      {experience.veto_skip_threshold && experience.veto_skip_threshold > 0 ? (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Skip votes</span>
            <span>
              {skipVotes} / {skipThreshold || experience.veto_skip_threshold}
            </span>
          </div>
          <Progress
            value={Math.min(100, (skipVotes / Math.max(1, skipThreshold || experience.veto_skip_threshold)) * 100)}
            className="h-2 [&>div]:bg-amber-500/90"
          />
        </div>
      ) : null}
      {experience.room_rules?.trim() ? (
        <div className="mt-3 rounded-lg border border-border/80 bg-card/50 px-3 py-2 text-xs text-foreground/80">
          <p className="font-medium text-muted-foreground">Room rules</p>
          <p className="mt-1 whitespace-pre-wrap">{experience.room_rules.trim()}</p>
        </div>
      ) : null}
      {experience.scheduled_start_at && Date.parse(experience.scheduled_start_at) > Date.now() ? (
        <p className="mt-2 text-xs text-sky-300/90">
          Scheduled start: {new Date(experience.scheduled_start_at).toLocaleString()}
        </p>
      ) : null}
      {rehearsalMuted ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-warning/90">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          Soundcheck mode — playback is muted for listeners until DJs go live.
        </p>
      ) : null}
      {experience.listening_party_only && !canControl ? (
        <p className="mt-1 text-xs text-muted-foreground">Listening party — only DJs control playback; you can vote and suggest tracks.</p>
      ) : null}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="border-border bg-background sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Room hotkeys</DialogTitle>
            <DialogDescription className="text-left text-muted-foreground">
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-xs">?</kbd> or{" "}
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-xs">Shift+/</kbd> — this help
              <br />
              Reactions and shouts use the live socket (no page reload).
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}
