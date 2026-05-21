"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown, Loader2 } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-provider";
import { getPremiumLimits, type PremiumLimits } from "@/lib/api";

export function PremiumLimitsCard() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [limits, setLimits] = useState<PremiumLimits | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLimits(await getPremiumLimits());
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("premium.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card className="border-border/90 bg-card/60" data-testid="dashboard-premium-limits">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Crown className="h-4 w-4 text-brand" />
          {t("premium.cardTitle")}
        </CardTitle>
        {limits?.is_premium ? (
          <Badge variant="success" className="text-[10px]">
            {t("badge.premium")}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : limits ? (
          <p className="text-sm text-muted-foreground">
            {t("premium.limits", {
              owned: limits.owned_channels,
              max: limits.max_owned_channels,
              members: limits.max_member_limit,
            })}
            {limits.premium_queue_boost ? (
              <span className="mt-2 block text-xs text-brand/90">{t("room.queue.premiumBoost")}</span>
            ) : null}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
