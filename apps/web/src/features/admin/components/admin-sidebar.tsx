"use client";

import Link from "next/link";
import { ArrowLeft, Crown } from "lucide-react";
import {
  ADMIN_NAV,
  adminSectionHref,
  type AdminSection,
} from "@/features/admin/model/admin-nav";
import { DashboardAccountSection } from "@/features/dashboard/components/dashboard-account-section";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";
import type { AuthUser } from "@/lib/api";
import { cn } from "@/lib/utils";

type AdminSidebarProps = {
  activeSection: AdminSection;
  user: AuthUser | null;
  onNavigate?: () => void;
  className?: string;
};

export function AdminSidebar({ activeSection, user, onNavigate, className }: AdminSidebarProps) {
  const { t } = useTranslations();

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[min(100%,19rem)] flex-col border-e border-amber-500/15 bg-gradient-to-b from-amber-500/[0.06] via-card to-card",
        className,
      )}
    >
      <div className="shrink-0 border-b border-amber-500/15 px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Crown className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700/80 dark:text-amber-400/90">
              {t("admin.panelEyebrow")}
            </p>
            <p className="truncate font-display text-base font-semibold">{t("admin.panelTitle")}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="mt-3 w-full gap-2 border-amber-500/25" asChild>
          <Link href="/dashboard" onClick={onNavigate}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("admin.backToApp")}
          </Link>
        </Button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-label={t("admin.navAria")}>
        <ul className="space-y-0.5">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <li key={item.id}>
                <Link
                  href={adminSectionHref(item.id)}
                  onClick={onNavigate}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-amber-500/15 text-amber-900 shadow-sm dark:text-amber-50"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {isActive ? (
                    <span className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-amber-500" aria-hidden />
                  ) : null}
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      isActive ? "bg-amber-500/20 text-amber-700 dark:text-amber-300" : "bg-muted/40",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="truncate">{t(item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-amber-500/15 px-3 py-3">
        <Separator className="mb-3 bg-amber-500/10" />
        <DashboardAccountSection user={user} onAction={onNavigate} preferencesInMenu />
      </div>
    </aside>
  );
}
