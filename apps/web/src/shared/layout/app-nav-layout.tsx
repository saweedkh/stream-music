"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { useTranslations } from "@/shared/providers/locale-provider";
import {
  DashboardMobileHeader,
  DashboardSidebar,
  JoinChannelDialog,
  type DashboardTab,
} from "@/features/dashboard";
import { getMe, type AuthUser } from "@/lib/api";
import { registerWebPushOnDevice } from "@/lib/webpush-client";
import { listenUserSessionRefresh } from "@/lib/user-session-events";
import { shellBody, shellContent, shellFrame, shellMain, navSidebarSheetWidth, navSidebarWidth } from "@/lib/mobile-page-layout";
import { cn } from "@/lib/utils";

type AppNavLayoutProps = {
  activeTab: DashboardTab;
  onSelectMainTab: (tab: DashboardTab) => void;
  children: ReactNode;
};

export function AppNavLayout({ activeTab, onSelectMainTab, children }: AppNavLayoutProps) {
  const pathname = usePathname();
  const { t, dir } = useTranslations();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const contentKey = pathname?.startsWith("/explore") ? "explore" : activeTab;

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

  useEffect(() => {
    return listenUserSessionRefresh(() => {
      void getMe()
        .then((res) => setUser(res?.user ?? null))
        .catch(() => setUser(null));
    });
  }, []);

  function openJoinDialog() {
    setJoinDialogOpen(true);
    setMobileNavOpen(false);
  }

  const sidebarProps = {
    activePathname: pathname,
    activeTab,
    onSelectMainTab: (tab: DashboardTab) => {
      onSelectMainTab(tab);
      setMobileNavOpen(false);
    },
    onJoinChannelClick: openJoinDialog,
    onSidebarAction: () => setMobileNavOpen(false),
    user,
  };

  return (
    <div className={shellFrame}>
      <div className={cn("hidden h-full min-h-0 shrink-0 lg:flex", navSidebarWidth)}>
        <DashboardSidebar {...sidebarProps} className="h-full w-full rounded-s-2xl" />
      </div>

      <div className={shellMain}>
        <DashboardMobileHeader onMenuClick={() => setMobileNavOpen(true)} user={user} />

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side={dir === "rtl" ? "right" : "left"} className={cn(navSidebarSheetWidth, "gap-0 p-0")}>
            <SheetTitle className="sr-only">{t("dashboard.navTitle")}</SheetTitle>
            <DashboardSidebar {...sidebarProps} className="h-full w-full border-0 bg-transparent" />
          </SheetContent>
        </Sheet>

        <div className={shellBody}>
          <div className={cn(shellContent, "gap-3 max-lg:px-0 max-lg:py-1 lg:gap-0 lg:px-0.5 lg:py-1")}>
            <AnimatePresence mode="wait">
              <motion.div
                key={contentKey}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="flex w-full flex-col max-lg:flex-none max-lg:overflow-visible lg:h-full lg:min-h-0 lg:flex-1 lg:overflow-hidden"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <JoinChannelDialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen} hideTrigger />
    </div>
  );
}
