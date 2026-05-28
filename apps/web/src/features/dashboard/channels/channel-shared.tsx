"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChannelSummary } from "@/lib/api";
import type { MessageKey } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

const PRIVACY_KEYS: Record<ChannelSummary["privacy"], MessageKey> = {
  public: "channels.privacyPublic",
  private: "channels.privacyPrivate",
  unlisted: "channels.privacyUnlisted",
};

export function channelInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

export function resolveLogoCandidates(logo?: string | null): string[] {
  const value = logo?.trim();
  if (!value) return [];
  if (typeof window === "undefined") return [value];
  try {
    const parsed = new URL(value, window.location.origin);
    const sameOriginUrl = `${window.location.origin}${parsed.pathname}${parsed.search}`;
    return Array.from(new Set([parsed.toString(), sameOriginUrl, `${window.location.origin}${parsed.pathname}`]));
  } catch {
    return [value];
  }
}

export function ChannelAvatar({
  channel,
  isLive,
  className,
}: {
  channel: ChannelSummary;
  isLive: boolean;
  className?: string;
}) {
  const logo = channel.brand_logo_url?.trim();
  const logoCandidates = useMemo(() => resolveLogoCandidates(logo), [logo]);
  const [logoAttempt, setLogoAttempt] = useState(0);
  const logoSrc = logoCandidates[logoAttempt] ?? null;
  useEffect(() => {
    setLogoAttempt(0);
  }, [logo, channel.id]);

  return (
    <span
      className={cn(
        "relative flex shrink-0 overflow-visible rounded-xl border",
        isLive ? "border-brand/30 shadow-[0_0_16px_-4px_rgba(34,197,94,0.4)]" : "border-[var(--workspace-divider)]",
        className,
      )}
    >
      <span className="size-full overflow-hidden rounded-[inherit]">
        {logoSrc ? (
          <img
            src={logoSrc}
            alt=""
            className="size-full object-cover"
            loading="lazy"
            onError={() => setLogoAttempt((prev) => (prev + 1 < logoCandidates.length ? prev + 1 : prev))}
          />
        ) : (
          <span
            className={cn(
              "flex size-full items-center justify-center font-display font-bold",
              isLive ? "bg-gradient-to-br from-brand/25 to-brand/5 text-brand" : "bg-muted/50 text-muted-foreground",
            )}
          >
            {channelInitials(channel.name)}
          </span>
        )}
      </span>
      {isLive ? (
        <span
          className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full border-2 border-[var(--workspace-list)] bg-emerald-400 shadow-[0_0_0_2px_color-mix(in_srgb,var(--workspace-list)_68%,transparent),0_0_8px_rgba(52,211,153,0.55)]"
          aria-hidden
        />
      ) : null}
    </span>
  );
}

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export type ChannelDisplayMeta = {
  isOwner: boolean;
  isActive: boolean;
  isLive: boolean;
  href: string;
  enterLabel: string;
  statusLabel: string;
  statusTone: string;
  secondaryMeta: string;
};

export function getChannelDisplayMeta(
  channel: ChannelSummary,
  currentUserId: number | null,
  pendingSuggestions: number,
  t: Translate,
): ChannelDisplayMeta {
  const isOwner = channel.owner != null && currentUserId != null && Number(channel.owner) === Number(currentUserId);
  const isActive = channel.is_active !== false;
  const isLive = isActive && channel.is_playing === true;
  const href = `/channel/${channel.id}`;

  const enterLabel =
    !isActive && isOwner
      ? t("channels.manage")
      : channel.membership_is_active === false
        ? t("channels.reconnect")
        : t("channels.openRoom");

  const statusLabel = !isActive
    ? t("channels.closed")
    : isLive
      ? t("channels.live")
      : t("channels.notPlaying");

  const statusTone = !isActive
    ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
    : isLive
      ? "bg-brand/15 text-brand"
      : "bg-muted/50 text-muted-foreground";

  const metaParts = [
    t(PRIVACY_KEYS[channel.privacy] ?? "channels.privacyPublic"),
    t("channels.cap", { count: channel.member_limit ?? "—" }),
  ];
  if (pendingSuggestions > 0) {
    metaParts.push(t("room.admin.suggestions.pendingBadge", { count: pendingSuggestions }));
  }
  if (channel.membership_is_active === false) {
    metaParts.push(t("channels.leftReconnect"));
  } else if (channel.join_requires_approval) {
    metaParts.push(t("channels.approvalRequired"));
  }

  return {
    isOwner,
    isActive,
    isLive,
    href,
    enterLabel,
    statusLabel,
    statusTone,
    secondaryMeta: metaParts.join(" · "),
  };
}
