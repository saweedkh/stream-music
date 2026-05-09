"use client";

import Link from "next/link";
import { Home, LogOut, Radio, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ChannelRoomLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 py-16">
      <div
        className="h-12 w-12 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400"
        aria-hidden
      />
      <p className="text-sm text-zinc-400">Loading your access…</p>
    </div>
  );
}

type ListenerProps = {
  channelId: string;
  channelName: string;
  channelPrivacy: string;
  description?: string;
  memberLimit?: number;
  joinRequiresApproval?: boolean;
  isLive: boolean;
  socketState: string;
  /** Short label for current track, or null if none */
  nowPlayingLabel: string | null;
  showLeave: boolean;
  onLeaveClick: () => void;
};

export function ChannelListenerView({
  channelId,
  channelName,
  channelPrivacy,
  description,
  memberLimit,
  joinRequiresApproval,
  isLive,
  socketState,
  nowPlayingLabel,
  showLeave,
  onLeaveClick,
}: ListenerProps) {
  const connected = socketState === "connected";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-32 pt-2 sm:px-6 sm:pt-4">
      <header
        className={cn(
          "relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-zinc-950 via-emerald-950/25 to-zinc-950",
          "p-6 shadow-[0_24px_60px_-20px_rgba(16,185,129,0.35)] sm:p-8 lg:p-10",
        )}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-teal-500/10 blur-3xl" aria-hidden />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-400/90">Listening</p>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">{channelName}</h1>
            {description?.trim() ? (
              <p className="max-w-lg text-pretty text-sm leading-relaxed text-zinc-400 sm:text-base">{description.trim()}</p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant={isLive ? "success" : "secondary"} className="capitalize">
                {isLive ? "Live" : "Idle"}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {channelPrivacy}
              </Badge>
              {typeof memberLimit === "number" ? (
                <Badge variant="outline" className="text-zinc-400">
                  Cap {memberLimit}
                </Badge>
              ) : null}
              {joinRequiresApproval ? (
                <Badge variant="warning" className="text-[10px] sm:text-xs">
                  Approval
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
                connected
                  ? "border-emerald-500/35 bg-emerald-950/50 text-emerald-200"
                  : "border-amber-500/30 bg-amber-950/40 text-amber-200",
              )}
            >
              {connected ? <Wifi className="size-3.5 shrink-0" aria-hidden /> : <WifiOff className="size-3.5 shrink-0" aria-hidden />}
              <span className="capitalize">{connected ? "Connected" : socketState}</span>
            </div>
          </div>
        </div>
      </header>

      <section
        className={cn(
          "rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-5 shadow-inner backdrop-blur-sm sm:p-7",
          isLive && nowPlayingLabel ? "ring-1 ring-emerald-500/20" : "",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <Radio className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-medium text-white">Now playing</h2>
          </div>
        </div>
        <div className="mt-5 rounded-xl border border-zinc-800/90 bg-black/40 px-4 py-5 sm:px-6 sm:py-6">
          {nowPlayingLabel ? (
            <p className="text-lg font-medium leading-snug text-zinc-100 sm:text-xl">{nowPlayingLabel}</p>
          ) : (
            <p className="text-sm text-zinc-500 sm:text-base">Nothing playing yet.</p>
          )}
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-between">
        <Button variant="secondary" className="w-full gap-2 sm:w-auto" asChild>
          <Link href="/dashboard">
            <Home className="size-4" aria-hidden />
            Dashboard
          </Link>
        </Button>
        {showLeave ? (
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 border-red-900/55 text-red-200 hover:bg-red-950/35 sm:ml-auto sm:w-auto"
            onClick={onLeaveClick}
          >
            <LogOut className="size-4" aria-hidden />
            Leave channel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
