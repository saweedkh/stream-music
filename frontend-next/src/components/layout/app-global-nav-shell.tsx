"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AppNavLayout } from "@/components/layout/app-nav-layout";
import type { DashboardTab } from "@/features/dashboard/dashboard-types";

export function AppGlobalNavShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  function handleSelectTab(tab: DashboardTab) {
    router.push(`/dashboard?tab=${tab}`);
  }

  return (
    <AppNavLayout activeTab="channels" onSelectTab={handleSelectTab}>
      {children}
    </AppNavLayout>
  );
}
