"use client";

import Link from "next/link";
import { Home, LogOut } from "lucide-react";
import { ChannelRoomHeader } from "@/components/room/channel-room-header";
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

type MetaProps = {
  description?: string;
  memberLimit?: number;
  joinRequiresApproval?: boolean;
  experience?: import("@/features/experience/room-experience-chrome").ChannelExperience;
};

/** Description, caps, and room rules — shown below the room header */
export function ChannelListenerMeta({ description, memberLimit, joinRequiresApproval, experience }: MetaProps) {
  const hasMeta =
    Boolean(description?.trim()) ||
    typeof memberLimit === "number" ||
    joinRequiresApproval ||
    Boolean(experience?.room_rules?.trim());

  if (!hasMeta) return null;

  return (
    <div className="space-y-4">
      {description?.trim() ? (
        <p className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 px-4 py-3 text-sm leading-relaxed text-zinc-400">{description.trim()}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {typeof memberLimit === "number" ? (
          <Badge variant="outline" className="text-zinc-400">
            Cap {memberLimit}
          </Badge>
        ) : null}
        {joinRequiresApproval ? (
          <Badge variant="warning" className="text-[10px] sm:text-xs">
            Approval required
          </Badge>
        ) : null}
      </div>

      {experience?.room_rules?.trim() ? (
        <section className="rounded-2xl border border-zinc-800/80 bg-zinc-950/55 p-4 sm:p-5">
          <h2 className="text-sm font-medium text-zinc-400">Room rules</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-200">{experience.room_rules.trim()}</p>
        </section>
      ) : null}
    </div>
  );
}

type ListenerProps = MetaProps & {
  channelId: string;
  channelName: string;
  channelPrivacy: string;
  isLive: boolean;
  socketState: string;
  channelIsActive?: boolean;
  nowPlayingLabel: string | null;
  showLeave: boolean;
  onLeaveClick: () => void;
  brandLogoUrl?: string;
  onShare?: () => void;
  onlineCount?: number | null;
  sendSocketMessage?: (payload: Record<string, unknown>) => boolean;
  /** Hide bottom nav when embedded in admin preview sheet */
  compact?: boolean;
};

export function ChannelListenerView({
  channelName,
  channelPrivacy,
  description,
  memberLimit,
  joinRequiresApproval,
  isLive,
  socketState,
  channelIsActive = true,
  nowPlayingLabel,
  showLeave,
  onLeaveClick,
  brandLogoUrl,
  onShare,
  onlineCount,
  experience,
  compact = false,
}: ListenerProps) {
  const accent = (experience?.accent || "emerald").toLowerCase();

  return (
    <div className={cn("mx-auto w-full max-w-2xl space-y-5", compact ? "px-0 pb-4 pt-0" : "px-4 pb-4 pt-2 sm:px-6 sm:pt-4")}>
      <ChannelRoomHeader
        channelName={channelName}
        channelPrivacy={channelPrivacy}
        brandLogoUrl={brandLogoUrl}
        isLive={isLive}
        isPlaying={isLive}
        socketState={socketState}
        channelIsActive={channelIsActive}
        nowPlayingLabel={nowPlayingLabel}
        accent={accent}
        showLeave={showLeave}
        onLeave={onLeaveClick}
        onShare={onShare}
        onlineCount={onlineCount}
      />

      <ChannelListenerMeta
        description={description}
        memberLimit={memberLimit}
        joinRequiresApproval={joinRequiresApproval}
        experience={experience}
      />

      {!compact ? (
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
      ) : null}
    </div>
  );
}
