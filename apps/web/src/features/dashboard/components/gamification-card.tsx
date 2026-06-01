"use client";

import { useCallback, useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { getMyGamification, type GamificationProfile } from "@/lib/api/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Loader2 } from "lucide-react";

export function GamificationCard() {
  const { t } = useTranslations();
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setProfile(await getMyGamification());
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxPts = Math.max(1, ...(profile?.points_chart_30d.map((d) => d.points) ?? [1]));

  return (
    <Card className="border-border/90" data-testid="gamification-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-brand" />
          {t("gamification.cardTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : profile ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("gamification.summary", {
                level: profile.level,
                points: profile.points,
                streak: profile.streak_days,
              })}
            </p>
            <div className="flex h-16 items-end gap-0.5">
              {profile.points_chart_30d.map((d) => (
                <div
                  key={d.date}
                  className="min-w-[4px] flex-1 rounded-t bg-brand/70"
                  style={{ height: `${Math.max(8, (d.points / maxPts) * 100)}%` }}
                  title={`${d.date}: ${d.points}`}
                />
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
