"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/components/providers/locale-provider";
import { reopenChannel, type ChannelSummary } from "@/lib/api";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";
import { channelInitials, getChannelDisplayMeta, resolveLogoCandidates } from "@/features/dashboard/channels/channel-shared";

type ChannelCardProps = {
  channel: ChannelSummary;
  currentUserId: number | null;
  pendingSuggestions?: number;
  onChannelsRefresh: () => void | Promise<void>;
};

export function ChannelCard({ channel, currentUserId, pendingSuggestions = 0, onChannelsRefresh }: ChannelCardProps) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const meta = getChannelDisplayMeta(channel, currentUserId, pendingSuggestions, t);
  const logo = channel.brand_logo_url?.trim();
  const logoCandidates = useMemo(() => resolveLogoCandidates(logo), [logo]);
  const [logoAttempt, setLogoAttempt] = useState(0);
  const logoSrc = logoCandidates[logoAttempt] ?? null;

  useEffect(() => {
    setLogoAttempt(0);
  }, [logo, channel.id]);

  const tileClass = cn(
    "group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[var(--workspace-divider)] bg-[var(--workspace-list)] shadow-sm transition-all",
    meta.isLive && "border-brand/40 shadow-[0_0_0_1px_rgba(34,197,94,0.25)]",
    !meta.isLive && meta.isActive && "hover:-translate-y-0.5 hover:border-brand/35 hover:shadow-md",
    !meta.isActive && "opacity-60",
  );

  const statusPill = (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase leading-none tracking-wide backdrop-blur",
        meta.statusTone,
      )}
    >
      {meta.statusLabel}
    </span>
  );

  const pendingDot =
    pendingSuggestions > 0 ? (
      <span
        className="absolute end-3 top-3 size-2 rounded-full bg-amber-500 ring-2 ring-black/5 dark:ring-white/10"
        title={t("room.admin.suggestions.pendingBadge", { count: pendingSuggestions })}
      />
    ) : null;

  const header = (
    <div className="relative h-28 w-full">
      {logoSrc ? (
        <img
          src={logoSrc}
          alt=""
          className={cn(
            "h-full w-full object-cover transition-transform duration-300",
            meta.isActive ? "group-hover:scale-[1.03]" : undefined,
          )}
          loading="lazy"
          onError={() => setLogoAttempt((prev) => (prev + 1 < logoCandidates.length ? prev + 1 : prev))}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted/70 to-muted/20">
          <span className="font-display text-2xl font-bold text-muted-foreground">{channelInitials(channel.name)}</span>
        </div>
      )}
      <div
        className={cn(
          "pointer-events-none absolute inset-0",
          meta.isLive
            ? "bg-gradient-to-t from-brand/[0.24] via-black/10 to-transparent"
            : "bg-gradient-to-t from-black/20 via-black/10 to-transparent dark:from-black/30",
        )}
      />

      <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
        {statusPill}
        {pendingDot}
      </div>
    </div>
  );

  const body = (
    <div className="flex flex-1 flex-col gap-2 px-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{channel.name}</p>
        <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{meta.secondaryMeta}</p>
      </div>
      <div className="mt-auto pt-1">
        {meta.isActive ? (
          <Button
            asChild
            size="sm"
            className={cn(
              "h-9 w-full justify-center rounded-xl px-3 text-sm",
              meta.isLive && "bg-brand text-brand-foreground hover:bg-brand-strong",
            )}
          >
            <Link href={meta.href}>{meta.enterLabel}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );

  const content = (
    <>
      {header}
      {body}
    </>
  );

  if (!meta.isActive && meta.isOwner) {
    return (
      <li className={tileClass}>
        {header}
        <div className="flex flex-1 flex-col gap-2 px-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{channel.name}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{meta.secondaryMeta}</p>
          </div>
          <div className="mt-auto flex items-center gap-2 pt-1">
            <div className="shrink-0">{statusPill}</div>
            <div className="flex-1" />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 min-w-[6.5rem] justify-center rounded-xl px-3 text-sm"
            onClick={() => {
              void (async () => {
                try {
                  await reopenChannel(String(channel.id));
                  showToast(t("channels.reopenSuccess"), "success");
                  await onChannelsRefresh();
                } catch (e) {
                  showToast(e instanceof Error ? e.message : t("channels.reopenFailed"), "error");
                }
              })();
            }}
          >
            {t("channels.reopen")}
          </Button>
          </div>
        </div>
      </li>
    );
  }

  if (!meta.isActive && !meta.isOwner) {
    return (
      <li className={tileClass} aria-disabled>
        {header}
        <div className="flex flex-1 flex-col gap-2 px-3 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{channel.name}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{meta.secondaryMeta}</p>
          </div>
          <div className="mt-auto pt-1">{statusPill}</div>
        </div>
      </li>
    );
  }

  return <li className={tileClass}>{content}</li>;
}
