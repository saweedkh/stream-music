"use client";

import type { ComponentType } from "react";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "@/shared/providers/locale-provider";
import {
  ADMIN_NAV_ITEMS,
  LISTENER_NAV_ITEMS,
  type ChannelTabId,
  type ListenerTabId,
} from "@/features/channels/components/channel-room-config";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { cn } from "@/lib/utils";

const ADMIN_PRIMARY: ChannelTabId[] = ["chat", "player", "queue", "suggestions"];
const ADMIN_MORE: ChannelTabId[] = ["insights", "listeners", "admin", "health"];

type ListenerProps = {
  mode: "listener";
  activeTab: ListenerTabId;
  onSelectTab: (tab: ListenerTabId) => void;
  chatUnread?: number;
};

type AdminProps = {
  mode: "admin";
  activeTab: ChannelTabId;
  onSelectTab: (tab: ChannelTabId) => void;
  canManage: boolean;
  chatUnread?: number;
  pendingSuggestionsCount?: number;
};

export function ChannelRoomMobileTabs(props: ListenerProps | AdminProps) {
  const { t } = useTranslations();
  const [moreOpen, setMoreOpen] = useState(false);
  const chatUnread = props.chatUnread ?? 0;
  const pendingSuggestions =
    props.mode === "admin" ? (props.pendingSuggestionsCount ?? 0) : 0;

  if (props.mode === "listener") {
    return (
      <nav
        className="sticky bottom-[var(--player-mini-inset,0px)] z-30 -mx-1 border-t border-border/60 bg-background/95 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl lg:hidden"
        aria-label={t("room.listener.navTitle")}
      >
        <div className="grid grid-cols-4 gap-0.5">
          {LISTENER_NAV_ITEMS.map((item) => (
            <TabButton
              key={item.id}
              active={props.activeTab === item.id}
              label={t(item.labelKey)}
              icon={item.icon}
              badge={item.id === "chat" && chatUnread > 0 ? chatUnread : undefined}
              onClick={() => props.onSelectTab(item.id)}
            />
          ))}
        </div>
      </nav>
    );
  }

  const moreItems = ADMIN_MORE.filter((id) => {
    const item = ADMIN_NAV_ITEMS.find((n) => n.id === id);
    return item && (!item.manageOnly || props.canManage);
  });
  const inMore = moreItems.includes(props.activeTab);

  return (
    <>
      <nav
        className="sticky bottom-[var(--player-mini-inset,0px)] z-30 -mx-1 border-t border-border/60 bg-background/95 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl lg:hidden"
        aria-label={t("room.admin.navTitle")}
      >
        <div className="grid grid-cols-5 gap-0.5">
          {ADMIN_PRIMARY.map((id) => {
            const item = ADMIN_NAV_ITEMS.find((n) => n.id === id)!;
            return (
              <TabButton
                key={id}
                active={props.activeTab === id}
                label={t(item.labelKey)}
                icon={item.icon}
                badge={
                  id === "chat" && chatUnread > 0
                    ? chatUnread
                    : id === "suggestions" && pendingSuggestions > 0
                      ? pendingSuggestions
                      : undefined
                }
                badgePending={id === "suggestions"}
                onClick={() => props.onSelectTab(id)}
              />
            );
          })}
          <TabButton
            active={inMore}
            label={t("room.admin.nav.more")}
            icon={MoreHorizontal}
            onClick={() => setMoreOpen(true)}
          />
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[70dvh] rounded-t-2xl p-0">
          <SheetTitle className="sr-only">{t("room.admin.nav.more")}</SheetTitle>
          <div className="border-b border-border/50 px-4 py-3">
            <p className="text-sm font-semibold">{t("room.admin.nav.more")}</p>
          </div>
          <ul className="overflow-y-auto p-2">
            {moreItems.map((id) => {
              const item = ADMIN_NAV_ITEMS.find((n) => n.id === id)!;
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm transition-colors",
                      props.activeTab === id ? "bg-brand/15 text-brand" : "hover:bg-muted/50",
                    )}
                    onClick={() => {
                      props.onSelectTab(id);
                      setMoreOpen(false);
                    }}
                  >
                    <item.icon className="h-5 w-5 shrink-0" aria-hidden />
                    {t(item.labelKey)}
                  </button>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}

function TabButton({
  active,
  label,
  icon: Icon,
  badge,
  badgePending,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
  badgePending?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-medium leading-tight transition-colors",
        active ? "bg-brand/15 text-brand" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="max-w-full truncate">{label}</span>
      {badge != null && badge > 0 ? (
        <span
          className={cn(
            "absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-primary-foreground",
            badgePending ? "bg-amber-500" : "bg-brand",
          )}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
    </button>
  );
}
