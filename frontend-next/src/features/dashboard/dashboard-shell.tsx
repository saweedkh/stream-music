"use client";

import type { ReactNode } from "react";
import { AppNavLayout } from "@/components/layout/app-nav-layout";
import type { DashboardTab } from "@/features/dashboard/dashboard-types";

type DashboardShellProps = {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  children: ReactNode;
};

export function DashboardShell({ activeTab, onSelectTab, children }: DashboardShellProps) {
  return (
    <AppNavLayout activeTab={activeTab} onSelectTab={onSelectTab}>
      {children}
    </AppNavLayout>
  );
}
