"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useTranslations } from "@/shared/providers/locale-provider";
import { reopenChannel, type ChannelSummary } from "@/lib/api";
import { useToast } from "@/shared/ui/toast-provider";
import { cn } from "@/lib/utils";
import { ChannelAvatar, getChannelDisplayMeta } from "@/features/dashboard/channels/channel-shared";

type ChannelRowProps = {
  channel: ChannelSummary;
  currentUserId: number | null;
  pendingSuggestions?: number;
  onChannelsRefresh: () => void | Promise<void>;
};

export function ChannelRow({ channel, currentUserId, pendingSuggestions = 0, onChannelsRefresh }: ChannelRowProps) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const meta = getChannelDisplayMeta(channel, currentUserId, pendingSuggestions, t);

  const rowClass = cn(
    "flex items-center gap-3 rounded-lg px-2.5 py-2.5 sm:px-3",
    meta.isLive && "bg-gradient-to-r from-brand/[0.08] to-transparent",
    !meta.isLive && meta.isActive && "hover:bg-muted/35",
    !meta.isActive && "opacity-65",
  );

  const textBlock = (
    <div className="min-w-0 flex-1">
      <p className={cn("truncate text-sm font-semibold", meta.isLive ? "text-foreground" : "text-foreground/90")}>
        {channel.name}
      </p>
      <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", meta.statusTone)}>
          {meta.statusLabel}
        </span>
        <span className="truncate text-xs text-muted-foreground">{meta.secondaryMeta}</span>
      </p>
    </div>
  );

  if (!meta.isActive && meta.isOwner) {
    return (
      <li className={rowClass}>
        <ChannelAvatar channel={channel} isLive={false} className="size-11" />
        {textBlock}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 shrink-0 gap-1 px-3"
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
      </li>
    );
  }

  if (!meta.isActive && !meta.isOwner) {
    return (
      <li className={rowClass} aria-disabled>
        <ChannelAvatar channel={channel} isLive={false} className="size-11" />
        {textBlock}
        <Button type="button" size="sm" variant="secondary" className="h-9 shrink-0 px-3" disabled>
          {t("channels.closed")}
        </Button>
      </li>
    );
  }

  return (
    <li className={rowClass}>
      <ChannelAvatar channel={channel} isLive={meta.isLive} className="size-11" />
      {textBlock}
      <Button
        size="sm"
        variant={meta.isLive ? "default" : "secondary"}
        className={cn(
          "h-9 shrink-0 gap-1.5 px-3",
          meta.isLive && "bg-brand text-brand-foreground hover:bg-brand-strong",
        )}
        asChild
      >
        <Link href={meta.href}>
          {meta.enterLabel}
          <ArrowRight className="size-3.5 rtl:rotate-180" aria-hidden />
        </Link>
      </Button>
    </li>
  );
}
