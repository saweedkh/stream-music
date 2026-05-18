"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-provider";
import {
  removeChannelMember,
  updateChannelMemberRole,
  updateChannelSettings,
  type ChannelMember,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  channelId: string;
  member: ChannelMember;
  isOwnerViewer: boolean;
  channelIsActive?: boolean;
  onUpdated: () => void | Promise<void>;
  layout?: "inline" | "stacked";
  className?: string;
};

export function ChannelMemberRosterActions({
  channelId,
  member,
  isOwnerViewer,
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

  async function handoffDj() {
    setBusy("dj");
    try {
      await updateChannelSettings(channelId, { experience: { current_dj_user_id: member.user_id } });
      showToast(t("room.member.djHandoff", { username: member.username }), "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("room.member.djHandoffFailed"), "error");
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8"
        disabled={!channelIsActive || busy !== null}
        onClick={() => void handoffDj()}
      >
        {busy === "dj" ? "…" : t("room.member.setDj")}
      </Button>
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

