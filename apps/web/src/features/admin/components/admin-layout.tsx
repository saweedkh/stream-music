"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { AdminSidebar } from "@/features/admin/components/admin-sidebar";
import type { AdminSection } from "@/features/admin/model/admin-nav";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { getMe, type AuthUser } from "@/lib/api";
import { shellBody, shellContent, shellFrame, shellMain } from "@/lib/mobile-page-layout";
import { cn } from "@/lib/utils";

type AdminLayoutProps = {
  activeSection: AdminSection;
  children: ReactNode;
};

export function AdminLayout({ activeSection, children }: AdminLayoutProps) {
  const { t, dir } = useTranslations();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    void getMe()
      .then((res) => setUser(res?.user ?? null))
      .catch(() => setUser(null));
  }, []);

  const sidebar = (
    <AdminSidebar
      activeSection={activeSection}
      user={user}
      onNavigate={() => setMobileNavOpen(false)}
      className="h-full w-full border-0 bg-transparent"
    />
  );

  return (
    <div className={cn(shellFrame, "min-h-dvh bg-background")}>
      <div className="hidden h-full min-h-0 lg:flex lg:shrink-0">{sidebar}</div>

      <div className={shellMain}>
        <header className="flex items-center gap-3 border-b border-border/60 px-4 py-3 lg:hidden">
          <Button type="button" size="icon" variant="outline" onClick={() => setMobileNavOpen(true)} aria-label={t("admin.navAria")}>
            <Menu className="h-5 w-5" />
          </Button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">{t("admin.panelEyebrow")}</p>
            <p className="font-display text-sm font-semibold">{t("admin.panelTitle")}</p>
          </div>
        </header>

        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side={dir === "rtl" ? "right" : "left"} className="w-[min(100vw-1.5rem,19rem)] gap-0 p-0">
            <SheetTitle className="sr-only">{t("admin.panelTitle")}</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>

        <div className={shellBody}>
          <div className={cn(shellContent, "gap-4 px-3 py-4 lg:px-6 lg:py-6")}>{children}</div>
        </div>
      </div>
    </div>
  );
}
