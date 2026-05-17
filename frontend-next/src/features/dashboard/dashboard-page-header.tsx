"use client";

import { useTranslations } from "@/components/providers/locale-provider";
import { DASHBOARD_TAB_META } from "@/features/dashboard/dashboard-nav-meta";
import type { DashboardTab } from "@/features/dashboard/dashboard-types";

type DashboardPageHeaderProps = {
  activeTab: DashboardTab;
};

export function DashboardPageHeader({ activeTab }: DashboardPageHeaderProps) {
  const { t } = useTranslations();
  const meta = DASHBOARD_TAB_META[activeTab];

  return (
    <header className="mb-7">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[1.65rem]">
        {t(meta.titleKey)}
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{t(meta.descriptionKey)}</p>
    </header>
  );
}
