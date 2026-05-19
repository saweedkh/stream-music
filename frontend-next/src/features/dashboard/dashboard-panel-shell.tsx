"use client";

import type { ReactNode } from "react";
import { useTranslations } from "@/components/providers/locale-provider";
import {
  ADMIN_NAV,
  adminSectionMeta,
  profileNavIconForSection,
  profileSectionMeta,
  type AdminSection,
  type ProfileSection,
} from "@/features/dashboard/dashboard-nav-config";
import { DASHBOARD_TAB_ICONS, DASHBOARD_TAB_META } from "@/features/dashboard/dashboard-nav-meta";
import type { DashboardTab } from "@/features/dashboard/dashboard-types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { hubPanelRoot, panelLgCage, panelMobileFlat } from "@/lib/mobile-page-layout";
import { cn } from "@/lib/utils";

type Props = {
  tab: DashboardTab;
  profileSection?: ProfileSection;
  adminSection?: AdminSection;
  children: ReactNode;
  badge?: ReactNode;
  className?: string;
  flush?: boolean;
};

export function DashboardPanelShell({
  tab,
  profileSection,
  adminSection,
  children,
  badge,
  className,
  flush,
}: Props) {
  const { t } = useTranslations();

  const profileIcon = tab === "settings" && profileSection ? profileNavIconForSection(profileSection) : undefined;
  const adminItem = tab === "admin" && adminSection ? ADMIN_NAV.find((n) => n.id === adminSection) : null;
  const subsectionIcon = profileIcon ?? adminItem?.icon;
  const Icon = subsectionIcon ?? DASHBOARD_TAB_ICONS[tab];

  const titleKey =
    tab === "settings" && profileSection
      ? profileSectionMeta(profileSection).titleKey
      : tab === "admin" && adminSection
        ? adminSectionMeta(adminSection).titleKey
        : DASHBOARD_TAB_META[tab].titleKey;

  const descriptionKey =
    tab === "settings" && profileSection
      ? profileSectionMeta(profileSection).descriptionKey
      : tab === "admin" && adminSection
        ? adminSectionMeta(adminSection).descriptionKey
        : DASHBOARD_TAB_META[tab].descriptionKey;

  const isAdminTab = tab === "admin";
  const isFavoritesTab = tab === "favoritePlaylists" || tab === "favoriteTracks";

  return (
    <div
      className={cn(
        "relative",
        hubPanelRoot,
        panelMobileFlat,
        panelLgCage,
        "lg:overflow-hidden",
        "lg:shadow-[0_0_0_1px_rgba(16,185,129,0.12),0_20px_60px_-24px_rgba(0,0,0,0.75)]",
        "lg:before:pointer-events-none lg:before:absolute lg:before:inset-0 lg:before:rounded-2xl lg:before:bg-[radial-gradient(700px_circle_at_20%_-10%,rgba(52,211,153,0.1),transparent_50%)]",
        className,
      )}
    >
      <header
        className={cn(
          "relative z-[1] flex shrink-0 items-center gap-2.5 border-b border-border/40 px-1 pb-2.5 pt-0.5 sm:gap-3 sm:px-2 sm:pb-3",
          "lg:items-start lg:bg-[var(--surface-inset)] lg:px-5 lg:py-3",
          flush && "max-lg:hidden",
        )}
      >
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl border lg:size-10 lg:rounded-2xl",
            isAdminTab
              ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : isFavoritesTab
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-brand/30 bg-brand/10 text-brand",
          )}
        >
          <Icon className="size-4 lg:size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground sm:text-base">{t(titleKey)}</h2>
            {badge}
          </div>
          {descriptionKey ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">{t(descriptionKey)}</p>
          ) : null}
        </div>
      </header>

      {flush ? (
        <div className="relative z-[1] flex w-full flex-col max-lg:flex-none max-lg:overflow-visible lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:p-2 xl:p-3">
          {children}
        </div>
      ) : (
        <>
          <div className="relative z-[1] flex w-full flex-col max-lg:flex-none px-1 py-2 sm:px-2 sm:py-3 max-lg:overflow-visible lg:hidden">
            {children}
          </div>
          <div className="relative z-[1] hidden min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3 lg:flex">
            <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-border/40 bg-[var(--surface-inset)]">
              <div className="p-3 sm:p-4">{children}</div>
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
}
