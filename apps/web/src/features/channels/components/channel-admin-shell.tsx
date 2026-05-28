"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { useTranslations } from "@/shared/providers/locale-provider";
import { ChannelMobileHeader } from "@/features/channels/components/channel-mobile-header";
import { ChannelAdminSidebar } from "@/features/channels/components/channel-admin-sidebar";
import { ChannelRoomMobileTabs } from "@/features/channels/components/channel-room-mobile-tabs";
import { RoomReactionOverlay } from "@/features/channels/components/room-reaction-overlay";
import type { ChannelTabId } from "@/features/channels/components/channel-room-config";
import { getMe, type AuthUser } from "@/lib/api";
import { registerWebPushOnDevice } from "@/lib/webpush-client";
import { shellBody, shellContent, shellFrame, shellMain } from "@/lib/mobile-page-layout";
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
  pendingSuggestionsCount?: number;
  canManage: boolean;
  statusBanner?: ReactNode;
  children: ReactNode;
  className?: string;
  brandLogoUrl?: string | null;
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
  pendingSuggestionsCount = 0,
  canManage,
  statusBanner,
  children,
  className,
  brandLogoUrl,
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
    pendingSuggestionsCount,
    canManage,
    user,
  };

  return (
    <div className={cn(shellFrame, className)}>
      <RoomReactionOverlay />

      <div className="hidden h-full min-h-0 lg:flex lg:shrink-0">
        <ChannelAdminSidebar {...sidebarProps} className="h-full rounded-s-2xl" />
      </div>

      <div className={shellMain}>
        <ChannelMobileHeader
          onMenuClick={() => setMobileNavOpen(true)}
          user={user}
          channelName={channelName}
          brandLogoUrl={brandLogoUrl}
          isLive={isLive}
        />

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-[min(100vw-1.5rem,19rem)] gap-0 p-0">
            <SheetTitle className="sr-only">{t("room.admin.navTitle")}</SheetTitle>
            <ChannelAdminSidebar {...sidebarProps} className="h-full w-full border-0 bg-transparent" />
          </SheetContent>
        </Sheet>

        <div className={shellBody}>
          <div className={cn(shellContent, "gap-2 max-lg:px-0 max-lg:py-0 sm:gap-3")}>
            {statusBanner ? <div className="shrink-0">{statusBanner}</div> : null}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-1 flex-col max-lg:min-h-0 lg:min-h-0 lg:flex-1 lg:overflow-hidden"
              >
                {children}
              </motion.div>
            </AnimatePresence>
            <ChannelRoomMobileTabs
              mode="admin"
              activeTab={activeTab}
              onSelectTab={handleSelectTab}
              canManage={canManage}
              chatUnread={chatUnread}
              pendingSuggestionsCount={pendingSuggestionsCount}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
