"use client";

import {
  Copy,
  Link2,
  Loader2,
  Radio,
  RefreshCw,
  Shield,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import QRCode from "react-qr-code";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast-provider";
import {
  approveJoinRequest,
  buildJoinUrlWithChannelId,
  buildPrivateInviteJoinUrl,
  buildPublicJoinUrl,
  createInvite,
  getChannelMembers,
  listChannelInvites,
  listChannelJoinRequests,
  rejectJoinRequest,
  removeChannelMember,
  rotatePrivateInvite,
  rotatePublicLink,
  updateChannelMemberRole,
  updateChannelSettings,
  type ChannelMember,
  type JoinRequestRow,
} from "@/lib/api";
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
        "flex flex-col items-center gap-3 rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/80 to-zinc-950/90 p-5 text-center shadow-inner",
        disabled && "opacity-50",
      )}
    >
      <div>
        <p className="text-sm font-semibold text-zinc-100">{title}</p>
        {subtitle ? <p className="mt-1 text-xs text-zinc-500">{subtitle}</p> : null}
      </div>
      {value ? (
        <button
          type="button"
          onClick={onCopy}
          className="group rounded-2xl bg-white p-3 shadow-lg ring-2 ring-transparent transition hover:ring-emerald-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          title="Click to copy link"
        >
          <QRCode value={value} size={168} className="h-[168px] w-[168px]" />
          <span className="mt-2 block text-[11px] font-medium text-zinc-600 group-hover:text-emerald-700">
            Tap to copy link
          </span>
        </button>
      ) : (
        <div className="flex h-[196px] w-[196px] items-center justify-center rounded-2xl border border-dashed border-zinc-700/80 bg-zinc-950/50 text-xs text-zinc-500">
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
}: Props) {
  const { showToast } = useToast();
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

  const numericId = String(channelId);
  const idJoinUrl = typeof window !== "undefined" ? buildJoinUrlWithChannelId(channelId) : "";
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

  const canPublicSlug = privacy === "public" || privacy === "unlisted";

  return (
    <Card className="overflow-hidden border-zinc-800/90 shadow-xl shadow-black/25">
      <CardHeader className="border-b border-zinc-800/80 bg-gradient-to-r from-zinc-950 via-zinc-900/95 to-emerald-950/20 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-950/50 text-emerald-400 shadow-lg shadow-emerald-900/20">
              <Radio className="size-5" />
            </span>
            <div>
              <CardTitle className="text-xl text-white">Control room</CardTitle>
              <CardDescription className="mt-1 max-w-xl text-zinc-400">
                Tune the room, share short join codes, and manage members — without juggling long URLs.
              </CardDescription>
            </div>
          </div>
          {!channelIsActive ? (
            <Badge variant="secondary" className="border-amber-800/50 bg-amber-950/40 text-amber-200">
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
              <div className="space-y-4 rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Room profile</h3>
                <div className="space-y-2">
                  <Label htmlFor={`ch-name-${channelId}`}>Name</Label>
                  <Input
                    id={`ch-name-${channelId}`}
                    value={name}
                    aria-invalid={Boolean(fieldErrors.name)}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Channel name"
                    className="border-zinc-800 bg-zinc-900/80"
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
                    className="flex w-full resize-none rounded-md border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`ch-privacy-${channelId}`}>Privacy</Label>
                  <Select
                    id={`ch-privacy-${channelId}`}
                    value={privacy}
                    onChange={(e) => setPrivacy(e.target.value as typeof privacy)}
                    className="border-zinc-800 bg-zinc-900/80"
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
                    className="border-zinc-800 bg-zinc-900/80"
                  />
                  {fieldErrors.memberLimit ? <p className="text-xs text-red-400">{fieldErrors.memberLimit}</p> : null}
                </div>
              </div>

              <div className="flex flex-col justify-between gap-4 rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-5">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Access rules</h3>
                  <p className="mt-2 text-sm text-zinc-500">
                    When enabled, new members wait in a queue until a moderator approves them.
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800/60 bg-zinc-900/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">Require approval to join</p>
                    <p className="text-xs text-zinc-500">Recommended for open rooms</p>
                  </div>
                  <Switch checked={joinRequiresApproval} onCheckedChange={setJoinRequiresApproval} id={`ch-approval-${channelId}`} />
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-500"
                  disabled={!channelIsActive || busy === "settings"}
                  onClick={() => void saveSettings()}
                >
                  {busy === "settings" ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save settings
                </Button>
              </div>
            </div>

            <div className="h-px bg-zinc-800/90" />

            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/30 p-5">
              <h3 className="text-sm font-semibold text-zinc-200">Playback (WebSocket)</h3>
              <p className="mt-1 text-xs text-zinc-500">Quick transport controls for testing sync from this tab.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["play", "pause", "next", "prev"] as const).map((a) => (
                  <Button
                    key={a}
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!channelIsActive || Boolean(busy)}
                    onClick={() => void control(a)}
                  >
                    {a}
                  </Button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="invites" className="space-y-8">
            <section className="rounded-2xl border border-emerald-900/30 bg-gradient-to-br from-emerald-950/30 to-zinc-950/40 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="size-4 text-emerald-400" />
                    <h3 className="font-semibold text-zinc-100">Private invite</h3>
                  </div>
                  <p className="mt-1 max-w-lg text-sm text-zinc-500">
                    Every room has an active invite code. Guests enter <strong className="text-zinc-300">only this code</strong> (or scan QR)
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
                  <code className="flex-1 rounded-lg border border-zinc-800 bg-black/40 px-3 py-2 font-mono text-sm text-emerald-200">
                    {inviteToken}
                  </code>
                  <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => void copyText(inviteToken, showToast)}>
                    <Copy className="size-3.5" />
                    Copy code
                  </Button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">Loading invite…</p>
              )}
            </section>

            {canPublicSlug && publicSlug ? (
              <section className="rounded-2xl border border-zinc-800/70 bg-zinc-950/40 p-5">
                <div className="flex items-center gap-2">
                  <UserPlus className="size-4 text-sky-400" />
                  <h3 className="font-semibold text-zinc-100">Public join code</h3>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  Set a short memorable code (letters, numbers, hyphens). Guests type this code to join — or use the numeric room id.
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <Input
                    value={publicJoinSlugDraft}
                    onChange={(e) => setPublicJoinSlugDraft(e.target.value)}
                    placeholder="e.g. friday-jams"
                    className="border-zinc-800 bg-zinc-900/80 font-mono sm:max-w-xs"
                  />
                  <Button type="button" disabled={!channelIsActive || busy === "slug"} onClick={() => void savePublicSlug()}>
                    {busy === "slug" ? <Loader2 className="size-4 animate-spin" /> : "Save code"}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
                  disabled={!channelIsActive || busy === "rotate-public"}
                  onClick={() => void rotatePublicUuid()}
                >
                  Regenerate long fallback link (UUID)
                </Button>
              </section>
            ) : null}

            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">QR codes</h3>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <QrTile
                  title="Room id"
                  subtitle={`Code: ${numericId}`}
                  value={idJoinUrl || null}
                  disabled={!idJoinUrl}
                  onCopy={() => void copyText(idJoinUrl, showToast)}
                />
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
            <section className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-950/35">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 px-4 py-3">
                <h3 className="text-sm font-semibold text-zinc-300">Pending join requests</h3>
                <Button variant="secondary" size="sm" onClick={() => void loadJoinRequests()}>
                  Refresh
                </Button>
              </div>
              <div className="p-4">
                {joinRequests.length === 0 ? (
                  <p className="py-6 text-center text-sm text-zinc-500">No pending requests.</p>
                ) : (
                  <div className="space-y-2">
                    {joinRequests.map((jr) => (
                      <div
                        key={jr.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-3 py-2.5 text-sm"
                      >
                        <span className="font-medium text-zinc-200">@{jr.username}</span>
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

            <section className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-950/35">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 px-4 py-3">
                <h3 className="text-sm font-semibold text-zinc-300">Members</h3>
                <Button variant="secondary" size="sm" onClick={() => void loadMembers()}>
                  Refresh
                </Button>
              </div>
              <ScrollArea className="h-[min(360px,45vh)]">
                <div className="space-y-2 p-4 pr-3">
                  {members.length === 0 ? <p className="py-6 text-center text-sm text-zinc-500">No members yet.</p> : null}
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="grid gap-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 text-xs md:grid-cols-[1fr_minmax(0,140px)_auto_auto] md:items-center"
                    >
                      <span className="min-w-0 truncate font-medium text-zinc-200">{member.username}</span>
                      <Select
                        id={`m-${member.id}-role`}
                        aria-label={`Role for ${member.username}`}
                        value={member.role}
                        className="border-zinc-800 bg-zinc-950/80"
                        onChange={(e) =>
                          setMembers((prev) =>
                            prev.map((m) => (m.id === member.id ? { ...m, role: e.target.value as ChannelMember["role"] } : m)),
                          )
                        }
                      >
                        <option value="owner">Owner</option>
                        <option value="moderator">Moderator</option>
                        <option value="member">Member</option>
                      </Select>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="md:justify-self-end"
                        onClick={async () => {
                          try {
                            await updateChannelMemberRole(channelId, member.id, member.role);
                            showToast(`Role updated for ${member.username}.`, "success");
                          } catch (error) {
                            showToast(error instanceof Error ? error.message : "Cannot update role.", "error");
                          }
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="md:justify-self-end"
                        onClick={async () => {
                          try {
                            await removeChannelMember(channelId, member.id);
                            showToast(`Removed ${member.username}.`, "success");
                            await loadMembers();
                          } catch (error) {
                            showToast(error instanceof Error ? error.message : "Cannot remove.", "error");
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </section>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
