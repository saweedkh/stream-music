"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useTranslations } from "@/components/providers/locale-provider";
import { DashboardMobileHeader } from "@/features/dashboard/dashboard-mobile-header";
import { DashboardPageHeader } from "@/features/dashboard/dashboard-page-header";
import { DashboardSidebar } from "@/features/dashboard/dashboard-sidebar";
import type { DashboardTab } from "@/features/dashboard/dashboard-types";
import { JoinChannelDialog } from "@/features/dashboard/join-channel-dialog";
import { getMe, type AuthUser } from "@/lib/api";
import { registerWebPushOnDevice } from "@/lib/webpush-client";

type AppNavLayoutProps = {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  children: ReactNode;
  showPageHeader?: boolean;
};

export function AppNavLayout({
  activeTab,
  onSelectTab,
  children,
  showPageHeader = false,
}: AppNavLayoutProps) {
  const { t } = useTranslations();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
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

  function handleSelectTab(tab: DashboardTab) {
    onSelectTab(tab);
    setMobileNavOpen(false);
  }

  function openJoinDialog() {
    setJoinDialogOpen(true);
    setMobileNavOpen(false);
  }

  const sidebarProps = {
    activeTab,
    onSelectTab: handleSelectTab,
    onJoinChannelClick: openJoinDialog,
    onSidebarAction: () => setMobileNavOpen(false),
    user,
  };

  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-2xl border border-border/50 bg-card/40 lg:min-h-[calc(100dvh-3rem)] lg:flex-row">
      <div className="hidden lg:flex lg:min-h-0 lg:shrink-0">
        <DashboardSidebar {...sidebarProps} className="rounded-s-2xl" />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <DashboardMobileHeader onMenuClick={() => setMobileNavOpen(true)} user={user} />

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-[min(100vw-1.5rem,19rem)] gap-0 p-0">
            <SheetTitle className="sr-only">{t("dashboard.navTitle")}</SheetTitle>
            <DashboardSidebar {...sidebarProps} className="h-full w-full border-0 bg-transparent" />
          </SheetContent>
        </Sheet>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
            {showPageHeader ? <DashboardPageHeader activeTab={activeTab} /> : null}
            {children}
          </div>
        </div>
      </div>

      <JoinChannelDialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen} hideTrigger />
    </div>
  );
}
