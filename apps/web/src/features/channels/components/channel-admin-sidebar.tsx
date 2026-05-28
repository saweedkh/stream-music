"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, DoorClosed, Eye, LogOut, Radio, Share2 } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { DashboardAccountSection } from "@/features/dashboard/components/dashboard-account-section";
import {
  ADMIN_LINK_ITEMS,
  adminNavSectionsForContext,
  channelGroupForTab,
  type ChannelTabGroup,
  type ChannelTabId,
} from "@/features/channels/components/channel-room-config";
import { ListenerSidebarReactions } from "@/features/channels/components/listener-sidebar-reactions";
import { NotificationCenter } from "@/shared/notifications/notification-center";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";
import type { AuthUser } from "@/lib/api";
import { cn } from "@/lib/utils";

function SectionDivider() {
  return (
    <div className="py-2" aria-hidden>
      <Separator className="bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
}

type Props = {
  channelName: string;
  isLive: boolean;
  socketState: string;
  channelIsActive: boolean;
  onlineCount?: number | null;
  activeTab: ChannelTabId;
  onSelectTab: (tab: ChannelTabId) => void;
  onSidebarAction?: () => void;
  onShare?: () => void;
  onSendReaction: (emoji: string) => void;
  onViewAsListener?: () => void;
  onLeave?: () => void;
  onCloseChannel?: () => void;
  showLeave?: boolean;
  chatUnread: number;
  pendingSuggestionsCount?: number;
  canManage: boolean;
  className?: string;
  user: AuthUser | null;
};

export function ChannelAdminSidebar({
  channelName,
  isLive,
  socketState,
  channelIsActive,
  onlineCount,
  activeTab,
  onSelectTab,
  onSidebarAction,
  onShare,
  onSendReaction,
  onViewAsListener,
  onLeave,
  onCloseChannel,
  showLeave,
  chatUnread,
  pendingSuggestionsCount = 0,
  canManage,
  className,
  user,
}: Props) {
  const { t } = useTranslations();
  const sections = adminNavSectionsForContext(canManage);
  const activeGroup = channelGroupForTab(activeTab);

  const [expanded, setExpanded] = useState<Record<ChannelTabGroup, boolean>>(() => ({
    listen: activeGroup === "listen",
    social: activeGroup === "social",
    studio: activeGroup === "studio",
  }));

  useEffect(() => {
    setExpanded((prev) => ({
      ...prev,
      [activeGroup]: true,
    }));
  }, [activeGroup]);

  function toggleSection(group: ChannelTabGroup) {
    setExpanded((prev) => ({ ...prev, [group]: !prev[group] }));
  }

  function handleSelectTab(tab: ChannelTabId) {
    onSelectTab(tab);
    onSidebarAction?.();
  }

  const socketLabel =
    socketState === "connected"
      ? t("channels.socket.connected")
      : socketState === "connecting"
        ? t("channels.socket.connecting")
        : socketState === "error"
          ? t("channels.socket.error")
          : t("channels.socket.disconnected");

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[18rem] shrink-0 flex-col bg-gradient-to-b from-card/50 to-card/20 backdrop-blur-xl lg:border-e lg:border-border/60",
        className,
      )}
    >
      <div className="shrink-0 px-4 pb-3 pt-5">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/dashboard"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 transition-opacity hover:opacity-90"
            onClick={onSidebarAction}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center text-brand">
              <Radio className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0 font-display text-lg font-semibold leading-tight tracking-tight">
              <span className="text-gradient-brand">Beat</span>{" "}
              <span className="text-foreground">Room</span>
            </span>
          </Link>
          {user ? (
            <NotificationCenter
              triggerClassName="h-11 w-11 shrink-0 rounded-xl hover:bg-muted/40"
              iconClassName="h-5 w-5"
            />
          ) : null}
        </div>

        <div className="mt-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{t("room.admin.liveRoom")}</p>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className="min-w-0 flex-1 truncate font-medium text-foreground">{channelName}</p>
            <div className="flex shrink-0 items-center gap-0.5">
              {onShare ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-brand hover:bg-brand/10 hover:text-brand"
                  onClick={onShare}
                  aria-label={t("room.admin.shareRoom")}
                  title={t("room.admin.shareRoom")}
                >
                  <Share2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              ) : null}
              {onCloseChannel ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={onCloseChannel}
                  aria-label={t("room.admin.closeChannel")}
                  title={t("room.admin.closeChannel")}
                >
                  <DoorClosed className="h-3.5 w-3.5" aria-hidden />
                </Button>
              ) : null}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {!channelIsActive ? (
              <Badge variant="outline" className="text-[10px]">
                {t("channels.closed")}
              </Badge>
            ) : isLive ? (
              <Badge variant="success" className="text-[10px]">
                {t("channels.live")}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                {t("channels.offline")}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
              {socketLabel}
            </Badge>
            {onlineCount != null ? (
              <Badge variant="outline" className="text-[10px] font-normal">
                {t("channels.listeners", { count: onlineCount })}
              </Badge>
            ) : null}
          </div>
        </div>

        {showLeave && onLeave ? (
          <div className="mt-3">
            <Button type="button" variant="secondary" size="sm" className="h-9 w-full gap-2 text-xs" onClick={onLeave}>
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              {t("room.listener.leaveRoom")}
            </Button>
          </div>
        ) : null}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/80">
        <SectionDivider />
        <ListenerSidebarReactions onReact={onSendReaction} className="pb-1" />

        <SectionDivider />
        <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/90">
          {t("room.admin.section.navigation")}
        </p>
        <ul className="space-y-1">
          {ADMIN_LINK_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onSidebarAction}
                  className="relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-muted/40 hover:text-foreground"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/30 text-muted-foreground">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="truncate">{t(item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {sections.map((section, sectionIndex) => {
          const isOpen = expanded[section.id];
          const sectionHasActive = section.items.some((item) => item.id === activeTab);

          return (
            <div key={section.id} className={sectionIndex > 0 ? "mt-1" : "mt-1"}>
              {sectionIndex > 0 ? <SectionDivider /> : null}
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors",
                  sectionHasActive ? "text-brand" : "text-muted-foreground/90 hover:text-foreground",
                )}
                aria-expanded={isOpen}
              >
                <ChevronRight
                  className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", isOpen && "rotate-90")}
                  aria-hidden
                />
                <span className="truncate">{t(section.titleKey)}</span>
              </button>

              {isOpen ? (
                <ul className="mt-1 ms-2 space-y-0.5 border-s border-border/50 ps-2">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    const unread =
                      item.id === "chat"
                        ? chatUnread
                        : item.id === "suggestions"
                          ? pendingSuggestionsCount
                          : 0;

                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectTab(item.id)}
                          className={cn(
                            "relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                            isActive
                              ? "bg-brand/12 text-brand shadow-sm shadow-brand/5"
                              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                          )}
                          aria-current={isActive ? "page" : undefined}
                        >
                          {isActive ? (
                            <span className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-brand" aria-hidden />
                          ) : null}
                          <span
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                              isActive ? "bg-brand/15 text-brand" : "bg-muted/30 text-muted-foreground",
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" aria-hidden />
                          </span>
                          <span className="truncate">{t(item.labelKey)}</span>
                          {unread > 0 ? (
                            <span
                              className={cn(
                                "ms-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-primary-foreground",
                                item.id === "suggestions" ? "bg-amber-500" : "bg-brand",
                              )}
                              data-testid={item.id === "suggestions" ? "channel-nav-suggestions-badge" : undefined}
                              title={
                                item.id === "suggestions"
                                  ? t("room.admin.suggestions.pendingBadge", { count: unread })
                                  : undefined
                              }
                            >
                              {unread > 9 ? "9+" : unread}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-border/60 bg-gradient-to-t from-card/30 to-transparent px-4 py-3">
        {onViewAsListener ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mb-3 h-9 w-full gap-2 border-border/60 text-xs"
            onClick={() => {
              onViewAsListener();
              onSidebarAction?.();
            }}
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            {t("room.admin.viewAsListener")}
          </Button>
        ) : null}
        <DashboardAccountSection user={user} onAction={onSidebarAction} preferencesInMenu />
      </div>
    </aside>
  );
}
