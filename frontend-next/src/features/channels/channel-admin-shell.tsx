"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useTranslations } from "@/components/providers/locale-provider";
import { DashboardMobileHeader } from "@/features/dashboard/dashboard-mobile-header";
import { ChannelAdminSidebar } from "@/features/channels/channel-admin-sidebar";
import { RoomReactionOverlay } from "@/features/channels/room-reaction-overlay";
import type { ChannelTabId } from "@/features/channels/channel-room-config";
import { getMe, type AuthUser } from "@/lib/api";
import { registerWebPushOnDevice } from "@/lib/webpush-client";
import { cn } from "@/lib/utils";

type Props = {
  channelName: string;
  isLive: boolean;
  socketState: string;
  channelIsActive: boolean;
  onlineCount?: number | null;
  activeTab: ChannelTabId;
  onSelectTab: (tab: ChannelTabId) => void;
  onChatTabOpen?: () => void;
  onSendReaction: (emoji: string) => void;
  onShare?: () => void;
  onViewAsListener?: () => void;
  onLeave?: () => void;
  onCloseChannel?: () => void;
  showLeave?: boolean;
  chatUnread: number;
  canManage: boolean;
  statusBanner?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function ChannelAdminShell({
  channelName,
  isLive,
  socketState,
  channelIsActive,
  onlineCount,
  activeTab,
  onSelectTab,
  onChatTabOpen,
  onSendReaction,
  onShare,
  onViewAsListener,
  onLeave,
  onCloseChannel,
  showLeave,
  chatUnread,
  canManage,
  statusBanner,
  children,
  className,
}: Props) {
  const { t } = useTranslations();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    getMe()
      .then((res) => {
        setUser(res?.user ?? null);
        if (res?.user && typeof window !== "undefined" && Notification.permission === "granted") {
          void registerWebPushOnDevice({ requestPermission: false });
        }
      })
      .catch(() => setUser(null));
  }, []);

  function handleSelectTab(tab: ChannelTabId) {
    onSelectTab(tab);
    if (tab === "chat") onChatTabOpen?.();
    setMobileNavOpen(false);
  }

  const sidebarProps = {
    channelName,
    isLive,
    socketState,
    channelIsActive,
    onlineCount,
    activeTab,
    onSelectTab: handleSelectTab,
    onSidebarAction: () => setMobileNavOpen(false),
    onSendReaction,
    onShare,
    onViewAsListener,
    onLeave,
    onCloseChannel,
    showLeave,
    chatUnread,
    canManage,
    user,
  };

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/40 lg:flex-row",
        className,
      )}
    >
      <RoomReactionOverlay />

      <div className="hidden h-full min-h-0 lg:flex lg:shrink-0">
        <ChannelAdminSidebar {...sidebarProps} className="h-full rounded-s-2xl" />
      </div>

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardMobileHeader onMenuClick={() => setMobileNavOpen(true)} user={user} />

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-[min(100vw-1.5rem,19rem)] gap-0 p-0">
            <SheetTitle className="sr-only">{t("room.admin.navTitle")}</SheetTitle>
            <ChannelAdminSidebar {...sidebarProps} className="h-full w-full border-0 bg-transparent" />
          </SheetContent>
        </Sheet>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative mx-auto flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden px-2 py-2 sm:px-3 sm:py-3">
            {statusBanner ? <div className="shrink-0">{statusBanner}</div> : null}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
