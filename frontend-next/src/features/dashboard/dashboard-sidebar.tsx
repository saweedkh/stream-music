"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Bell, LayoutGrid, ListMusic, LogIn, Music, Radio, Share2 } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { DashboardAccountSection } from "@/features/dashboard/dashboard-account-section";
import type { DashboardTab } from "@/features/dashboard/dashboard-types";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { AuthUser } from "@/lib/api";
import { cn } from "@/lib/utils";

type NavItem = {
  id: DashboardTab;
  labelKey:
    | "dashboard.tab.channels"
    | "dashboard.tab.tracks"
    | "dashboard.tab.playlists"
    | "dashboard.tab.sharing"
    | "dashboard.tab.settings";
  icon: LucideIcon;
};

type NavSection = {
  titleKey: "dashboard.sidebar.section.channels" | "dashboard.sidebar.section.library" | "dashboard.sidebar.section.settings";
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    titleKey: "dashboard.sidebar.section.channels",
    items: [{ id: "channels", labelKey: "dashboard.tab.channels", icon: LayoutGrid }],
  },
  {
    titleKey: "dashboard.sidebar.section.library",
    items: [
      { id: "tracks", labelKey: "dashboard.tab.tracks", icon: Music },
      { id: "playlists", labelKey: "dashboard.tab.playlists", icon: ListMusic },
      { id: "sharing", labelKey: "dashboard.tab.sharing", icon: Share2 },
    ],
  },
  {
    titleKey: "dashboard.sidebar.section.settings",
    items: [{ id: "settings", labelKey: "dashboard.tab.settings", icon: Bell }],
  },
];

function SectionDivider() {
  return (
    <div className="py-2" aria-hidden>
      <Separator className="bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
}

type DashboardSidebarProps = {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  onJoinChannelClick?: () => void;
  user: AuthUser | null;
  onSidebarAction?: () => void;
  className?: string;
};

export function DashboardSidebar({
  activeTab,
  onSelectTab,
  onJoinChannelClick,
  user,
  onSidebarAction,
  className,
}: DashboardSidebarProps) {
  const { t } = useTranslations();

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
              <span className="text-gradient-brand">Stream</span>{" "}
              <span className="text-foreground">Music</span>
            </span>
          </Link>
          {user ? (
            <NotificationCenter
              triggerClassName="h-11 w-11 shrink-0 rounded-xl hover:bg-muted/40"
              iconClassName="h-5 w-5"
            />
          ) : null}
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

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/80">
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <div key={section.titleKey} className={sectionIndex > 0 ? "mt-1" : ""}>
            {sectionIndex > 0 ? <SectionDivider /> : null}
            <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/90">
              {t(section.titleKey)}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelectTab(item.id)}
                      className={cn(
                        "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                        isActive
                          ? "bg-brand/12 text-brand shadow-sm shadow-brand/5"
                          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {isActive ? (
                        <span className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-brand" aria-hidden />
                      ) : null}
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                          isActive ? "bg-brand/15 text-brand" : "bg-muted/30 text-muted-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="truncate">{t(item.labelKey)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border/60 bg-gradient-to-t from-card/30 to-transparent px-4 py-3">
        <DashboardAccountSection user={user} onAction={onSidebarAction} preferencesInMenu />
      </div>
    </aside>
  );
}
