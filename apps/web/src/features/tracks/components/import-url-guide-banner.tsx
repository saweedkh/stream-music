"use client";

import { Info } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { cn } from "@/lib/utils";

type ImportUrlGuideBannerProps = {
  className?: string;
  compact?: boolean;
};

export function ImportUrlGuideBanner({ className, compact }: ImportUrlGuideBannerProps) {
  const { t } = useTranslations();

  return (
    <div
      className={cn(
        "rounded-xl border border-sky-500/25 bg-sky-500/[0.06] text-sky-950 dark:text-sky-100",
        compact ? "px-3 py-2.5" : "px-4 py-3",
        className,
      )}
      role="note"
    >
      <div className="flex gap-2.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
        <div className="min-w-0 space-y-1.5 text-xs leading-relaxed">
          <p className="font-medium text-foreground">{t("upload.studio.urlImportGuideTitle")}</p>
          <p className="text-muted-foreground">{t("upload.studio.urlImportGuidePlatforms")}</p>
          <p className="text-muted-foreground">{t("upload.studio.urlImportGuideProxy")}</p>
        </div>
      </div>
    </div>
  );
}
