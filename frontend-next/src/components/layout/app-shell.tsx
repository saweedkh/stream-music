"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { ChevronDown, LayoutDashboard, LogOut, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ChannelCommandMenu } from "@/components/room/channel-command-menu";
import { GlobalChannelPlayerProvider } from "@/features/player/global-channel-player-context";
import { getMe, logoutUser, type AuthUser } from "@/lib/api";
import { ConnectivityBanner } from "@/components/connectivity-banner";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { registerWebPushOnDevice } from "@/lib/webpush-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const GlobalChannelPlayerDock = dynamic(
  () => import("@/features/player/global-channel-player-dock").then((m) => ({ default: m.GlobalChannelPlayerDock })),
  { ssr: false },
);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<AuthUser | null>(null);

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
          <ChannelCommandMenu channelId={channelId} canManage={Boolean(channelId)} />
          <div className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 pb-36 sm:px-6">
            <header className="mb-6 flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-card/55 px-5 py-3 backdrop-blur-md">
              <Link href={me ? "/dashboard" : "/login"} className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
                  <Radio className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-display text-lg font-semibold tracking-tight text-foreground">Stream Music</span>
              </Link>
              <nav className="flex flex-wrap items-center justify-end gap-x-2 gap-y-2 text-sm text-zinc-300">
                <Link href="/dashboard" className="hidden rounded-lg px-2.5 py-1.5 hover:bg-zinc-800/80 hover:text-white sm:inline">
                  Dashboard
                </Link>
                {me ? <NotificationCenter /> : null}
                {me ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="gap-2 px-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{(me.username || "?").slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <span className="hidden max-w-[8rem] truncate text-sm sm:inline">@{me.username}</span>
                        <ChevronDown className="h-4 w-4 text-zinc-500" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Account</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard" className="flex cursor-pointer items-center gap-2">
                          <LayoutDashboard className="h-4 w-4" />
                          Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-300 focus:text-red-200" onClick={() => void handleLogout()}>
                        <LogOut className="h-4 w-4" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Link href="/login" className="rounded-lg px-2.5 py-1.5 hover:bg-zinc-800/80 hover:text-white">
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
