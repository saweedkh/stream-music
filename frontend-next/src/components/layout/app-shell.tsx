"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ChannelCommandMenu } from "@/components/room/channel-command-menu";
import { GlobalSearchDialog } from "@/features/discovery/global-search-dialog";
import { GlobalChannelPlayerProvider } from "@/features/player/global-channel-player-context";
import { getMe, type AuthUser } from "@/lib/api";
import { ConnectivityBanner } from "@/components/connectivity-banner";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { registerWebPushOnDevice } from "@/lib/webpush-client";
import { AppGlobalNavShell } from "@/components/layout/app-global-nav-shell";
import { PwaInstallBanner } from "@/components/pwa/pwa-install-banner";
import { fadeUp } from "@/lib/motion";
import {
  desktopMain,
  desktopPageRoot,
  mobileMain,
  mobilePageRoot,
  mobilePageRootChannel,
  playerDockPad,
} from "@/lib/mobile-page-layout";
import { cn } from "@/lib/utils";

const GlobalChannelPlayerDock = dynamic(
  () => import("@/features/player/global-channel-player-dock").then((m) => ({ default: m.GlobalChannelPlayerDock })),
  { ssr: false },
);

function isAuthPath(pathname: string | null) {
  return pathname === "/login" || pathname === "/register";
}

function isSelfShelledPath(pathname: string | null) {
  return Boolean(pathname?.startsWith("/dashboard") || pathname?.startsWith("/channel/"));
}

function isDashboardPath(pathname: string | null) {
  return Boolean(pathname?.startsWith("/dashboard"));
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const inChannel = Boolean(pathname?.startsWith("/channel/"));
  const isDashboard = isDashboardPath(pathname);
  const isAuthPage = isAuthPath(pathname);
  const isSelfShelled = isSelfShelledPath(pathname);
  const useGlobalNav = Boolean(me && !isAuthPage && !isSelfShelled);

  const channelId = useMemo(() => {
    const m = pathname?.match(/^\/channel\/([^/]+)/);
    return m?.[1] ?? undefined;
  }, [pathname]);

  useEffect(() => {
    getMe()
      .then((res) => {
        setMe(res?.user ?? null);
        if (res?.user && typeof window !== "undefined" && Notification.permission === "granted") {
          void registerWebPushOnDevice({ requestPermission: false });
        }
      })
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (!me || isAuthPage) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setGlobalSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [me, isAuthPage]);

  return (
    <ToastProvider>
      <NotificationProvider>
        <GlobalChannelPlayerProvider>
          <ChannelCommandMenu channelId={channelId} canManage={Boolean(channelId)} />
          {me && !isAuthPage ? (
            <GlobalSearchDialog open={globalSearchOpen} onOpenChange={setGlobalSearchOpen} />
          ) : null}
          <motion.div
            className={cn(
              "relative mx-auto w-full",
              isSelfShelled && (inChannel ? mobilePageRootChannel : mobilePageRoot),
              isSelfShelled && desktopPageRoot,
              inChannel && isSelfShelled && "px-2 py-2 sm:px-4 sm:py-4",
              isDashboard && isSelfShelled && "px-2 py-2 sm:px-3 sm:py-3",
              (isSelfShelled || useGlobalNav) && !inChannel && cn("max-w-[1500px] px-3 py-3 sm:px-4 sm:py-4", playerDockPad),
              isAuthPage && "max-w-lg px-4 py-6",
              !isAuthPage && !isSelfShelled && !useGlobalNav && cn("min-h-screen max-w-6xl px-4 py-5 sm:px-6 sm:py-6", playerDockPad),
              (isSelfShelled || useGlobalNav) && "max-w-[1500px]",
            )}
            {...fadeUp}
          >
            <ConnectivityBanner />
            {useGlobalNav ? (
              <AppGlobalNavShell>{children}</AppGlobalNavShell>
            ) : (
              <main className={cn(isSelfShelled && mobileMain, isSelfShelled && desktopMain)}>
                {children}
              </main>
            )}
          </motion.div>
          <GlobalChannelPlayerDock />
          {me && !isAuthPage ? <PwaInstallBanner /> : null}
        </GlobalChannelPlayerProvider>
      </NotificationProvider>
    </ToastProvider>
  );
}
