"use client";

import {
  BadgeCheck,
  Crown,
  Gem,
  Heart,
  Music,
  Shield,
  Sparkles,
  Star,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import type { UserBadge, UserBadgeFlags } from "@/lib/user-badges";
import { resolveUserBadges } from "@/lib/user-badges";
import { cn } from "@/lib/utils";

type UserVerifiedBadgeProps = {
  flags?: UserBadgeFlags | null;
  /** Show at most this many badges (default: all). */
  max?: number;
  size?: "xs" | "sm" | "md";
  className?: string;
};

const SIZE = {
  xs: { box: "h-4 w-4", icon: "h-2.5 w-2.5" },
  sm: { box: "h-[1.125rem] w-[1.125rem]", icon: "h-3 w-3" },
  md: { box: "h-5 w-5", icon: "h-3.5 w-3.5" },
} as const;

const ICON_MAP: Record<string, LucideIcon> = {
  "badge-check": BadgeCheck,
  crown: Crown,
  sparkles: Sparkles,
  star: Star,
  shield: Shield,
  music: Music,
  heart: Heart,
  zap: Zap,
  gem: Gem,
};

const COLOR_CLASS: Record<string, string> = {
  sky: "bg-sky-500 text-white shadow-sm shadow-sky-500/25",
  amber: "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm shadow-amber-500/30",
  violet: "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm shadow-violet-500/25",
  emerald: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-500/25",
  rose: "bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-sm shadow-rose-500/25",
  brand: "bg-brand text-brand-foreground shadow-sm shadow-brand/25",
  slate: "bg-slate-600 text-white shadow-sm shadow-slate-500/20",
};

function badgeTitle(badge: UserBadge, t: (key: MessageKey) => string): string {
  if (badge.slug === "platform_superuser") return t("badge.superuser");
  if (badge.slug === "platform_staff") return t("badge.staff");
  if (badge.slug === "premium") return t("badge.premium");
  return badge.label;
}

function SingleBadgeIcon({ badge, size }: { badge: UserBadge; size: keyof typeof SIZE }) {
  const s = SIZE[size];
  const Icon = ICON_MAP[badge.icon] ?? BadgeCheck;
  const colorClass = COLOR_CLASS[badge.color] ?? COLOR_CLASS.sky;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full", s.box, colorClass)}
      aria-hidden
    >
      <Icon className={cn(s.icon, badge.icon === "badge-check" && "fill-current")} />
    </span>
  );
}

/** Stack of account badges (staff tick, crown, premium, custom, …). */
export function UserVerifiedBadge({ flags, max, size = "sm", className }: UserVerifiedBadgeProps) {
  const { t } = useTranslations();
  const badges = resolveUserBadges(flags);
  if (!badges.length) return null;

  const visible = max != null ? badges.slice(0, max) : badges;
  const overflow = max != null && badges.length > max ? badges.length - max : 0;

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5", className)}>
      {visible.map((badge) => (
        <span key={badge.slug} title={badgeTitle(badge, t)}>
          <SingleBadgeIcon badge={badge} size={size} />
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-muted px-1 text-[9px] font-semibold text-muted-foreground",
            size === "md" ? "h-5 min-w-5" : "h-4 min-w-4",
          )}
          title={t("badge.more", { count: overflow })}
        >
          +{overflow}
        </span>
      ) : null}
    </span>
  );
}

type UsernameWithBadgesProps = {
  username: string;
  flags?: UserBadgeFlags | null;
  prefix?: string;
  maxBadges?: number;
  size?: "xs" | "sm" | "md";
  className?: string;
  usernameClassName?: string;
};

export function UsernameWithBadges({
  username,
  flags,
  prefix = "@",
  maxBadges = 4,
  size = "sm",
  className,
  usernameClassName,
}: UsernameWithBadgesProps) {
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1", className)}>
      <span className={cn("truncate", usernameClassName)}>
        {prefix}
        {username}
      </span>
      <UserVerifiedBadge flags={flags} max={maxBadges} size={size} />
    </span>
  );
}
