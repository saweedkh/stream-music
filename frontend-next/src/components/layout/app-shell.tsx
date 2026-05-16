"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
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
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ChannelCommandMenu } from "@/components/room/channel-command-menu";
import { GlobalChannelPlayerProvider } from "@/features/player/global-channel-player-context";
import { getMe, logoutUser, type AuthUser } from "@/lib/api";
import { ConnectivityBanner } from "@/components/connectivity-banner";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { registerWebPushOnDevice } from "@/lib/webpush-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { fadeUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

const GlobalChannelPlayerDock = dynamic(
  () => import("@/features/player/global-channel-player-dock").then((m) => ({ default: m.GlobalChannelPlayerDock })),
  { ssr: false },
);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<AuthUser | null>(null);
  const inChannel = Boolean(pathname?.startsWith("/channel/"));

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
          <motion.div
            className={cn(
              "relative mx-auto min-h-screen w-full px-4 py-5 sm:px-6 sm:py-6",
              inChannel ? "max-w-[1400px] pb-36" : "max-w-6xl pb-24",
            )}
            {...fadeUp}
          >
            <header className="glass-panel-elevated mb-6 flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <Link
                href={me ? "/dashboard" : "/login"}
                className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-90"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/30 bg-brand/10 text-brand shadow-sm shadow-brand/10">
                  <Radio className="h-4 w-4" aria-hidden />
                </span>
                <span className="font-display truncate text-lg font-semibold tracking-tight">
                  <span className="text-gradient-brand">Stream</span>{" "}
                  <span className="text-foreground">Music</span>
                </span>
              </Link>
              <nav className="flex shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-2">
                <ThemeToggle />
                <Link
                  href="/dashboard"
                  className="hidden rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-muted/30 hover:text-foreground sm:inline"
                >
                  Dashboard
                </Link>
                {me ? <NotificationCenter /> : null}
                {me ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="gap-2 px-2">
                        <Avatar className="h-8 w-8 border border-border">
                          <AvatarFallback className="bg-muted text-xs font-medium">
                            {(me.username || "?").slice(0, 1).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="hidden max-w-[8rem] truncate text-sm sm:inline">@{me.username}</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuLabel>Account</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard" className="flex cursor-pointer items-center gap-2">
                          <LayoutDashboard className="h-4 w-4" />
                          Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void handleLogout()}>
                        <LogOut className="h-4 w-4" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Link href="/login">
                    <Button variant="secondary" size="sm">
                      Login
                    </Button>
                  </Link>
                )}
              </nav>
            </header>
            <ConnectivityBanner />
            <main>{children}</main>
          </motion.div>
          <GlobalChannelPlayerDock />
        </GlobalChannelPlayerProvider>
      </NotificationProvider>
    </ToastProvider>
  );
}
