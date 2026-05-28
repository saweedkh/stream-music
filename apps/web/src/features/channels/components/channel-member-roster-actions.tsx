"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";
import { Select } from "@/shared/ui/select";
import { useToast } from "@/shared/ui/toast-provider";
import {
  banChannelMember,
  removeChannelMember,
  unbanChannelMember,
  updateChannelMemberRole,
  type ChannelMember,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  channelId: string;
  member: ChannelMember;
  isOwnerViewer: boolean;
  canModerate?: boolean;
  channelIsActive?: boolean;
  onUpdated: () => void | Promise<void>;
  layout?: "inline" | "stacked";
  className?: string;
};

export function ChannelMemberRosterActions({
  channelId,
  member,
  isOwnerViewer,
  canModerate = false,
  channelIsActive = true,
  onUpdated,
  layout = "stacked",
  className,
}: Props) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [role, setRole] = useState(member.role);
  const [busy, setBusy] = useState<string | null>(null);
  const isOwnerMember = member.role === "owner";

  useEffect(() => {
    setRole(member.role);
  }, [member.role]);

  async function saveRole() {
    setBusy("role");
    try {
      await updateChannelMemberRole(channelId, member.id, role);
      showToast(t("room.member.roleUpdated", { username: member.username }), "success");
      await onUpdated();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("room.member.roleUpdateFailed"), "error");
    } finally {
      setBusy(null);
    }
  }

  async function banChat() {
    if (!canModerate || isOwnerMember) return;
    setBusy("ban");
    try {
      await banChannelMember(channelId, member.user_id, 24);
      showToast(t("room.moderation.banDone"), "success");
      await onUpdated();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("room.member.removeFailed"), "error");
    } finally {
      setBusy(null);
    }
  }

  async function unbanChat() {
    if (!canModerate) return;
    setBusy("unban");
    try {
      await unbanChannelMember(channelId, member.user_id);
      showToast(t("room.moderation.unbanDone"), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("room.member.removeFailed"), "error");
    } finally {
      setBusy(null);
    }
  }

  async function removeMember() {
    if (isOwnerMember) return;
    setBusy("remove");
    try {
      await removeChannelMember(channelId, member.id);
      showToast(t("room.member.removed", { username: member.username }), "success");
      await onUpdated();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("room.member.removeFailed"), "error");
    } finally {
      setBusy(null);
    }
  }

  const controls = (
    <>
      <Select
        aria-label={t("room.member.roleFor", { username: member.username })}
        value={role}
        disabled={!channelIsActive || (isOwnerMember && !isOwnerViewer)}
        className="min-w-[120px] border-border bg-card/80 text-xs"
        onChange={(e) => setRole(e.target.value as ChannelMember["role"])}
      >
        {isOwnerViewer ? <option value="owner">{t("common.owner")}</option> : null}
        <option value="moderator">{t("common.moderator")}</option>
        <option value="member">{t("common.member")}</option>
      </Select>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="h-8"
        disabled={!channelIsActive || busy !== null || role === member.role}
        onClick={() => void saveRole()}
      >
        {busy === "role" ? "…" : t("room.member.saveRole")}
      </Button>
      {canModerate && !isOwnerMember ? (
        <>
          <Button type="button" variant="secondary" size="sm" className="h-8" disabled={!channelIsActive || busy !== null} onClick={() => void banChat()}>
            {busy === "ban" ? "…" : t("room.moderation.ban24h")}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8" disabled={busy !== null} onClick={() => void unbanChat()}>
            {busy === "unban" ? "…" : t("room.moderation.unban")}
          </Button>
        </>
      ) : null}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="h-8"
        disabled={!channelIsActive || busy !== null || isOwnerMember}
        onClick={() => void removeMember()}
      >
        {busy === "remove" ? "…" : t("room.member.remove")}
      </Button>
    </>
  );

  return (
    <div
      className={cn(
        layout === "inline"
          ? "flex flex-wrap items-center gap-1.5"
          : "mt-2 flex flex-wrap gap-1.5 border-t border-border/60 pt-2",
        className,
      )}
    >
      {controls}
    </div>
  );
}

