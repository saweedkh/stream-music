"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { Button } from "@/components/ui/button";
import type { AuthUser } from "@/lib/api";

type DashboardMobileHeaderProps = {
  onMenuClick: () => void;
  user: AuthUser | null;
};

export function DashboardMobileHeader({ onMenuClick, user }: DashboardMobileHeaderProps) {
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

      <p className="truncate text-center font-display text-sm font-semibold tracking-tight">
        <span className="text-gradient-brand">Stream</span> <span className="text-foreground">Music</span>
      </p>

      <div className="flex shrink-0 justify-self-end">
        {user ? (
          <NotificationCenter
            triggerClassName="h-9 w-9 rounded-lg hover:bg-muted/40"
            iconClassName="h-4 w-4"
          />
        ) : (
          <span className="h-9 w-9" aria-hidden />
        )}
      </div>
    </header>
  );
}
