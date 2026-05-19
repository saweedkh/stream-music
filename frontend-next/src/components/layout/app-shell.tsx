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
              inChannel && isSelfShelled
                ? "flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden px-3 py-3 pb-[calc(8.75rem+env(safe-area-inset-bottom,0px))] sm:px-4 sm:py-4 sm:pb-[calc(5.25rem+env(safe-area-inset-bottom,0px))]"
                : isDashboard && isSelfShelled
                  ? "flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden px-3 py-3 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:px-4 sm:py-4"
                  : "min-h-screen",
              (isSelfShelled || useGlobalNav) && !inChannel && "max-w-[1500px] px-3 py-3 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:px-4 sm:py-4",
              isAuthPage && "max-w-lg px-4 py-6",
              !isAuthPage && !isSelfShelled && !useGlobalNav && "max-w-6xl px-4 py-5 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-6",
              (isSelfShelled || useGlobalNav) && "max-w-[1500px]",
            )}
            {...fadeUp}
          >
            <ConnectivityBanner />
            {useGlobalNav ? (
              <AppGlobalNavShell>{children}</AppGlobalNavShell>
            ) : (
              <main
                className={cn((inChannel || isDashboard) && isSelfShelled && "flex min-h-0 flex-1 flex-col overflow-hidden")}
              >
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
