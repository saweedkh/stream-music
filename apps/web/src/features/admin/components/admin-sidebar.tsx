"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Crown } from "lucide-react";
import {
  ADMIN_NAV_SECTIONS,
  adminSectionHref,
  defaultExpandedAdminSections,
  type AdminNavSectionId,
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

function SectionDivider() {
  return (
    <div className="py-2" aria-hidden>
      <Separator className="bg-gradient-to-r from-transparent via-amber-500/15 to-transparent" />
    </div>
  );
}

export function AdminSidebar({ activeSection, user, onNavigate, className }: AdminSidebarProps) {
  const { t } = useTranslations();
  const [expanded, setExpanded] = useState<Record<AdminNavSectionId, boolean>>(() =>
    defaultExpandedAdminSections(activeSection),
  );

  useEffect(() => {
    setExpanded((prev) => ({
      ...prev,
      ...defaultExpandedAdminSections(activeSection),
    }));
  }, [activeSection]);

  function toggleSection(id: AdminNavSectionId) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 w-full shrink-0 flex-col border-e border-amber-500/15 bg-gradient-to-b from-amber-500/[0.06] via-card to-card",
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

      <nav
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-500/20"
        aria-label={t("admin.navAria")}
      >
        <SectionDivider />
        <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/90">
          {t("admin.sidebar.section.navigation")}
        </p>

        {ADMIN_NAV_SECTIONS.map((section, sectionIndex) => {
          const isOpen = expanded[section.id];
          const hasActive = section.items.some((item) => item.id === activeSection);

          return (
            <div key={section.id} className={sectionIndex > 0 ? "mt-1" : ""}>
              {sectionIndex > 0 ? <SectionDivider /> : null}

              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors",
                  hasActive ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground/90 hover:text-foreground",
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
                <ul className="mt-1 ms-2 space-y-0.5 border-s border-amber-500/15 ps-2">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <li key={item.id}>
                        <Link
                          href={adminSectionHref(item.id)}
                          onClick={onNavigate}
                          className={cn(
                            "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                            isActive
                              ? "bg-amber-500/15 text-amber-900 shadow-sm dark:text-amber-50"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                          )}
                          aria-current={isActive ? "page" : undefined}
                        >
                          {isActive ? (
                            <span className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-amber-500" aria-hidden />
                          ) : null}
                          <span
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
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
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-amber-500/15 px-3 py-3">
        <Separator className="mb-3 bg-amber-500/10" />
        <DashboardAccountSection user={user} onAction={onNavigate} preferencesInMenu />
      </div>
    </aside>
  );
}
