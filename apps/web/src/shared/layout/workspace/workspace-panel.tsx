"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Compass } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import {
  ADMIN_NAV,
  adminSectionMeta,
  profileNavIconForSection,
  profileSectionMeta,
  type AdminSection,
  type ProfileSection,
} from "@/features/dashboard/model/dashboard-nav-config";
import { DASHBOARD_TAB_ICONS, DASHBOARD_TAB_META } from "@/features/dashboard/model/dashboard-nav-meta";
import type { DashboardTab } from "@/features/dashboard/model/dashboard-types";
import type { MessageKey } from "@/lib/i18n/messages";
import { hubPanelRoot, panelLgSurface, panelMobileFlat } from "@/lib/mobile-page-layout";
import { cn } from "@/lib/utils";

export type WorkspacePanelProps = {
  tab: DashboardTab;
  profileSection?: ProfileSection;
  adminSection?: AdminSection;
  children: ReactNode;
  badge?: ReactNode;
  className?: string;
  /** Hide panel header on mobile (full-bleed sub-views like playlists) */
  flush?: boolean;
  /** Override tab defaults (e.g. standalone /explore route) */
  headerTitleKey?: MessageKey;
  headerDescriptionKey?: MessageKey;
  /** Name-based override so Server Components can pass it safely. */
  headerIconKey?: "compass";
};

/**
 * Unified dashboard / hub panel shell — use for every main workspace tab.
 * One surface, one scroll region, no nested card cages.
 */
export function WorkspacePanel({
  tab,
  profileSection,
  adminSection,
  children,
  badge,
  className,
  flush,
  headerTitleKey,
  headerDescriptionKey,
  headerIconKey,
}: WorkspacePanelProps) {
  const { t } = useTranslations();

  const profileIcon = tab === "settings" && profileSection ? profileNavIconForSection(profileSection) : undefined;
  const adminItem = tab === "admin" && adminSection ? ADMIN_NAV.find((n) => n.id === adminSection) : null;
  const subsectionIcon = profileIcon ?? adminItem?.icon;
  const headerIconFromKey: LucideIcon | undefined = headerIconKey === "compass" ? Compass : undefined;
  const Icon = headerIconFromKey ?? subsectionIcon ?? DASHBOARD_TAB_ICONS[tab];

  const titleKey =
    headerTitleKey ??
    (tab === "settings" && profileSection
      ? profileSectionMeta(profileSection).titleKey
      : tab === "admin" && adminSection
        ? adminSectionMeta(adminSection).titleKey
        : DASHBOARD_TAB_META[tab].titleKey);

  const descriptionKey =
    headerDescriptionKey ??
    (tab === "settings" && profileSection
      ? profileSectionMeta(profileSection).descriptionKey
      : tab === "admin" && adminSection
        ? adminSectionMeta(adminSection).descriptionKey
        : DASHBOARD_TAB_META[tab].descriptionKey);

  const isAdminTab = tab === "admin";

  return (
    <div
      className={cn(
        "workspace-panel relative flex flex-col",
        hubPanelRoot,
        panelMobileFlat,
        panelLgSurface,
        "lg:min-h-0 lg:overflow-hidden",
        className,
      )}
    >
      <header
        className={cn(
          "workspace-panel__header relative z-[1] flex shrink-0 items-center gap-3 border-b border-[var(--workspace-divider)] px-1 pb-3 pt-0.5 sm:px-2 lg:px-5 lg:py-4",
          flush && "max-lg:hidden",
        )}
      >
        <WorkspacePanelIcon icon={Icon} variant={isAdminTab ? "amber" : "brand"} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">{t(titleKey)}</h2>
            {badge}
          </div>
          {descriptionKey ? (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">{t(descriptionKey)}</p>
          ) : null}
        </div>
      </header>

      <div
        className={cn(
          "workspace-panel__body relative z-[1] flex min-h-0 flex-1 flex-col",
          flush
            ? "max-lg:flex-none max-lg:overflow-visible lg:overflow-hidden"
            : "max-lg:flex-none max-lg:overflow-visible lg:overflow-y-auto lg:overscroll-y-contain [-webkit-overflow-scrolling:touch]",
          "px-1 py-3 sm:px-2 sm:py-4 lg:px-5 lg:py-5",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function WorkspacePanelIcon({
  icon: Icon,
  variant = "brand",
  className,
}: {
  icon: LucideIcon;
  variant?: "brand" | "amber";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl",
        variant === "amber" ? "bg-amber-500/12 text-amber-600 dark:text-amber-400" : "bg-brand/12 text-brand",
        className,
      )}
    >
      <Icon className="size-[1.125rem]" aria-hidden />
    </div>
  );
}
