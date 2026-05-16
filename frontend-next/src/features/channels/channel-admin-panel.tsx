"use client";

import {
  Copy,
  Link2,
  Loader2,
  Radio,
  RefreshCw,
  Shield,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import QRCode from "react-qr-code";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast-provider";
import {
  approveJoinRequest,
  buildPrivateInviteJoinUrl,
  buildPublicJoinUrl,
  createInvite,
  deleteChannel,
  getChannelMembers,
  listChannelInvites,
  listChannelJoinRequests,
  listPlaylists,
  rejectJoinRequest,
  rotatePrivateInvite,
  rotatePublicLink,
  updateChannelSettings,
  uploadChannelBrandLogo,
  type ChannelMember,
  type JoinRequestRow,
  type PlaylistSummary,
} from "@/lib/api";
import { ChannelMemberRosterActions } from "@/features/channels/channel-member-roster-actions";
import { channelSettingsSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";

type Props = {
  channelId: string;
  initialName?: string;
  initialDescription?: string;
  initialPrivacy?: "public" | "private" | "unlisted";
  initialMemberLimit?: number;
  publicSlug?: string;
  publicJoinSlug?: string | null;
  initialJoinRequiresApproval?: boolean;
  sendSocketMessage?: (payload: Record<string, unknown>) => boolean;
  channelIsActive?: boolean;
  /** Only the channel owner may permanently delete the room (matches API). */
  canDeleteChannel?: boolean;
  initialExperience?: Record<string, unknown> | null;
};

async function copyText(text: string, showToast: (m: string, t?: "success" | "error" | "info") => void) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard.", "success");
  } catch {
    showToast("Could not copy — try selecting the text manually.", "error");
  }
}

function QrTile({
  title,
  subtitle,
  value,
  disabled,
  onCopy,
}: {
  title: string;
  subtitle?: string;
  value: string | null;
  disabled?: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-border/80 bg-gradient-to-b from-card/80 to-background/90 p-5 text-center shadow-inner",
        disabled && "opacity-50",
      )}
    >
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {value ? (
        <button
          type="button"
          onClick={onCopy}
          className="group rounded-2xl bg-white p-3 shadow-lg ring-2 ring-transparent transition hover:ring-brand/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          title="Click to copy link"
        >
          <QRCode value={value} size={168} className="h-[168px] w-[168px]" />
          <span className="mt-2 block text-[11px] font-medium text-muted-foreground group-hover:text-brand-strong">
            Tap to copy link
          </span>
        </button>
      ) : (
        <div className="flex h-[196px] w-[196px] items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/50 text-xs text-muted-foreground">
          Not available yet
        </div>
      )}
    </div>
  );
}

export function ChannelAdminPanel({
  channelId,
  initialName = "",
  initialDescription = "",
  initialPrivacy = "public",
  initialMemberLimit = 50,
  publicSlug,
  publicJoinSlug: initialPublicJoinSlug = null,
  initialJoinRequiresApproval = false,
  sendSocketMessage,
  channelIsActive = true,
  canDeleteChannel = false,
  initialExperience = null,
}: Props) {
  const { showToast } = useToast();
  const router = useRouter();
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [privacy, setPrivacy] = useState<"public" | "private" | "unlisted">(initialPrivacy);
  const [memberLimit, setMemberLimit] = useState(String(initialMemberLimit));
  const [publicJoinSlugDraft, setPublicJoinSlugDraft] = useState(initialPublicJoinSlug ?? "");
  const [publicJoinSlugSaved, setPublicJoinSlugSaved] = useState(initialPublicJoinSlug ?? "");
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [joinRequiresApproval, setJoinRequiresApproval] = useState(Boolean(initialJoinRequiresApproval));
  const [joinRequests, setJoinRequests] = useState<JoinRequestRow[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteChannelDialogOpen, setDeleteChannelDialogOpen] = useState(false);
  const [deleteChannelBusy, setDeleteChannelBusy] = useState(false);
  const [adminPlaylists, setAdminPlaylists] = useState<PlaylistSummary[]>([]);
  const [expAccent, setExpAccent] = useState("emerald");
  const [expRehearsal, setExpRehearsal] = useState(false);
  const [expQueueLocked, setExpQueueLocked] = useState(false);
  const [expBlindPlaylistId, setExpBlindPlaylistId] = useState("");
  const [expIntro, setExpIntro] = useState("0");
  const [expVeto, setExpVeto] = useState("0");
  const [expAntiRepeat, setExpAntiRepeat] = useState("0");
  const [expShuffleBias, setExpShuffleBias] = useState("0");
  const [expSuggestions, setExpSuggestions] = useState(true);
  const [expDjRotation, setExpDjRotation] = useState(false);
  const [expDjEvery, setExpDjEvery] = useState("1");
  const [expListeningParty, setExpListeningParty] = useState(false);
  const [expRadio, setExpRadio] = useState(false);
  const [expQueueEndMode, setExpQueueEndMode] = useState<"loop" | "stop" | "repeat_one">("loop");
  const [expRoomRules, setExpRoomRules] = useState("");
  const [expScheduledStart, setExpScheduledStart] = useState("");

  const privateJoinUrl = inviteToken && typeof window !== "undefined" ? buildPrivateInviteJoinUrl(inviteToken) : null;
  const publicJoinUrl =
    publicSlug && typeof window !== "undefined" ? buildPublicJoinUrl(publicSlug, publicJoinSlugSaved || null) : null;

  const loadJoinRequests = useCallback(async () => {
    try {
      const data = await listChannelJoinRequests(channelId);
      setJoinRequests(data.results);
    } catch {
      setJoinRequests([]);
    }
  }, [channelId]);

  const refreshInvite = useCallback(async () => {
    try {
      let { results } = await listChannelInvites(channelId);
      let active = results.find((r) => r.is_active);
      if (!active && channelIsActive) {
        try {
          await createInvite(channelId);
        } catch {
          /* may race with migration / permissions */
        }
        const again = await listChannelInvites(channelId);
        results = again.results;
        active = results.find((r) => r.is_active);
      }
      setInviteToken(active ? String(active.token) : null);
    } catch {
      setInviteToken(null);
    }
  }, [channelId, channelIsActive]);

  useEffect(() => {
    void listPlaylists(channelId)
      .then((list) => setAdminPlaylists(list.filter((p) => p.channel === Number(channelId))))
      .catch(() => setAdminPlaylists([]));
  }, [channelId]);

  useEffect(() => {
    const raw = initialExperience && typeof initialExperience === "object" ? initialExperience : {};
    setExpAccent(typeof raw.accent === "string" ? String(raw.accent) : "emerald");
    setExpRehearsal(Boolean(raw.rehearsal_mode));
    setExpQueueLocked(Boolean(raw.queue_locked));
    const b = raw.blind_playlist_id;
    setExpBlindPlaylistId(b != null && b !== "" ? String(b) : "");
    setExpIntro(raw.intro_preview_seconds != null ? String(raw.intro_preview_seconds) : "0");
    setExpVeto(raw.veto_skip_threshold != null ? String(raw.veto_skip_threshold) : "0");
    setExpAntiRepeat(raw.anti_repeat_window != null ? String(raw.anti_repeat_window) : "0");
    setExpShuffleBias(raw.weighted_shuffle_bias != null ? String(raw.weighted_shuffle_bias) : "0");
    setExpSuggestions(raw.suggestions_enabled !== false);
    setExpDjRotation(Boolean(raw.dj_rotation_enabled));
    setExpDjEvery(raw.dj_rotation_every_n != null ? String(raw.dj_rotation_every_n) : "1");
    setExpListeningParty(Boolean(raw.listening_party_only));
    setExpRadio(Boolean(raw.radio_mode));
    const mode = raw.queue_end_mode;
    setExpQueueEndMode(mode === "stop" || mode === "repeat_one" ? mode : "loop");
    setExpRoomRules(typeof raw.room_rules === "string" ? raw.room_rules : "");
    setExpScheduledStart(typeof raw.scheduled_start_at === "string" ? raw.scheduled_start_at : "");
  }, [initialExperience]);

  useEffect(() => {
    void loadMembers();
  }, [channelId]);

  useEffect(() => {
    void loadJoinRequests();
  }, [loadJoinRequests]);

  useEffect(() => {
    void refreshInvite();
  }, [refreshInvite]);

  useEffect(() => {
    setPublicJoinSlugDraft(initialPublicJoinSlug ?? "");
    setPublicJoinSlugSaved(initialPublicJoinSlug ?? "");
  }, [initialPublicJoinSlug]);

  async function control(action: string, payload?: Record<string, unknown>) {
    if (!channelIsActive) return;
    setBusy(action);
    try {
      const sent = sendSocketMessage?.({ action, ...payload });
      if (!sent) throw new Error("Socket is not connected");
      showToast(`Action “${action}” sent.`, "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : `Action “${action}” failed.`, "error");
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings() {
    setBusy("settings");
    const result = channelSettingsSchema.safeParse({ name, memberLimit });
    const nextErrors: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? "");
        if (field === "name" || field === "memberLimit") nextErrors[field] = issue.message;
      }
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast("Please fix the highlighted fields.", "error");
      setBusy(null);
      return;
    }
    try {
      await updateChannelSettings(channelId, {
        name,
        description,
        privacy,
        member_limit: Number(memberLimit) || 1,
        join_requires_approval: joinRequiresApproval,
      });
      showToast("Settings saved.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Save failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function savePublicSlug() {
    if (privacy === "private") {
      showToast("Custom public link only applies to public or unlisted channels.", "info");
      return;
    }
    setBusy("slug");
    try {
      const trimmed = publicJoinSlugDraft.trim();
      await updateChannelSettings(channelId, {
        public_join_slug: trimmed.length ? trimmed : null,
      });
      setPublicJoinSlugSaved(trimmed.length ? trimmed.toLowerCase() : "");
      showToast(trimmed ? "Join code saved." : "Custom join code cleared — default link is used.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save join code.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function liftRehearsalMix() {
    setBusy("lift");
    const until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    try {
      await updateChannelSettings(channelId, {
        experience: { rehearsal_lift_until: until },
      });
      showToast("Listeners can hear the mix for 15 minutes.", "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not lift soundcheck.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function saveExperience() {
    setBusy("experience");
    const intro = Math.max(0, Math.min(120, Number(expIntro) || 0));
    const veto = Math.max(0, Math.min(999, Number(expVeto) || 0));
    const blindRaw = expBlindPlaylistId.trim();
    const blindNum = blindRaw ? Number(blindRaw) : null;
    try {
      await updateChannelSettings(channelId, {
        experience: {
          accent: expAccent,
          rehearsal_mode: expRehearsal,
          queue_locked: expQueueLocked,
          blind_playlist_id: blindNum != null && Number.isFinite(blindNum) ? blindNum : null,
          intro_preview_seconds: intro,
          veto_skip_threshold: veto,
          anti_repeat_window: Math.max(0, Number(expAntiRepeat) || 0),
          weighted_shuffle_bias: Math.max(0, Math.min(2, Number(expShuffleBias) || 0)),
          suggestions_enabled: expSuggestions,
          dj_rotation_enabled: expDjRotation,
          dj_rotation_every_n: Math.max(1, Number(expDjEvery) || 1),
          listening_party_only: expListeningParty,
          radio_mode: expRadio,
          queue_end_mode: expQueueEndMode,
          room_rules: expRoomRules.trim() || undefined,
          scheduled_start_at: expScheduledStart.trim() ? expScheduledStart.trim() : null,
        },
      });
      showToast("Room experience saved.", "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save experience.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function uploadBrandLogo(file: File) {
    setBusy("logo");
    try {
      await uploadChannelBrandLogo(channelId, file);
      showToast("Brand logo updated.", "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Logo upload failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function loadMembers() {
    try {
      const data = await getChannelMembers(channelId);
      setMembers(data.results);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Cannot load members.", "error");
    }
  }

  async function rotatePrivate() {
    setBusy("rotate-private");
    try {
      const data = await rotatePrivateInvite(channelId);
      setInviteToken(data.token);
      showToast("New private invite code — old links stop working.", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Rotate failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function rotatePublicUuid() {
    setBusy("rotate-public");
    try {
      await rotatePublicLink(channelId);
      showToast("Fallback UUID link rotated. Share the new QR if you used the long link.", "success");
      window.location.reload();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Rotate failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  async function confirmDeleteChannel() {
    setDeleteChannelBusy(true);
    try {
      await deleteChannel(channelId);
      showToast("Channel deleted.", "success");
      setDeleteChannelDialogOpen(false);
      router.replace("/dashboard");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not delete channel.", "error");
    } finally {
      setDeleteChannelBusy(false);
    }
  }

  const canPublicSlug = privacy === "public" || privacy === "unlisted";

  return (
    <Card className="overflow-hidden border-border/90 shadow-xl shadow-black/25">
      <CardHeader className="border-b border-border/80 bg-gradient-to-r from-background via-card/95 to-[var(--brand-subtle)] pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-[var(--brand-subtle)] text-brand shadow-lg shadow-brand/20">
              <Radio className="size-5" />
            </span>
            <div>
              <CardTitle className="text-xl text-foreground">Control room</CardTitle>
              <CardDescription className="mt-1 max-w-xl text-muted-foreground">
                Tune the room, share short join codes, and manage members — without juggling long URLs.
              </CardDescription>
            </div>
          </div>
          {!channelIsActive ? (
            <Badge variant="secondary" className="border-amber-800/50 bg-amber-950/40 text-warning">
              Channel closed
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="settings" className="w-full px-4 pb-6 pt-4 sm:px-6">
          <TabsList className="mb-1 w-full justify-start gap-1">
            <TabsTrigger value="settings" className="gap-2">
              <Sparkles className="size-4 opacity-80" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="invites" className="gap-2">
              <Link2 className="size-4 opacity-80" />
              Invites & QR
            </TabsTrigger>
            <TabsTrigger value="people" className="gap-2">
              <Users className="size-4 opacity-80" />
              People
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4 rounded-2xl border border-border/70 bg-card/40 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Room profile</h3>
                <div className="space-y-2">
                  <Label htmlFor={`ch-name-${channelId}`}>Name</Label>
                  <Input
                    id={`ch-name-${channelId}`}
                    value={name}
                    aria-invalid={Boolean(fieldErrors.name)}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Channel name"
                    className="border-border bg-card/80"
                  />
                  {fieldErrors.name ? <p className="text-xs text-red-400">{fieldErrors.name}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`ch-desc-${channelId}`}>Description</Label>
                  <textarea
                    id={`ch-desc-${channelId}`}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this room about?"
                    rows={3}
                    className="flex w-full resize-none rounded-md border border-border bg-card/80 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`ch-privacy-${channelId}`}>Privacy</Label>
                  <Select
                    id={`ch-privacy-${channelId}`}
                    value={privacy}
                    onChange={(e) => setPrivacy(e.target.value as typeof privacy)}
                    className="border-border bg-card/80"
                  >
                    <option value="public">Public — anyone with a code can join</option>
                    <option value="private">Private — invite code required</option>
                    <option value="unlisted">Unlisted — link/code only</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`ch-limit-${channelId}`}>Member limit</Label>
                  <Input
                    id={`ch-limit-${channelId}`}
                    type="number"
                    inputMode="numeric"
                    value={memberLimit}
                    aria-invalid={Boolean(fieldErrors.memberLimit)}
                    onChange={(e) => setMemberLimit(e.target.value)}
                    className="border-border bg-card/80"
                  />
                  {fieldErrors.memberLimit ? <p className="text-xs text-red-400">{fieldErrors.memberLimit}</p> : null}
                </div>
              </div>

              <div className="flex flex-col justify-between gap-4 rounded-2xl border border-border/70 bg-card/40 p-5">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Access rules</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    When enabled, new members wait in a queue until a moderator approves them.
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Require approval to join</p>
                    <p className="text-xs text-muted-foreground">Recommended for open rooms</p>
                  </div>
                  <Switch checked={joinRequiresApproval} onCheckedChange={setJoinRequiresApproval} id={`ch-approval-${channelId}`} />
                </div>
                <Button
                  className="w-full bg-brand hover:bg-brand"
                  disabled={!channelIsActive || busy === "settings"}
                  onClick={() => void saveSettings()}
                >
                  {busy === "settings" ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save settings
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/40 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Room experience</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Accent colors, soundcheck mode, queue lock, blind roulette playlist, skip-vote threshold, intro clip length, and channel logo.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`ch-exp-accent-${channelId}`}>Accent</Label>
                  <Select
                    id={`ch-exp-accent-${channelId}`}
                    value={expAccent}
                    onChange={(e) => setExpAccent(e.target.value)}
                    className="border-border bg-card/80"
                  >
                    <option value="emerald">Emerald</option>
                    <option value="violet">Violet</option>
                    <option value="rose">Rose</option>
                    <option value="amber">Amber</option>
                    <option value="sky">Sky</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`ch-blind-pl-${channelId}`}>Blind roulette playlist</Label>
                  <Select
                    id={`ch-blind-pl-${channelId}`}
                    value={expBlindPlaylistId}
                    onChange={(e) => setExpBlindPlaylistId(e.target.value)}
                    className="border-border bg-card/80"
                  >
                    <option value="">— none —</option>
                    {adminPlaylists.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground">Used when DJs send a blind draw over the live socket.</p>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3 sm:col-span-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Soundcheck (rehearsal) mode</p>
                    <p className="text-xs text-muted-foreground">Listeners hear silence until moderators disable this.</p>
                  </div>
                  <Switch checked={expRehearsal} onCheckedChange={setExpRehearsal} id={`ch-exp-reh-${channelId}`} />
                </div>
                {expRehearsal ? (
                  <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy === "lift"}
                      onClick={() => void liftRehearsalMix()}
                    >
                      Lift soundcheck 15 min
                    </Button>
                    <p className="text-xs text-muted-foreground">Listeners hear the main mix until the lift expires.</p>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3 sm:col-span-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">Lock queue adds</p>
                    <p className="text-xs text-muted-foreground">Only the room owner can enqueue while locked.</p>
                  </div>
                  <Switch checked={expQueueLocked} onCheckedChange={setExpQueueLocked} id={`ch-exp-lock-${channelId}`} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`ch-exp-intro-${channelId}`}>Intro clip length (seconds)</Label>
                  <Input
                    id={`ch-exp-intro-${channelId}`}
                    type="number"
                    min={0}
                    max={120}
                    value={expIntro}
                    onChange={(e) => setExpIntro(e.target.value)}
                    className="border-border bg-card/80"
                  />
                  <p className="text-xs text-muted-foreground">After this point, listeners are muted locally (sync stays aligned).</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`ch-exp-veto-${channelId}`}>Skip vote threshold</Label>
                  <Input
                    id={`ch-exp-veto-${channelId}`}
                    type="number"
                    min={0}
                    max={999}
                    value={expVeto}
                    onChange={(e) => setExpVeto(e.target.value)}
                    className="border-border bg-card/80"
                  />
                  <p className="text-xs text-muted-foreground">0 = tally only. When reached, the room auto-advances like “next”.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`ch-exp-anti-${channelId}`}>Anti-repeat window</Label>
                  <Input id={`ch-exp-anti-${channelId}`} type="number" min={0} value={expAntiRepeat} onChange={(e) => setExpAntiRepeat(e.target.value)} className="border-border bg-card/80" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`ch-exp-bias-${channelId}`}>Shuffle bias (0–2)</Label>
                  <Input id={`ch-exp-bias-${channelId}`} type="number" min={0} max={2} step={0.1} value={expShuffleBias} onChange={(e) => setExpShuffleBias(e.target.value)} className="border-border bg-card/80" />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3 sm:col-span-2">
                  <p className="text-sm font-medium text-foreground">Track suggestions</p>
                  <Switch checked={expSuggestions} onCheckedChange={setExpSuggestions} />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3">
                  <p className="text-sm font-medium text-foreground">DJ rotation</p>
                  <Switch checked={expDjRotation} onCheckedChange={setExpDjRotation} />
                </div>
                <div className="space-y-2">
                  <Label>Rotate every N tracks</Label>
                  <Input type="number" min={1} value={expDjEvery} onChange={(e) => setExpDjEvery(e.target.value)} className="border-border bg-card/80" />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3 sm:col-span-2">
                  <p className="text-sm font-medium text-foreground">Listening party</p>
                  <Switch checked={expListeningParty} onCheckedChange={setExpListeningParty} />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/50 px-4 py-3 sm:col-span-2">
                  <p className="text-sm font-medium text-foreground">Radio mode</p>
                  <Switch checked={expRadio} onCheckedChange={setExpRadio} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`ch-exp-queue-end-${channelId}`}>When queue ends</Label>
                  <Select
                    id={`ch-exp-queue-end-${channelId}`}
                    value={expQueueEndMode}
                    onChange={(e) => setExpQueueEndMode(e.target.value as "loop" | "stop" | "repeat_one")}
                    className="border-border bg-card/80"
                  >
                    <option value="loop">Loop playlist</option>
                    <option value="stop">Stop at last track</option>
                    <option value="repeat_one">Repeat current track</option>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`ch-exp-rules-${channelId}`}>Room rules (shown to listeners)</Label>
                  <textarea
                    id={`ch-exp-rules-${channelId}`}
                    value={expRoomRules}
                    onChange={(e) => setExpRoomRules(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    className="w-full rounded-md border border-border bg-card/80 px-3 py-2 text-sm text-foreground"
                    placeholder="Be kind, no spoilers, request in chat…"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`ch-exp-scheduled-${channelId}`}>Scheduled start (ISO, optional)</Label>
                  <Input
                    id={`ch-exp-scheduled-${channelId}`}
                    value={expScheduledStart}
                    onChange={(e) => setExpScheduledStart(e.target.value)}
                    placeholder="2026-05-16T21:00:00Z"
                    className="border-border bg-card/80"
                  />
                  <p className="text-xs text-muted-foreground">Blocks play/shuffle until this time (UTC ISO string).</p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`ch-brand-logo-${channelId}`}>Brand logo</Label>
                  <Input
                    id={`ch-brand-logo-${channelId}`}
                    type="file"
                    accept="image/*"
                    className="cursor-pointer border-border bg-card/80"
                    disabled={busy === "logo"}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadBrandLogo(f);
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="bg-brand hover:bg-brand"
                  disabled={!channelIsActive || busy === "experience"}
                  onClick={() => void saveExperience()}
                >
                  {busy === "experience" ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save experience
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!channelIsActive || !sendSocketMessage}
                  onClick={() => {
                    const ok = sendSocketMessage?.({ action: "blind_draw" });
                    if (!ok) showToast("Connect to the live room first.", "error");
                    else showToast("Blind draw sent — random track from the configured playlist.", "success");
                  }}
                >
                  Blind roulette draw
                </Button>
              </div>
            </div>

            <div className="h-px bg-muted/90" />

            <div className="rounded-2xl border border-red-900/35 bg-red-950/15 p-5">
              <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Permanently delete this channel and its related data. Only the channel owner sees this option — moderators and guests cannot remove
                the room.
              </p>
              {canDeleteChannel ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="mt-4 gap-2"
                  onClick={() => setDeleteChannelDialogOpen(true)}
                >
                  <Trash2 className="size-4" />
                  Delete channel
                </Button>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">Only the room owner can delete this channel.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="invites" className="space-y-8">
            <section className="rounded-2xl border border-brand/30 bg-gradient-to-br from-[var(--brand-subtle)] to-background/40 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="size-4 text-brand" />
                    <h3 className="font-semibold text-foreground">Private invite</h3>
                  </div>
                  <p className="mt-1 max-w-lg text-sm text-muted-foreground">
                    Every room has an active invite code. Guests enter <strong className="text-foreground/80">only this code</strong> (or scan QR)
                    — no full URL needed.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-1.5"
                  disabled={!channelIsActive || busy === "rotate-private"}
                  onClick={() => void rotatePrivate()}
                >
                  <RefreshCw className={cn("size-3.5", busy === "rotate-private" && "animate-spin")} />
                  New code
                </Button>
              </div>
              {inviteToken ? (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <code className="flex-1 rounded-lg border border-border bg-[var(--surface-inset)] px-3 py-2 font-mono text-sm text-brand">
                    {inviteToken}
                  </code>
                  <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => void copyText(inviteToken, showToast)}>
                    <Copy className="size-3.5" />
                    Copy code
                  </Button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Loading invite…</p>
              )}
            </section>

            {canPublicSlug && publicSlug ? (
              <section className="rounded-2xl border border-border/70 bg-card/40 p-5">
                <div className="flex items-center gap-2">
                  <UserPlus className="size-4 text-sky-400" />
                  <h3 className="font-semibold text-foreground">Public join code</h3>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Set a short memorable code (letters, numbers, hyphens). Guests type this code to join.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Input
                    value={publicJoinSlugDraft}
                    onChange={(e) => setPublicJoinSlugDraft(e.target.value)}
                    placeholder="e.g. friday-jams"
                    className="border-border bg-card/80 font-mono sm:max-w-xs"
                  />
                  <Button type="button" disabled={!channelIsActive || busy === "slug"} onClick={() => void savePublicSlug()}>
                    {busy === "slug" ? <Loader2 className="size-4 animate-spin" /> : "Save code"}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs text-muted-foreground hover:text-foreground/80"
                  disabled={!channelIsActive || busy === "rotate-public"}
                  onClick={() => void rotatePublicUuid()}
                >
                  Regenerate long fallback link (UUID)
                </Button>
              </section>
            ) : null}

            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">QR codes</h3>
              <div className="grid gap-6 sm:grid-cols-2">
                <QrTile
                  title="Private invite"
                  subtitle="Guests paste the code above"
                  value={privateJoinUrl}
                  disabled={!privateJoinUrl}
                  onCopy={() => privateJoinUrl && void copyText(privateJoinUrl, showToast)}
                />
                {publicJoinUrl ? (
                  <QrTile
                    title="Public link"
                    subtitle={publicJoinSlugSaved ? `Code: ${publicJoinSlugSaved}` : "UUID fallback"}
                    value={publicJoinUrl}
                    onCopy={() => void copyText(publicJoinUrl, showToast)}
                  />
                ) : null}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="people" className="space-y-6">
            <section className="overflow-hidden rounded-2xl border border-border/70 bg-background/35">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground/80">Pending join requests</h3>
                <Button variant="secondary" size="sm" onClick={() => void loadJoinRequests()}>
                  Refresh
                </Button>
              </div>
              <div className="p-4">
                {joinRequests.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No pending requests.</p>
                ) : (
                  <div className="space-y-2">
                    {joinRequests.map((jr) => (
                      <div
                        key={jr.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-card/40 px-3 py-2.5 text-sm"
                      >
                        <span className="font-medium text-foreground">@{jr.username}</span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                await approveJoinRequest(channelId, jr.id);
                                showToast("Approved.", "success");
                                await loadJoinRequests();
                                await loadMembers();
                              } catch (error) {
                                showToast(error instanceof Error ? error.message : "Approve failed.", "error");
                              }
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                              try {
                                await rejectJoinRequest(channelId, jr.id);
                                showToast("Rejected.", "info");
                                await loadJoinRequests();
                              } catch (error) {
                                showToast(error instanceof Error ? error.message : "Reject failed.", "error");
                              }
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border/70 bg-background/35">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground/80">Members</h3>
                <Button variant="secondary" size="sm" onClick={() => void loadMembers()}>
                  Refresh
                </Button>
              </div>
              <ScrollArea className="h-[min(360px,45vh)]">
                <div className="space-y-2 p-4 pr-3">
                  {members.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No members yet.</p> : null}
                  {members.map((member) => (
                    <div key={member.id} className="rounded-xl border border-border/80 bg-card/40 p-3">
                      <p className="truncate text-sm font-medium text-foreground">@{member.username}</p>
                      {member.is_active ? (
                        <ChannelMemberRosterActions
                          key={`${member.id}-${member.role}`}
                          channelId={channelId}
                          member={member}
                          isOwnerViewer={canDeleteChannel}
                          channelIsActive={channelIsActive}
                          onUpdated={loadMembers}
                          layout="inline"
                          className="mt-2 border-t-0 pt-0"
                        />
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">Inactive</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </section>
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={deleteChannelDialogOpen} onOpenChange={setDeleteChannelDialogOpen}>
        <DialogContent className="border-red-900/40">
          <DialogHeader>
            <DialogTitle>Delete this channel?</DialogTitle>
            <DialogDescription>
              This removes the channel, playlists, queue state, and memberships for everyone. This action cannot be undone. Only the channel owner
              can delete the room.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="secondary" disabled={deleteChannelBusy} onClick={() => setDeleteChannelDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={deleteChannelBusy} onClick={() => void confirmDeleteChannel()}>
              {deleteChannelBusy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
