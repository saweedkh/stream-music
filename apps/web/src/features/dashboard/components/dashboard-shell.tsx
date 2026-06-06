"use client";

import type { ReactNode } from "react";
import { AppNavLayout } from "@/shared/layout/app-nav-layout";
import type { DashboardTab } from "@/features/dashboard/model/dashboard-types";

type DashboardShellProps = {
  activeTab: DashboardTab;
  onSelectMainTab: (tab: DashboardTab) => void;
  children: ReactNode;
};

export function DashboardShell({ activeTab, onSelectMainTab, children }: DashboardShellProps) {
  return (
    <AppNavLayout activeTab={activeTab} onSelectMainTab={onSelectMainTab}>
      {children}
    </AppNavLayout>
  );
}
