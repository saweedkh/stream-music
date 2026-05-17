"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Loader2, RefreshCw, Users } from "lucide-react";
import { useChannelPresence } from "@/hooks/use-channel-presence";
import { useTranslations } from "@/components/providers/locale-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChannelAdminInlineShell } from "@/features/channels/channel-admin-inline-shell";
import { adminSectionLabel } from "@/features/channels/channel-admin-panel-styles";
import { useToast } from "@/components/ui/toast-provider";
import { getChannelMembers, type ChannelMember } from "@/lib/api";
import { ChannelMemberRosterActions } from "@/features/channels/channel-member-roster-actions";
import { cn } from "@/lib/utils";

type Props = {
  channelId: string;
  canManage?: boolean;
  isOwner?: boolean;
  channelIsActive?: boolean;
  onPreviewListenerView?: () => void;
  embedded?: boolean;
};

function roleBadgeVariant(role: ChannelMember["role"]): "default" | "success" | "secondary" {
  if (role === "owner") return "success";
  if (role === "moderator") return "default";
  return "secondary";
}

export function ChannelListenersPanel({
  channelId,
  canManage = false,
  isOwner = false,
  channelIsActive = true,
  onPreviewListenerView,
  embedded = true,
}: Props) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const { onlineMembers, onlineCount, onlineIds } = useChannelPresence(channelId);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getChannelMembers(channelId);
      setMembers(data.results);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Cannot load members.", "error");
    } finally {
      setLoading(false);
    }
  }, [channelId, showToast]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const activeMembers = useMemo(() => members.filter((m) => m.is_active), [members]);
  const inactiveMembers = useMemo(() => members.filter((m) => !m.is_active), [members]);

  const headerActions = (
    <>
      <Button type="button" variant="secondary" size="sm" className="h-9 gap-2" disabled={loading} onClick={() => void loadMembers()}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        {t("room.admin.listeners.refresh")}
      </Button>
      {onPreviewListenerView ? (
        <Button type="button" size="sm" className="h-9 gap-2" onClick={onPreviewListenerView}>
          <Eye className="size-4" />
          {t("room.admin.listeners.preview")}
        </Button>
      ) : null}
    </>
  );

  const body = (
    <div className="space-y-6 px-1 pb-2">
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className={adminSectionLabel}>{t("room.admin.listeners.online")}</p>
          <Badge variant="success">{t("room.admin.listeners.onlineCount", { count: onlineCount })}</Badge>
        </div>
        {onlineMembers.length === 0 ? (
          <p className="rounded-lg px-2 py-6 text-center text-sm text-muted-foreground">{t("room.admin.listeners.onlineEmpty")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {onlineMembers.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-full border border-brand/25 bg-[var(--brand-subtle)] py-1 pl-1 pr-3"
              >
                <Avatar className="h-8 w-8 border border-brand/40">
                  <AvatarFallback className="text-xs">{(m.username || "?").slice(0, 1)}</AvatarFallback>
                </Avatar>
                <span className="text-sm text-foreground">@{m.username}</span>
                <span className="h-2 w-2 rounded-full bg-brand" title={t("room.admin.listeners.onlineStatus")} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2">
          <p className={adminSectionLabel}>
            {t("room.admin.listeners.roster")} ({activeMembers.length})
          </p>
          {canManage ? <p className="mt-1 text-xs text-muted-foreground">{t("room.admin.listeners.rosterHint")}</p> : null}
        </div>
        {loading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : activeMembers.length === 0 && inactiveMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <Users className="size-10 text-muted-foreground/50" aria-hidden />
            <p className="text-sm font-medium text-foreground">{t("room.admin.listeners.empty")}</p>
            <p className="max-w-sm text-xs text-muted-foreground">{t("room.admin.listeners.emptyHint")}</p>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {activeMembers.map((member) => {
              const isOnline = onlineIds.has(member.user_id);
              return (
                <li
                  key={member.id}
                  className={cn(
                    "rounded-lg px-2 py-2.5 transition-colors",
                    isOnline ? "bg-brand/8 hover:bg-brand/12" : "hover:bg-muted/30",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback>{(member.username || "?").slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">@{member.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("room.admin.listeners.joined", {
                          date: new Date(member.joined_at).toLocaleDateString(),
                        })}
                        {" · "}
                        {isOnline ? t("room.admin.listeners.onlineStatus") : t("room.admin.listeners.offlineStatus")}
                      </p>
                    </div>
                    <Badge variant={roleBadgeVariant(member.role)} className="shrink-0 capitalize">
                      {member.role}
                    </Badge>
                  </div>
                  {canManage ? (
                    <ChannelMemberRosterActions
                      key={`${member.id}-${member.role}`}
                      channelId={channelId}
                      member={member}
                      isOwnerViewer={isOwner}
                      channelIsActive={channelIsActive}
                      onUpdated={loadMembers}
                    />
                  ) : null}
                </li>
              );
            })}
            {inactiveMembers.length > 0 ? (
              <>
                <li className="px-2 pt-4 pb-1">
                  <p className={adminSectionLabel}>{t("room.admin.listeners.leftRoom")}</p>
                </li>
                {inactiveMembers.map((member) => (
                  <li key={member.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5 opacity-60 hover:bg-muted/20">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{(member.username || "?").slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-muted-foreground">@{member.username}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 capitalize">
                      {member.role}
                    </Badge>
                  </li>
                ))}
              </>
            ) : null}
          </ul>
        )}
      </section>
    </div>
  );

  if (!embedded) {
    return body;
  }

  return (
    <ChannelAdminInlineShell
      icon={Users}
      title={t("room.admin.tab.listeners.title")}
      subtitle={t("room.admin.tab.listeners.description")}
      actions={headerActions}
    >
      {body}
    </ChannelAdminInlineShell>
  );
}
