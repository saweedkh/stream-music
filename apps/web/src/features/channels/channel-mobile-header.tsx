"use client";

import { Menu, Radio } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { Button } from "@/components/ui/button";
import type { AuthUser } from "@/lib/api";
type Props = {
  onMenuClick: () => void;
  user: AuthUser | null;
  channelName: string;
  brandLogoUrl?: string | null;
  isLive?: boolean;
};

export function ChannelMobileHeader({ onMenuClick, user, channelName, brandLogoUrl, isLive }: Props) {
  const { t } = useTranslations();

  return (
    <header className="sticky top-0 z-30 grid h-14 shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-border/60 bg-background/90 px-3 backdrop-blur-xl lg:hidden">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0 border-border/70"
        aria-label={t("dashboard.openMenu")}
        onClick={onMenuClick}
      >
        <Menu className="h-4 w-4" />
      </Button>

      <div className="flex min-w-0 items-center justify-center gap-2 px-1">
        {brandLogoUrl ? (
          <img
            src={brandLogoUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded-lg border border-border/60 object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/10 text-brand">
            <Radio className="h-4 w-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0 text-center">
          <p className="truncate font-display text-sm font-semibold tracking-tight text-foreground">{channelName}</p>
          {isLive ? (
            <p className="text-[10px] font-medium uppercase tracking-wider text-brand">{t("channels.live")}</p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 justify-self-end">
        {user ? (
          <NotificationCenter triggerClassName="h-9 w-9 rounded-lg hover:bg-muted/40" iconClassName="h-4 w-4" />
        ) : (
          <span className="h-9 w-9" aria-hidden />
        )}
      </div>
    </header>
  );
}
