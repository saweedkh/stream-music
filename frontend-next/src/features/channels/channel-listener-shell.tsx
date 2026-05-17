"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Eye } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useTranslations } from "@/components/providers/locale-provider";
import { DashboardMobileHeader } from "@/features/dashboard/dashboard-mobile-header";
import { ChannelListenerSidebar } from "@/features/channels/channel-listener-sidebar";
import { RoomReactionOverlay } from "@/features/channels/room-reaction-overlay";
import { RoomReactionProvider } from "@/features/channels/room-reaction-context";
import type { ListenerTabId } from "@/features/channels/channel-room-config";
import { Button } from "@/components/ui/button";
import { getMe, type AuthUser } from "@/lib/api";
import { registerWebPushOnDevice } from "@/lib/webpush-client";
import { cn } from "@/lib/utils";

type Props = {
  channelId: string;
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
      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/40 lg:flex-row",
          "min-h-[min(100%,28rem)]",
        )}
      >
        <RoomReactionOverlay />
        <div className="hidden lg:flex lg:min-h-0 lg:shrink-0">
          <ChannelListenerSidebar {...sidebarProps} className="rounded-s-2xl" />
        </div>

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <DashboardMobileHeader onMenuClick={() => setMobileNavOpen(true)} user={user} />

          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent side="left" className="w-[min(100vw-1.5rem,19rem)] gap-0 p-0">
              <SheetTitle className="sr-only">{t("room.listener.navTitle")}</SheetTitle>
              <ChannelListenerSidebar {...sidebarProps} className="h-full w-full border-0 bg-transparent" />
            </SheetContent>
          </Sheet>

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="relative mx-auto flex h-full max-h-full min-h-0 w-full flex-1 flex-col px-2 py-2 sm:px-3 sm:py-3">
              {viewAsListener ? (
                <div className="mb-2 flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
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
              <div className="flex h-full min-h-0 max-h-full flex-1 flex-col">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </RoomReactionProvider>
  );
}
