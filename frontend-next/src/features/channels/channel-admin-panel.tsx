"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-provider";
import {
  controlChannel,
  createInvite,
  getChannelMembers,
  removeChannelMember,
  rotatePrivateInvite,
  rotatePublicLink,
  updateChannelMemberRole,
  updateChannelSettings,
  type ChannelMember,
} from "@/lib/api";
import { channelSettingsSchema } from "@/lib/validation";

type Props = {
  channelId: string;
  initialName?: string;
  initialDescription?: string;
  initialPrivacy?: "public" | "private" | "unlisted";
  initialMemberLimit?: number;
  publicSlug?: string;
};

const actions = [
  { action: "play", label: "Play" },
  { action: "pause", label: "Pause" },
  { action: "seek", label: "Seek +15s", payload: { position: 15 } },
  { action: "prev", label: "Prev" },
  { action: "next", label: "Next" }
];

export function ChannelAdminPanel({
  channelId,
  initialName = "",
  initialDescription = "",
  initialPrivacy = "public",
  initialMemberLimit = 50,
  publicSlug,
}: Props) {
  const { showToast } = useToast();
  const [seekSeconds, setSeekSeconds] = useState("15");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [privacy, setPrivacy] = useState<"public" | "private" | "unlisted">(initialPrivacy);
  const [memberLimit, setMemberLimit] = useState(String(initialMemberLimit));
  const [publicUrl, setPublicUrl] = useState(publicSlug ? `/join/public/${publicSlug}` : "");
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function control(action: string, payload?: Record<string, unknown>) {
    setBusyAction(action);
    setFeedback(`Applying ${action}...`);
    try {
      await controlChannel(channelId, action as "play" | "pause" | "seek" | "next" | "prev", payload);
      setFeedback(`Action "${action}" applied.`);
    } catch {
      setFeedback(`Action "${action}" failed. Check auth/session permissions.`);
      showToast(`Action "${action}" failed.`, "error");
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
    } catch {
      setFeedback("Invite generation failed. Only controllers can generate invites.");
      showToast("Invite generation failed.", "error");
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
      });
      setFeedback("Channel settings updated.");
    } catch {
      setFeedback("Failed to update channel settings.");
      showToast("Failed to update channel settings.", "error");
    }
  }

  async function loadMembers() {
    setFeedback("Loading members...");
    try {
      const data = await getChannelMembers(channelId);
      setMembers(data.results);
      setFeedback("Members loaded.");
    } catch {
      setFeedback("Cannot load members.");
      showToast("Cannot load members.", "error");
    }
  }

  async function rotatePrivate() {
    try {
      const data = await rotatePrivateInvite(channelId);
      setInviteToken(data.token);
      setFeedback("Private invite rotated.");
    } catch {
      setFeedback("Private invite rotation failed.");
      showToast("Private invite rotation failed.", "error");
    }
  }

  async function rotatePublic() {
    try {
      const data = await rotatePublicLink(channelId);
      setPublicUrl(data.public_url);
      setFeedback("Public link rotated.");
    } catch {
      setFeedback("Public link rotation failed.");
      showToast("Public link rotation failed.", "error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Channel Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {actions.map((item) => (
            <Button
              key={item.action}
              variant="secondary"
              onClick={() => control(item.action, item.action === "seek" ? { position: Number(seekSeconds) || 0 } : item.payload)}
              disabled={busyAction !== null}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="space-y-2">
          <Label>Seek position (seconds)</Label>
          <Input value={seekSeconds} onChange={(e) => setSeekSeconds(e.target.value)} />
        </div>
        <Button onClick={generateInvite}>Generate invite token</Button>
        <div className="grid gap-2 rounded-md border border-slate-800 p-3">
          <p className="text-xs text-slate-400">Channel settings</p>
          <Input
            value={name}
            aria-invalid={Boolean(fieldErrors.name)}
            valid={Boolean(name.trim())}
            onChange={(e) => setName(e.target.value)}
            placeholder="Channel name"
          />
          {fieldErrors.name ? <p className="text-xs text-rose-400">{fieldErrors.name}</p> : null}
          <Input value={description} valid={Boolean(description.trim())} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
          <Select value={privacy} valid={Boolean(privacy)} onChange={(e) => setPrivacy(e.target.value as "public" | "private" | "unlisted")}>
            <option value="public">public</option>
            <option value="private">private</option>
            <option value="unlisted">unlisted</option>
          </Select>
          <Input
            value={memberLimit}
            aria-invalid={Boolean(fieldErrors.memberLimit)}
            valid={Boolean(memberLimit.trim() && Number(memberLimit) > 0)}
            onChange={(e) => setMemberLimit(e.target.value)}
            placeholder="Member limit"
          />
          {fieldErrors.memberLimit ? <p className="text-xs text-rose-400">{fieldErrors.memberLimit}</p> : null}
          <Button variant="secondary" onClick={saveSettings}>
            Save settings
          </Button>
        </div>
        <div className="grid gap-2 rounded-md border border-slate-800 p-3">
          <p className="text-xs text-slate-400">Invite links</p>
          <Button variant="secondary" onClick={rotatePrivate}>
            Rotate private invite
          </Button>
          <Button variant="secondary" onClick={rotatePublic}>
            Rotate public link
          </Button>
          {publicUrl ? <Alert>Public URL: {publicUrl}</Alert> : null}
        </div>
        <div className="grid gap-2 rounded-md border border-slate-800 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Members management</p>
            <Button variant="secondary" onClick={loadMembers}>
              Refresh members
            </Button>
          </div>
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-24">{member.username}</span>
              <Input
                value={member.role}
                onChange={(e) =>
                  setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, role: e.target.value as ChannelMember["role"] } : m)))
                }
                className="h-8"
              />
              <Button variant="secondary" className="px-2 py-1" onClick={() => updateChannelMemberRole(channelId, member.id, member.role)}>
                Save role
              </Button>
              <Button variant="danger" className="px-2 py-1" onClick={() => removeChannelMember(channelId, member.id).then(loadMembers)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
        {inviteToken ? <Alert tone="success">Invite token: {inviteToken}</Alert> : null}
        {feedback ? <Alert>{feedback}</Alert> : null}
      </CardContent>
    </Card>
  );
}
