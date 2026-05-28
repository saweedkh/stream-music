"use client";

import type { ReactNode } from "react";
import { AppNavLayout } from "@/shared/layout/app-nav-layout";
import type { AdminSection, ProfileSection } from "@/features/dashboard/model/dashboard-nav-config";
import type { DashboardTab } from "@/features/dashboard/model/dashboard-types";

type DashboardShellProps = {
  activeTab: DashboardTab;
  activeProfileSection: ProfileSection;
  activeAdminSection: AdminSection;
  onSelectMainTab: (tab: Exclude<DashboardTab, "settings" | "admin">) => void;
  onSelectProfileSection: (section: ProfileSection) => void;
  onSelectAdminSection: (section: AdminSection) => void;
  children: ReactNode;
};

export function DashboardShell({
  activeTab,
  activeProfileSection,
  activeAdminSection,
  onSelectMainTab,
  onSelectProfileSection,
  onSelectAdminSection,
  children,
}: DashboardShellProps) {
  return (
    <AppNavLayout
      activeTab={activeTab}
      activeProfileSection={activeProfileSection}
      activeAdminSection={activeAdminSection}
      onSelectMainTab={onSelectMainTab}
      onSelectProfileSection={onSelectProfileSection}
      onSelectAdminSection={onSelectAdminSection}
    >
      {children}
    </AppNavLayout>
  );
}
