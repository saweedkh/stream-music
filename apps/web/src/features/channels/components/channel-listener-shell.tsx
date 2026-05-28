"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Eye } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { useTranslations } from "@/shared/providers/locale-provider";
import { ChannelMobileHeader } from "@/features/channels/components/channel-mobile-header";
import { ChannelListenerSidebar } from "@/features/channels/components/channel-listener-sidebar";
import { ChannelRoomMobileTabs } from "@/features/channels/components/channel-room-mobile-tabs";
import { RoomReactionOverlay } from "@/features/channels/components/room-reaction-overlay";
import { RoomReactionProvider } from "@/features/channels/components/room-reaction-context";
import type { ListenerTabId } from "@/features/channels/components/channel-room-config";
import { Button } from "@/shared/ui/button";
import { getMe, type AuthUser } from "@/lib/api";
import { registerWebPushOnDevice } from "@/lib/webpush-client";
import { shellBody, shellContent, shellFrame, shellMain } from "@/lib/mobile-page-layout";
import { cn } from "@/lib/utils";

type Props = {
  channelId: string;
  channelName: string;
  brandLogoUrl?: string | null;
  isLive?: boolean;
  activeTab: ListenerTabId;
  onSelectTab: (tab: ListenerTabId) => void;
  onChatTabOpen?: () => void;
  onSendReaction: (emoji: string) => void;
  children: ReactNode;
  chatUnread: number;
  onShare?: () => void;
  viewAsListener?: boolean;
  onBackToAdmin?: () => void;
};

export function ChannelListenerShell({
  channelId,
  channelName,
  brandLogoUrl,
  isLive,
  activeTab,
  onSelectTab,
  onChatTabOpen,
  onSendReaction,
  children,
  chatUnread,
  onShare,
  viewAsListener,
  onBackToAdmin,
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

  function handleSelectTab(tab: ListenerTabId) {
    onSelectTab(tab);
    if (tab === "chat") onChatTabOpen?.();
    setMobileNavOpen(false);
  }

  const sidebarProps = {
    channelId,
    activeTab,
    onSelectTab: handleSelectTab,
    onSendReaction,
    onSidebarAction: () => setMobileNavOpen(false),
    user,
    chatUnread,
    onShare,
  };

  return (
    <RoomReactionProvider channelId={channelId}>
      <div className={shellFrame}>
        <RoomReactionOverlay />
        <div className="hidden lg:flex lg:min-h-0 lg:shrink-0">
          <ChannelListenerSidebar {...sidebarProps} className="rounded-s-2xl" />
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
              <SheetTitle className="sr-only">{t("room.listener.navTitle")}</SheetTitle>
              <ChannelListenerSidebar {...sidebarProps} className="h-full w-full border-0 bg-transparent" />
            </SheetContent>
          </Sheet>

          <div className={shellBody}>
            <div className={cn(shellContent, "gap-3 max-lg:px-0 max-lg:py-0")}>
              {viewAsListener ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/25 bg-brand/10 px-3 py-2.5">
                  {onBackToAdmin ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 border-brand/30 bg-background/80 text-xs text-brand hover:bg-brand/15"
                      onClick={onBackToAdmin}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      {t("channels.backToAdminView")}
                    </Button>
                  ) : null}
                  <p className="min-w-0 flex-1 text-sm text-foreground">{t("channels.listenerViewBanner")}</p>
                </div>
              ) : null}
              <div className="flex flex-1 flex-col max-lg:min-h-0 lg:min-h-0 lg:flex-1 lg:overflow-hidden">{children}</div>
              <ChannelRoomMobileTabs
                mode="listener"
                activeTab={activeTab}
                onSelectTab={handleSelectTab}
                chatUnread={chatUnread}
              />
            </div>
          </div>
        </div>
      </div>
    </RoomReactionProvider>
  );
}
