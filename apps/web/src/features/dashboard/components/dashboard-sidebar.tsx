"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Crown, LogIn, Radio } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { DashboardAccountSection } from "@/features/dashboard/components/dashboard-account-section";
import {
  type AdminSection,
  dashboardNavSections,
  isDashboardRouteNavItem,
  type DashboardNavSection,
} from "@/features/dashboard/model/dashboard-nav-config";
import { isAccountDashboardTab, type DashboardTab } from "@/features/dashboard/model/dashboard-types";
import { NotificationCenter } from "@/shared/notifications/notification-center";
import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";
import type { AuthUser } from "@/lib/api";
import { cn } from "@/lib/utils";

type CollapsibleSectionId = "channels" | "library" | "help" | "account" | "admin";

function SectionDivider() {
  return (
    <div className="py-2" aria-hidden>
      <Separator className="bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
}

type DashboardSidebarProps = {
  activePathname?: string | null;
  activeTab: DashboardTab;
  activeAdminSection: AdminSection;
  onSelectMainTab: (tab: Exclude<DashboardTab, "admin">) => void;
  onSelectAdminSection: (section: AdminSection) => void;
  onJoinChannelClick?: () => void;
  user: AuthUser | null;
  onSidebarAction?: () => void;
  className?: string;
};

function mainSectionRouteActive(section: DashboardNavSection, activePathname: string | null | undefined): boolean {
  if (section.variant !== "main") return false;
  return section.items.some(
    (item) => isDashboardRouteNavItem(item) && Boolean(activePathname?.startsWith(item.href)),
  );
}

function sectionHasActive(
  section: DashboardNavSection,
  activePathname: string | null | undefined,
  activeTab: DashboardTab,
  activeAdminSection: AdminSection,
): boolean {
  if (section.variant === "main") {
    const routeActive = mainSectionRouteActive(section, activePathname);
    return section.items.some((item) =>
      isDashboardRouteNavItem(item)
        ? activePathname?.startsWith(item.href)
        : !routeActive && item.id === activeTab,
    );
  }
  if (section.variant === "account") {
    return isAccountDashboardTab(activeTab);
  }
  return activeTab === "admin" && section.items.some((item) => item.id === activeAdminSection);
}

function defaultExpanded(
  activePathname: string | null | undefined,
  activeTab: DashboardTab,
  activeAdminSection: AdminSection,
): Record<CollapsibleSectionId, boolean> {
  return {
    channels: activeTab === "channels" || activeTab === "following" || Boolean(activePathname?.startsWith("/explore")),
    library: activeTab === "tracks" || activeTab === "playlists" || activeTab === "sharing",
    help: activeTab === "support",
    account: isAccountDashboardTab(activeTab),
    admin: activeTab === "admin",
  };
}

export function DashboardSidebar({
  activePathname,
  activeTab,
  activeAdminSection,
  onSelectMainTab,
  onSelectAdminSection,
  onJoinChannelClick,
  user,
  onSidebarAction,
  className,
}: DashboardSidebarProps) {
  const { t } = useTranslations();
  const sections = dashboardNavSections(Boolean(user?.is_superuser));

  const [expanded, setExpanded] = useState<Record<CollapsibleSectionId, boolean>>(() =>
    defaultExpanded(activePathname, activeTab, activeAdminSection),
  );
  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      if (activeTab === "channels" || activePathname?.startsWith("/explore")) next.channels = true;
      if (activeTab === "tracks" || activeTab === "playlists" || activeTab === "sharing") next.library = true;
      if (activeTab === "support") next.help = true;
      if (isAccountDashboardTab(activeTab)) next.account = true;
      if (activeTab === "admin") next.admin = true;
      return next;
    });
  }, [activePathname, activeTab]);

  function toggleSection(id: CollapsibleSectionId) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleMainTab(tab: Exclude<DashboardTab, "admin">) {
    onSelectMainTab(tab);
    onSidebarAction?.();
  }

  function handleAdmin(section: AdminSection) {
    onSelectAdminSection(section);
    onSidebarAction?.();
  }

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-[18rem] shrink-0 flex-col bg-gradient-to-b from-card/50 to-card/20 backdrop-blur-xl lg:border-e lg:border-border/60",
        className,
      )}
    >
      <div className="shrink-0 px-4 pb-3 pt-5">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/dashboard"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 transition-opacity hover:opacity-90"
            onClick={onSidebarAction}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center text-brand">
              <Radio className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0 font-display text-lg font-semibold leading-tight tracking-tight">
              <span className="text-gradient-brand">Beat</span>{" "}
              <span className="text-foreground">Room</span>
            </span>
          </Link>
          {user ? (
            <NotificationCenter
              triggerClassName="h-11 w-11 shrink-0 rounded-xl hover:bg-muted/40"
              iconClassName="h-5 w-5"
            />
          ) : null}
        </div>
        <div className="mt-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("dashboard.workspace")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("dashboard.subtitle")}</p>
        </div>

        <Button
          type="button"
          className="mt-3 h-10 w-full gap-2 bg-brand text-brand-foreground shadow-md shadow-brand/15 hover:bg-brand-strong"
          onClick={onJoinChannelClick}
        >
          <LogIn className="h-4 w-4" aria-hidden />
          {t("dashboard.joinChannel")}
        </Button>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/80"
        aria-label={t("dashboard.navTitle")}
      >
        <SectionDivider />
        <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/90">
          {t("dashboard.sidebar.section.navigation")}
        </p>

        {sections.map((section, sectionIndex) => {
          const isOpen = expanded[section.id];
          const hasActive = sectionHasActive(section, activePathname, activeTab, activeAdminSection);
          const isAdminSection = section.variant === "admin";

          return (
            <div key={section.id} className={sectionIndex > 0 ? "mt-1" : ""}>
              {sectionIndex > 0 ? <SectionDivider /> : null}

              {isAdminSection ? (
                <div className="mb-1 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                  <Crown className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                  <p className="truncate text-xs font-semibold text-foreground">{t("admin.panelTitle")}</p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors",
                  hasActive
                    ? isAdminSection
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-brand"
                    : "text-muted-foreground/90 hover:text-foreground",
                )}
                aria-expanded={isOpen}
              >
                <ChevronRight
                  className={cn("h-3.5 w-3.5 shrink-0 transition-transform duration-200", isOpen && "rotate-90")}
                  aria-hidden
                />
                <span className="truncate">{t(section.titleKey)}</span>
              </button>

              {isOpen ? (
                <ul className="mt-1 ms-2 space-y-0.5 border-s border-border/50 ps-2">
                  {section.variant === "main"
                    ? section.items.map((item) => {
                        const Icon = item.icon;
                        const isRoute = isDashboardRouteNavItem(item);
                        const routeActiveInSection = mainSectionRouteActive(section, activePathname);
                        const isActive = isRoute
                          ? Boolean(activePathname?.startsWith(item.href))
                          : !routeActiveInSection && activeTab === item.id;
                        const rowClass = cn(
                          "relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                          isActive
                            ? "bg-brand/12 text-brand shadow-sm shadow-brand/5"
                            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                        );
                        return (
                          <li key={item.id}>
                            {isRoute ? (
                              <Link
                                href={item.href}
                                onClick={onSidebarAction}
                                className={rowClass}
                                aria-current={isActive ? "page" : undefined}
                              >
                                {isActive ? (
                                  <span className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-brand" aria-hidden />
                                ) : null}
                                <span
                                  className={cn(
                                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                                    isActive ? "bg-brand/15 text-brand" : "bg-muted/30 text-muted-foreground",
                                  )}
                                >
                                  <Icon className="h-4 w-4" aria-hidden />
                                </span>
                                <span className="truncate">{t(item.labelKey)}</span>
                              </Link>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleMainTab(item.id)}
                                className={rowClass}
                                aria-current={isActive ? "page" : undefined}
                              >
                                {isActive ? (
                                  <span className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-brand" aria-hidden />
                                ) : null}
                                <span
                                  className={cn(
                                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                                    isActive ? "bg-brand/15 text-brand" : "bg-muted/30 text-muted-foreground",
                                  )}
                                >
                                  <Icon className="h-4 w-4" aria-hidden />
                                </span>
                                <span className="truncate">{t(item.labelKey)}</span>
                              </button>
                            )}
                          </li>
                        );
                      })
                    : null}

                  {section.variant === "account"
                    ? section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => handleMainTab(item.id)}
                              className={cn(
                                "relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                                isActive
                                  ? "bg-brand/12 text-brand shadow-sm shadow-brand/5"
                                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                              )}
                              aria-current={isActive ? "page" : undefined}
                            >
                              {isActive ? (
                                <span className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-brand" aria-hidden />
                              ) : null}
                              <span
                                className={cn(
                                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                                  isActive ? "bg-brand/15 text-brand" : "bg-muted/30 text-muted-foreground",
                                )}
                              >
                                <Icon className="h-4 w-4" aria-hidden />
                              </span>
                              <span className="truncate">{t(item.labelKey)}</span>
                            </button>
                          </li>
                        );
                      })
                    : null}

                  {section.variant === "admin"
                    ? section.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === "admin" && activeAdminSection === item.id;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => handleAdmin(item.id)}
                              className={cn(
                                "relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                                isActive
                                  ? "bg-amber-500/15 text-amber-800 dark:text-amber-100"
                                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                              )}
                              aria-current={isActive ? "page" : undefined}
                            >
                              {isActive ? (
                                <span
                                  className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-amber-500"
                                  aria-hidden
                                />
                              ) : null}
                              <span
                                className={cn(
                                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                                  isActive
                                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                    : "bg-muted/30 text-muted-foreground",
                                )}
                              >
                                <Icon className="h-4 w-4" aria-hidden />
                              </span>
                              <span className="truncate">{t(item.labelKey)}</span>
                            </button>
                          </li>
                        );
                      })
                    : null}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-border/60 bg-gradient-to-t from-card/30 to-transparent px-4 py-3">
        <DashboardAccountSection user={user} onAction={onSidebarAction} preferencesInMenu />
      </div>
    </aside>
  );
}
