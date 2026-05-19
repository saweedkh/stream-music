"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ChannelCommandMenu } from "@/components/room/channel-command-menu";
import { GlobalChannelPlayerProvider } from "@/features/player/global-channel-player-context";
import { getMe, type AuthUser } from "@/lib/api";
import { ConnectivityBanner } from "@/components/connectivity-banner";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { registerWebPushOnDevice } from "@/lib/webpush-client";
import { AppGlobalNavShell } from "@/components/layout/app-global-nav-shell";
import { fadeUp } from "@/lib/motion";
import {
  desktopMain,
  desktopPageRoot,
  mobileMain,
  mobilePageRoot,
  mobilePageRootChannel,
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

  return (
    <ToastProvider>
      <NotificationProvider>
        <GlobalChannelPlayerProvider>
          <ChannelCommandMenu channelId={channelId} canManage={Boolean(channelId)} />
          <motion.div
            className={cn(
              "relative mx-auto w-full",
              isSelfShelled && (inChannel ? mobilePageRootChannel : mobilePageRoot),
              isSelfShelled && desktopPageRoot,
              inChannel && isSelfShelled && "px-2 py-2 sm:px-4 sm:py-4",
              isDashboard && isSelfShelled && "px-2 py-2 sm:px-3 sm:py-3",
              (isSelfShelled || useGlobalNav) && !inChannel && "max-w-[1500px] px-3 py-3 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:px-4 sm:py-4",
              isAuthPage && "max-w-lg px-4 py-6",
              !isAuthPage && !isSelfShelled && !useGlobalNav && "min-h-screen max-w-6xl px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-6",
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
        </GlobalChannelPlayerProvider>
      </NotificationProvider>
    </ToastProvider>
  );
}
