"use client";

import Link from "next/link";
import { Radio, Share2 } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { DashboardAccountSection } from "@/features/dashboard/components/dashboard-account-section";
import { LISTENER_LINK_ITEMS, LISTENER_NAV_SECTIONS } from "@/features/channels/components/channel-room-config";
import type { ListenerTabId } from "@/features/channels/components/channel-room-config";
import { ListenerSidebarReactions } from "@/features/channels/components/listener-sidebar-reactions";
import { NotificationCenter } from "@/shared/notifications/notification-center";
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
  channelId: string;
  activeTab: ListenerTabId;
  onSelectTab: (tab: ListenerTabId) => void;
  onSendReaction: (emoji: string) => void;
  onSidebarAction?: () => void;
  className?: string;
  user: AuthUser | null;
  chatUnread: number;
  onShare?: () => void;
};

export function ChannelListenerSidebar({
  channelId,
  activeTab,
  onSelectTab,
  onSendReaction,
  onSidebarAction,
  className,
  user,
  chatUnread,
  onShare,
}: Props) {
  const { t } = useTranslations();

  function handleSelectTab(tab: ListenerTabId) {
    onSelectTab(tab);
    onSidebarAction?.();
  }

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
        {onShare ? (
          <Button
            type="button"
            className="mt-3 h-10 w-full gap-2 bg-brand text-brand-foreground shadow-md shadow-brand/15 hover:bg-brand-strong"
            onClick={onShare}
          >
            <Share2 className="h-4 w-4" aria-hidden />
            {t("room.listener.shareRoom")}
          </Button>
        ) : null}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/80">
        <SectionDivider />
        <ListenerSidebarReactions onReact={onSendReaction} className="pb-1" />

        <SectionDivider />
        <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/90">
          {t("room.listener.section.navigation")}
        </p>
        <ul className="space-y-1">
          {LISTENER_LINK_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onSidebarAction}
                  className="relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-muted/40 hover:text-foreground"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/30 text-muted-foreground transition-colors">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="truncate">{t(item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {LISTENER_NAV_SECTIONS.map((section, sectionIndex) => (
          <div key={section.titleKey} className={sectionIndex > 0 ? "mt-1" : "mt-1"}>
            {sectionIndex > 0 ? <SectionDivider /> : null}
            <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/90">
              {t(section.titleKey)}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                const unread = item.id === "chat" ? chatUnread : 0;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectTab(item.id)}
                      className={cn(
                        "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                        isActive
                          ? "bg-brand/12 text-brand shadow-sm shadow-brand/5"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {isActive ? (
                        <span className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-brand" aria-hidden />
                      ) : null}
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                          isActive ? "bg-brand/15 text-brand" : "bg-muted/30 text-muted-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="truncate">{t(item.labelKey)}</span>
                      {unread > 0 ? (
                        <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-foreground">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border/60 bg-gradient-to-t from-card/30 to-transparent px-4 py-3">
        <DashboardAccountSection user={user} onAction={onSidebarAction} preferencesInMenu />
      </div>
    </aside>
  );
}
