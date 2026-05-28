"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { AppNavLayout } from "@/shared/layout/app-nav-layout";
import type { AdminSection, ProfileSection } from "@/features/dashboard/model/dashboard-nav-config";
import type { DashboardTab } from "@/features/dashboard/model/dashboard-types";

export function AppGlobalNavShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  function goToDashboard(params: URLSearchParams) {
    const qs = params.toString();
    router.push(qs.length ? `/dashboard?${qs}` : "/dashboard");
  }

  function handleSelectMainTab(tab: Exclude<DashboardTab, "settings" | "admin">) {
    const params = new URLSearchParams();
    params.set("tab", tab);
    goToDashboard(params);
  }

  function handleSelectProfileSection(section: ProfileSection) {
    const params = new URLSearchParams();
    params.set("tab", "settings");
    if (section !== "overview") params.set("section", section);
    goToDashboard(params);
  }

  function handleSelectAdminSection(section: AdminSection) {
    const params = new URLSearchParams();
    params.set("tab", "admin");
    if (section !== "overview") params.set("adminSection", section);
    goToDashboard(params);
  }

  return (
    <AppNavLayout
      activeTab="channels"
      activeProfileSection="overview"
      activeAdminSection="overview"
      onSelectMainTab={handleSelectMainTab}
      onSelectProfileSection={handleSelectProfileSection}
      onSelectAdminSection={handleSelectAdminSection}
    >
      {children}
    </AppNavLayout>
  );
}
