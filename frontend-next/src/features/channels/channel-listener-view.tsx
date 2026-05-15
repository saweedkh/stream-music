"use client";

import Link from "next/link";
import { Home, LogOut, Radio, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ChannelRoomLoading() {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-2xl flex-col gap-5 px-4 py-12 sm:px-6">
      <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/55 p-6 sm:p-8">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-4 h-8 w-2/3" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-4/5" />
        <div className="mt-5 flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/55 p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-10 w-full" />
        <Skeleton className="mt-2 h-4 w-1/2" />
      </div>
      <p className="text-center text-sm text-zinc-500">Loading your access…</p>
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
  brandLogoUrl?: string;
  sendSocketMessage?: (payload: Record<string, unknown>) => boolean;
  experience?: import("@/features/experience/room-experience-chrome").ChannelExperience;
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
  brandLogoUrl,
  experience,
}: ListenerProps) {
  const connected = socketState === "connected";
  const accent = (experience?.accent || "emerald").toLowerCase();
  const headerAccent =
    accent === "violet"
      ? "border-violet-500/20 bg-gradient-to-br from-zinc-950 via-violet-950/25 to-zinc-950 shadow-[0_24px_60px_-20px_rgba(139,92,246,0.35)]"
      : accent === "rose"
        ? "border-rose-500/20 bg-gradient-to-br from-zinc-950 via-rose-950/25 to-zinc-950 shadow-[0_24px_60px_-20px_rgba(244,63,94,0.3)]"
        : accent === "amber"
          ? "border-amber-500/20 bg-gradient-to-br from-zinc-950 via-amber-950/25 to-zinc-950 shadow-[0_24px_60px_-20px_rgba(245,158,11,0.28)]"
          : accent === "sky"
            ? "border-sky-500/20 bg-gradient-to-br from-zinc-950 via-sky-950/25 to-zinc-950 shadow-[0_24px_60px_-20px_rgba(14,165,233,0.3)]"
            : "border-emerald-500/20 bg-gradient-to-br from-zinc-950 via-emerald-950/25 to-zinc-950 shadow-[0_24px_60px_-20px_rgba(16,185,129,0.35)]";
  const labelAccent =
    accent === "violet"
      ? "text-violet-400/90"
      : accent === "rose"
        ? "text-rose-400/90"
        : accent === "amber"
          ? "text-amber-400/90"
          : accent === "sky"
            ? "text-sky-400/90"
            : "text-emerald-400/90";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-32 pt-2 sm:px-6 sm:pt-4">
      <header
        className={cn(
          "relative overflow-hidden rounded-3xl border p-6 sm:p-8 lg:p-10",
          headerAccent,
        )}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-white/5 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-32 w-32 rounded-full bg-white/5 blur-3xl" aria-hidden />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            {brandLogoUrl ? (
              <img src={brandLogoUrl} alt="" className="h-14 w-14 rounded-2xl border border-white/10 object-cover shadow-lg" />
            ) : null}
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.25em]", labelAccent)}>Listening</p>
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
