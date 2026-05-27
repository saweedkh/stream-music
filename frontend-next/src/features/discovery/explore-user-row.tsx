"use client";

import Link from "next/link";
import { Check, UserPlus } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublicUserProfile } from "@/lib/api";

type ExploreUserRowProps = {
  username: string;
  displayName: string;
  profile?: PublicUserProfile;
  following: boolean;
  busy: boolean;
  onToggleFollow: () => void;
};

function userInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export function ExploreUserRow({ username, displayName, profile, following, busy, onToggleFollow }: ExploreUserRowProps) {
  const { t } = useTranslations();
  const followers = profile?.follower_count ?? 0;
  const bio = profile?.profile?.bio?.trim() ?? "";

  const metaParts = [t("profile.public.followers", { count: followers })];
  if (profile?.public_channels?.length) {
    metaParts.push(t("explore.userPublicRooms", { count: profile.public_channels.length }));
  }

  return (
    <li
      className={cn(
        "group flex items-center gap-3 rounded-xl px-2.5 py-2.5 sm:px-3",
        "transition-colors hover:bg-muted/30 focus-within:bg-muted/30",
      )}
    >
      <Link
        href={`/users/${encodeURIComponent(username)}`}
        className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none"
      >
        <Avatar className="h-11 w-11 shrink-0 rounded-xl border-[var(--workspace-divider)] bg-[var(--workspace-stat)]">
          <AvatarFallback className="rounded-xl bg-gradient-to-br from-brand/30 via-muted/20 to-transparent font-display text-sm font-bold text-brand">
            {userInitials(displayName)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold tracking-tight text-foreground">{displayName}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span dir="ltr" className="inline-block">
              @{username}
            </span>
            <span className="opacity-60">•</span>
            <span className="truncate">{metaParts.join(" · ")}</span>
            {profile?.public_channels?.length ? (
              <Badge variant="secondary" className="h-5 px-2 text-[11px] font-semibold">
                {t("explore.userPublicRooms", { count: profile.public_channels.length })}
              </Badge>
            ) : null}
          </span>
          {bio ? (
            <span className="mt-1 line-clamp-1 block text-xs text-muted-foreground/90 group-hover:text-muted-foreground">
              {bio}
            </span>
          ) : null}
        </span>
      </Link>
      <Button
        type="button"
        size="sm"
        variant={following ? "secondary" : "default"}
        className={cn(
          "h-9 shrink-0 gap-1.5 px-3",
          !following && "bg-brand text-brand-foreground hover:bg-brand-strong",
        )}
        disabled={busy}
        onClick={onToggleFollow}
      >
        {following ? <Check className="size-3.5" aria-hidden /> : <UserPlus className="size-3.5" aria-hidden />}
        {following ? t("search.global.unfollow") : t("search.global.follow")}
      </Button>
    </li>
  );
}
