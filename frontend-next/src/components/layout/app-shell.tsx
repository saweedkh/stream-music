"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast-provider";
import { GlobalChannelPlayerProvider } from "@/features/player/global-channel-player-context";
import { getMe, logoutUser, type AuthUser } from "@/lib/api";
import { ConnectivityBanner } from "@/components/connectivity-banner";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { registerWebPushOnDevice } from "@/lib/webpush-client";

const GlobalChannelPlayerDock = dynamic(
  () => import("@/features/player/global-channel-player-dock").then((m) => ({ default: m.GlobalChannelPlayerDock })),
  { ssr: false },
);

export function AppShell({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AuthUser | null>(null);

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

  async function handleLogout() {
    try {
      await logoutUser();
    } finally {
      setMe(null);
      window.location.href = "/login";
    }
  }

  return (
    <ToastProvider>
      <NotificationProvider>
      <GlobalChannelPlayerProvider>
        <div className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 pb-36 sm:px-6">
          <header className="mb-6 flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/55 px-5 py-3 backdrop-blur">
            <Link href={me ? "/dashboard" : "/login"} className="text-lg font-semibold tracking-tight text-slate-100">
              Stream Music
            </Link>
            <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm text-slate-300">
              <Link href="/dashboard" className="hover:text-white">
                Dashboard
              </Link>
              {me ? <NotificationCenter /> : null}
              {me ? (
                <>
                  <span className="text-xs text-slate-400">@{me.username}</span>
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={handleLogout}>
                    Logout
                  </Button>
                </>
              ) : (
                <Link href="/login" className="hover:text-white">
                  Login
                </Link>
              )}
            </nav>
          </header>
          <ConnectivityBanner />
          {children}
        </div>
        <GlobalChannelPlayerDock />
      </GlobalChannelPlayerProvider>
      </NotificationProvider>
    </ToastProvider>
  );
}
