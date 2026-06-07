"use client";

import Link from "next/link";
import { SupportStaffHub } from "@/features/support";
import { useTranslations } from "@/shared/providers/locale-provider";

export function AdminSupportSection() {
  const { t } = useTranslations();

  return (
    <div className="flex min-h-[480px] flex-col gap-3 lg:min-h-[560px] lg:h-[calc(100dvh-12rem)]">
      <p className="text-sm text-muted-foreground">{t("admin.supportDescription")}</p>
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/60 bg-card/40">
        <SupportStaffHub />
      </div>
      <p className="text-xs text-muted-foreground">
        {t("admin.supportHint")}{" "}
        <Link href="/explore" className="font-medium text-brand hover:underline">
          {t("explore.title")}
        </Link>
      </p>
    </div>
  );
}
