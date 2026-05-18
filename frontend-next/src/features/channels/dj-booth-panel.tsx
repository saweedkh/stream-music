"use client";

import { Headphones, ListMusic, SkipForward } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "@/components/providers/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  channelId: string;
  nowPlayingTitle?: string | null;
};

export function DjBoothPanel({ channelId, nowPlayingTitle }: Props) {
  const { t } = useTranslations();

  return (
    <div className="space-y-4">
      <Card className="border-brand/40 bg-gradient-to-br from-background via-[var(--brand-subtle)] to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Headphones className="size-5 text-brand" />
            {t("dj.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("dj.hint")}</p>
          {nowPlayingTitle ? (
            <p className="truncate text-base font-medium text-foreground">{nowPlayingTitle}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("dj.nothingPlaying")}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" className="gap-1.5" asChild>
              <Link href={`/channel/${channelId}?tab=player`}>
                <SkipForward className="size-4" />
                {t("dj.openPlaylist")}
              </Link>
            </Button>
            <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" asChild>
              <Link href={`/channel/${channelId}?tab=queue`}>
                <ListMusic className="size-4" />
                {t("dj.openQueue")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      <div id="channel-queue-panel" />
    </div>
  );
}
