"use client";

import { Radio } from "lucide-react";
import QRCode from "react-qr-code";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast-provider";
import {
  approveJoinRequest,
  buildJoinUrlWithChannelId,
  buildPrivateInviteJoinUrl,
  createInvite,
  getChannelMembers,
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

type Props = {
  channelId: string;
  initialName?: string;
  initialDescription?: string;
  initialPrivacy?: "public" | "private" | "unlisted";
  initialMemberLimit?: number;
  publicSlug?: string;
  initialJoinRequiresApproval?: boolean;
  sendSocketMessage?: (payload: Record<string, unknown>) => boolean;
  channelIsActive?: boolean;
};

export function ChannelAdminPanel({
  channelId,
  initialName = "",
  initialDescription = "",
  initialPrivacy = "public",
  initialMemberLimit = 50,
  publicSlug,
  initialJoinRequiresApproval = false,
  sendSocketMessage,
  channelIsActive = true,
}: Props) {
  const { showToast } = useToast();
  const [seekSeconds, setSeekSeconds] = useState("10");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [privacy, setPrivacy] = useState<"public" | "private" | "unlisted">(initialPrivacy);
  const [memberLimit, setMemberLimit] = useState(String(initialMemberLimit));
  const [publicUrl, setPublicUrl] = useState(publicSlug ? `/join/public/${publicSlug}` : "");
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [joinRequiresApproval, setJoinRequiresApproval] = useState(Boolean(initialJoinRequiresApproval));
  const [joinRequests, setJoinRequests] = useState<JoinRequestRow[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const loadJoinRequests = useCallback(async () => {
    try {
      const data = await listChannelJoinRequests(channelId);
      setJoinRequests(data.results);
    } catch {
      setJoinRequests([]);
    }
  }, [channelId]);

  useEffect(() => {
    void loadMembers();
  }, [channelId]);

  useEffect(() => {
    void loadJoinRequests();
  }, [loadJoinRequests]);

  async function control(action: string, payload?: Record<string, unknown>) {
    if (!channelIsActive) return;
    setBusyAction(action);
    setFeedback(`Applying ${action}...`);
    try {
      const sent = sendSocketMessage?.({ action, ...payload });
      if (!sent) throw new Error("Socket is not connected");
      setFeedback(`Action "${action}" applied.`);
      showToast(`Action "${action}" applied.`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : `Action "${action}" failed.`;
      setFeedback(message);
      showToast(message, "error");
    } finally {
      setBusyAction(null);
    }
  }

  async function generateInvite() {
    setFeedback("Creating invite token...");
    try {
      const data = await createInvite(channelId);
      setInviteToken(data.token);
      setFeedback("Invite token generated.");
      showToast("Invite token generated.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invite generation failed.";
      setFeedback(message);
      showToast(message, "error");
    }
  }

  async function saveSettings() {
    setFeedback("Saving channel settings...");
    const result = channelSettingsSchema.safeParse({ name, memberLimit });
    const nextErrors: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? "");
        if (field === "name" || field === "memberLimit") {
          nextErrors[field] = issue.message;
        }
      }
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      showToast("Please fix channel settings fields.", "error");
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
      setFeedback("Channel settings updated.");
      showToast("Channel settings updated.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update channel settings.";
      setFeedback(message);
      showToast(message, "error");
    }
  }

  async function loadMembers() {
    try {
      const data = await getChannelMembers(channelId);
      setMembers(data.results);
      setFeedback(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cannot load members.";
      setFeedback(message);
      showToast(message, "error");
    }
  }

  async function rotatePrivate() {
    try {
      const data = await rotatePrivateInvite(channelId);
      setInviteToken(data.token);
      setFeedback("Private invite rotated.");
      showToast("Private invite rotated.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Private invite rotation failed.";
      setFeedback(message);
      showToast(message, "error");
    }
  }

  async function rotatePublic() {
    try {
      const data = await rotatePublicLink(channelId);
      setPublicUrl(data.public_url);
      setFeedback("Public link rotated.");
      showToast("Public link rotated.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Public link rotation failed.";
      setFeedback(message);
      showToast(message, "error");
    }
  }

  return (
    <Card className="overflow-hidden border-zinc-800/90 transition-shadow duration-300 hover:shadow-lg hover:shadow-black/20">
      <CardHeader className="border-b border-zinc-800/80 pb-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-950/40 text-emerald-400">
            <Radio className="size-4" />
          </span>
          <div className="space-y-1">
            <CardTitle className="text-lg">Admin</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <section className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-200">Playback</p>
            {busyAction ? (
              <Badge variant="warning" className="animate-pulse">
                {busyAction}
              </Badge>
            ) : (
              <Badge variant="success">Ready</Badge>
            )}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <Button
              onClick={() => control("play")}
              disabled={busyAction !== null || !channelIsActive}
              className="transition-transform duration-200 active:scale-[0.98]"
            >
              Play
            </Button>
            <Button variant="secondary" onClick={() => control("pause")} disabled={busyAction !== null || !channelIsActive}>
              Pause
            </Button>
            <Button variant="secondary" onClick={() => control("prev")} disabled={busyAction !== null || !channelIsActive}>
              Previous
            </Button>
            <Button variant="secondary" onClick={() => control("next")} disabled={busyAction !== null || !channelIsActive}>
              Next
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <div className="min-w-40 flex-1 space-y-2">
              <Label htmlFor={`channel-${channelId}-seek-seconds`}>Seek (seconds)</Label>
              <Input
                id={`channel-${channelId}-seek-seconds`}
                name="seek_seconds"
                type="number"
                inputMode="numeric"
                value={seekSeconds}
                valid={seekSeconds.trim() !== "" && !Number.isNaN(Number(seekSeconds))}
                onChange={(e) => setSeekSeconds(e.target.value)}
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => control("seek", { position: Number(seekSeconds) || 0 })}
              disabled={busyAction !== null || !channelIsActive}
            >
              Seek
            </Button>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-3 rounded-lg border border-zinc-800/80 bg-zinc-950/35 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Channel</p>
            <div className="space-y-2">
              <Label htmlFor={`channel-${channelId}-settings-name`}>Name</Label>
              <Input
                id={`channel-${channelId}-settings-name`}
                name="channel_name"
                value={name}
                aria-invalid={Boolean(fieldErrors.name)}
                valid={Boolean(name.trim())}
                onChange={(e) => setName(e.target.value)}
                placeholder="Channel name"
              />
              {fieldErrors.name ? <p className="text-xs text-red-400">{fieldErrors.name}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`channel-${channelId}-settings-description`}>Description</Label>
              <Input
                id={`channel-${channelId}-settings-description`}
                name="channel_description"
                value={description}
                valid={Boolean(description.trim())}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`channel-${channelId}-settings-privacy`}>Privacy</Label>
              <Select
                id={`channel-${channelId}-settings-privacy`}
                name="channel_privacy"
                value={privacy}
                valid={Boolean(privacy)}
                onChange={(e) => setPrivacy(e.target.value as "public" | "private" | "unlisted")}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`channel-${channelId}-settings-member-limit`}>Member limit</Label>
              <Input
                id={`channel-${channelId}-settings-member-limit`}
                name="channel_member_limit"
                type="number"
                inputMode="numeric"
                value={memberLimit}
                aria-invalid={Boolean(fieldErrors.memberLimit)}
                valid={Boolean(memberLimit.trim() && Number(memberLimit) > 0)}
                onChange={(e) => setMemberLimit(e.target.value)}
                placeholder="Member limit"
              />
              {fieldErrors.memberLimit ? <p className="text-xs text-red-400">{fieldErrors.memberLimit}</p> : null}
            </div>
            <div className="flex gap-3 rounded-lg border border-zinc-800/60 bg-zinc-950/50 p-3">
              <input
                type="checkbox"
                id={`channel-${channelId}-join-approval`}
                checked={joinRequiresApproval}
                onChange={(e) => setJoinRequiresApproval(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-900"
              />
              <label htmlFor={`channel-${channelId}-join-approval`} className="text-sm leading-snug text-zinc-300">
                <span className="font-medium text-zinc-100">Require approval to join</span>
              </label>
            </div>
            <Button variant="secondary" className="w-full" onClick={saveSettings}>
              Save settings
            </Button>
          </section>

          <section className="space-y-3 rounded-lg border border-zinc-800/80 bg-zinc-950/35 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Invites</p>
            <Button className="w-full" onClick={generateInvite}>
              Generate invite token
            </Button>
            <Button variant="secondary" className="w-full" onClick={rotatePrivate}>
              Rotate private invite
            </Button>
            <Button variant="secondary" className="w-full" onClick={rotatePublic}>
              Rotate public link
            </Button>
            {publicUrl ? (
              <Alert>
                <span className="break-all">Public URL: {publicUrl}</span>
              </Alert>
            ) : null}
            {inviteToken ? (
              <Alert tone="success">
                <span className="break-all">Invite token: {inviteToken}</span>
              </Alert>
            ) : null}
          </section>
        </div>

        <section className="space-y-4 rounded-lg border border-zinc-800/80 bg-zinc-950/35 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Join QR codes</p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm font-medium text-zinc-200">Channel #{channelId}</p>
              <div className="rounded-lg bg-white p-3 shadow-inner">
                <QRCode value={buildJoinUrlWithChannelId(channelId)} size={160} />
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm font-medium text-zinc-200">Private invite</p>
              {inviteToken ? (
                <>
                  <div className="rounded-lg bg-white p-3 shadow-inner">
                    <QRCode value={buildPrivateInviteJoinUrl(inviteToken)} size={192} />
                  </div>
                </>
              ) : (
                <p className="py-6 text-sm text-zinc-500">Generate an invite token to show the private QR.</p>
              )}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-950/35">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Pending join requests</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void loadJoinRequests();
              }}
            >
              Refresh
            </Button>
          </div>
          <div className="p-4">
            {joinRequests.length === 0 ? (
              <p className="py-2 text-center text-sm text-zinc-500">No pending requests.</p>
            ) : (
              <div className="space-y-2">
                {joinRequests.map((jr: JoinRequestRow) => (
                  <div
                    key={jr.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/50 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-zinc-200">@{jr.username}</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            await approveJoinRequest(channelId, jr.id);
                            showToast("Member approved.", "success");
                            await loadJoinRequests();
                            await loadMembers();
                          } catch (error) {
                            const message = error instanceof Error ? error.message : "Approve failed.";
                            showToast(message, "error");
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
                            showToast("Request rejected.", "info");
                            await loadJoinRequests();
                          } catch (error) {
                            const message = error instanceof Error ? error.message : "Reject failed.";
                            showToast(message, "error");
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

        <section className="overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-950/35">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/80 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Members</p>
            <Button variant="secondary" size="sm" onClick={loadMembers}>
              Refresh
            </Button>
          </div>
          <ScrollArea className="h-[min(320px,40vh)]">
            <div className="space-y-2 p-4 pr-3">
              {members.length === 0 ? <p className="py-4 text-center text-sm text-zinc-500">No members yet.</p> : null}
              {members.map((member) => (
                <div
                  key={member.id}
                  className="grid gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/50 p-3 text-xs md:grid-cols-[1fr_minmax(0,140px)_auto_auto] md:items-center"
                >
                  <span className="min-w-0 truncate font-medium text-zinc-200">{member.username}</span>
                  <Select
                    id={`channel-${channelId}-member-${member.id}-role`}
                    name={`member_role_${member.id}`}
                    aria-label={`Role for ${member.username}`}
                    value={member.role}
                    onChange={(e) =>
                      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role: e.target.value as ChannelMember["role"] } : m)))
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
                        const message = error instanceof Error ? error.message : "Cannot update member role.";
                        showToast(message, "error");
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
                        const message = error instanceof Error ? error.message : "Cannot remove member.";
                        showToast(message, "error");
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

        {feedback ? (
          <>
            <Separator />
            <Alert>{feedback}</Alert>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
