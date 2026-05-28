"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { getPremiumLimits, type PremiumLimits } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ChannelsPremiumNotice() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [limits, setLimits] = useState<PremiumLimits | null>(null);

  const load = useCallback(async () => {
    try {
      setLimits(await getPremiumLimits());
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("premium.loadFailed"), "error");
    }
  }, [showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!limits) return null;

  const limitText = t("premium.limits", {
    owned: limits.owned_channels,
    max: limits.max_owned_channels,
    members: limits.max_member_limit,
  });

  return (
    <div className="workspace-premium-strip" data-testid="dashboard-premium-limits">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md",
          limits.is_premium
            ? "bg-gradient-to-br from-amber-400/90 to-amber-600/90 text-white shadow-sm shadow-amber-500/30"
            : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        )}
      >
        <Crown className="size-3.5" aria-hidden />
      </span>
      <p className="min-w-0 flex-1 truncate text-foreground/90">{limitText}</p>
      {limits.is_premium ? (
        <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          {t("badge.premium")}
        </span>
      ) : null}
    </div>
  );
}
