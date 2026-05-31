"use client";

import type { ReactNode } from "react";
import { AppNavLayout } from "@/shared/layout/app-nav-layout";
import type { AdminSection } from "@/features/dashboard/model/dashboard-nav-config";
import type { DashboardTab } from "@/features/dashboard/model/dashboard-types";

type DashboardShellProps = {
  activeTab: DashboardTab;
  activeAdminSection: AdminSection;
  onSelectMainTab: (tab: Exclude<DashboardTab, "admin">) => void;
  onSelectAdminSection: (section: AdminSection) => void;
  children: ReactNode;
};

export function DashboardShell({
  activeTab,
  activeAdminSection,
  onSelectMainTab,
  onSelectAdminSection,
  children,
}: DashboardShellProps) {
  return (
    <AppNavLayout
      activeTab={activeTab}
      activeAdminSection={activeAdminSection}
      onSelectMainTab={onSelectMainTab}
      onSelectAdminSection={onSelectAdminSection}
    >
      {children}
    </AppNavLayout>
  );
}
