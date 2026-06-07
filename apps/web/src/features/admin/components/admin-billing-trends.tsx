"use client";

import type { AdminBillingTrendPoint } from "@/lib/api/types/admin";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { cn } from "@/lib/utils";

function TrendBars({
  title,
  points,
  valueKey,
  formatValue,
  accentClass,
}: {
  title: string;
  points: AdminBillingTrendPoint[];
  valueKey: "count" | "revenue_cents";
  formatValue?: (value: number) => string;
  accentClass: string;
}) {
  const max = Math.max(1, ...points.map((p) => p[valueKey] ?? 0));

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-28 items-end gap-0.5">
          {points.map((point) => {
            const value = point[valueKey] ?? 0;
            const height = Math.max(value > 0 ? 8 : 2, Math.round((value / max) * 100));
            const label = formatValue ? formatValue(value) : String(value);
            return (
              <div key={point.date} className="group relative min-w-0 flex-1">
                <div
                  className={cn("mx-auto w-full max-w-[10px] rounded-t bg-current transition-opacity group-hover:opacity-100", accentClass)}
                  style={{ height: `${height}%` }}
                  title={`${point.date}: ${label}`}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>{points[0]?.date.slice(5)}</span>
          <span>{points[points.length - 1]?.date.slice(5)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminBillingTrends({
  stripePurchases,
  referralSignups,
}: {
  stripePurchases: AdminBillingTrendPoint[];
  referralSignups: AdminBillingTrendPoint[];
}) {
  const { t } = useTranslations();

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <TrendBars
        title={t("admin.billing.trendStripe")}
        points={stripePurchases}
        valueKey="count"
        accentClass="text-brand"
      />
      <TrendBars
        title={t("admin.billing.trendReferrals")}
        points={referralSignups}
        valueKey="count"
        accentClass="text-violet-500"
      />
    </div>
  );
}
