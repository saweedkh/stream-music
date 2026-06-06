"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AppNavLayout } from "@/shared/layout/app-nav-layout";
import type { DashboardTab } from "@/features/dashboard";

export function AppGlobalNavShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  function handleSelectMainTab(tab: DashboardTab) {
    const params = new URLSearchParams();
    params.set("tab", tab);
    const qs = params.toString();
    router.push(qs.length ? `/dashboard?${qs}` : "/dashboard");
  }

  return (
    <AppNavLayout activeTab="channels" onSelectMainTab={handleSelectMainTab}>
      {children}
    </AppNavLayout>
  );
}
