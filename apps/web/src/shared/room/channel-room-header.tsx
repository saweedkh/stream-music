"use client";

import { DoorClosed, LogOut, Share2, Users } from "lucide-react";
import { NowPlayingHero } from "@/shared/room/now-playing-hero";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";
import type { AccentKey } from "@/lib/theme";
import { accentLabelClass } from "@/lib/theme";

type Props = {
  channelName: string;
  channelPrivacy: string;
  brandLogoUrl?: string | null;
  isLive: boolean;
  isPlaying: boolean;
  socketState: string;
  channelIsActive: boolean;
  nowPlayingLabel: string | null;
  accent?: string;
  isOwner?: boolean;
  showLeave?: boolean;
  onLeave?: () => void;
  onCloseChannel?: () => void;
  onShare?: () => void;
  /** Live socket presence count; omit to hide the badge */
  onlineCount?: number | null;
  className?: string;
};

export function ChannelRoomHeader({
  channelName,
  channelPrivacy,
  brandLogoUrl,
  isLive,
  isPlaying,
  socketState,
  channelIsActive,
  nowPlayingLabel,
  accent = "emerald",
  isOwner,
  showLeave,
  onLeave,
  onCloseChannel,
  onShare,
  onlineCount,
  className,
}: Props) {
  const accentKey = (accent || "emerald").toLowerCase() as AccentKey;
  const labelClass = accentLabelClass[accentKey] ?? accentLabelClass.emerald;
  const letter = nowPlayingLabel?.charAt(0).toUpperCase() ?? channelName.charAt(0).toUpperCase();

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border/80 bg-card/60 p-5 shadow-lg shadow-black/25 backdrop-blur-xl",
        "animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none",
        className,
      )}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {brandLogoUrl ? (
              <img src={brandLogoUrl} alt="" className="h-14 w-14 shrink-0 rounded-2xl border border-white/10 object-cover shadow-lg" />
            ) : null}
            <div className="space-y-1">
              <p className={cn("text-xs font-medium uppercase tracking-widest", labelClass)}>Live room</p>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{channelName}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onShare ? (
              <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={onShare}>
                <Share2 className="h-4 w-4" aria-hidden />
                Share
              </Button>
            ) : null}
            {isOwner && channelIsActive && onCloseChannel ? (
              <Button type="button" variant="destructive" size="sm" className="gap-1.5" onClick={onCloseChannel}>
                <DoorClosed className="h-4 w-4" aria-hidden />
                Close
              </Button>
            ) : null}
            {showLeave && onLeave ? (
              <Button type="button" variant="outline" size="sm" className="gap-1.5 border-red-900/60 text-destructive hover:bg-red-950/40" onClick={onLeave}>
                <LogOut className="h-4 w-4" aria-hidden />
                Leave
              </Button>
            ) : null}
            {onlineCount != null ? (
              <Badge variant="success" className="gap-1">
                <Users className="h-3 w-3" aria-hidden />
                {onlineCount} online
              </Badge>
            ) : null}
            <Badge variant={isLive ? "success" : "secondary"}>{isLive ? "Live" : "Idle"}</Badge>
            <Badge variant={isPlaying ? "success" : "outline"}>{isPlaying ? "Playing" : "Paused"}</Badge>
            <Badge variant="outline" className="capitalize">
              {channelPrivacy}
            </Badge>
            {!channelIsActive ? (
              <Badge variant="warning">Closed</Badge>
            ) : (
              <Badge variant={socketState === "connected" ? "success" : "warning"}>{socketState}</Badge>
            )}
          </div>
        </div>

        {nowPlayingLabel ? (
          <NowPlayingHero
            title={nowPlayingLabel}
            metaLine="Synced with everyone in the room"
            letter={letter}
            accent={accent}
            size="lg"
            className="rounded-xl border border-border/60 bg-card/40 p-4"
          />
        ) : (
          <p className="rounded-xl border border-dashed border-border/80 bg-card/30 px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing playing yet — queue a track or wait for the DJ.
          </p>
        )}
      </div>
    </section>
  );
}
