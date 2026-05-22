"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Compass, ListMusic, Loader2, Radio, TrendingUp } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/toast-provider";
import { getExploreFeed, type ExploreFeed } from "@/lib/api";
import { hubPanelRoot } from "@/lib/mobile-page-layout";
import { cn } from "@/lib/utils";

export function ExplorePage() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [feed, setFeed] = useState<ExploreFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [lang, setLang] = useState("");
  const [genre, setGenre] = useState("");
  const [liveOnly, setLiveOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFeed(
        await getExploreFeed({
          q: q.trim() || undefined,
          lang: lang.trim() || undefined,
          genre: genre.trim() || undefined,
          live_only: liveOnly,
        }),
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("explore.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [genre, lang, liveOnly, q, showToast, t]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  if (loading && !feed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!feed) return null;

  return (
    <div className={cn(hubPanelRoot, "lg:min-h-0 lg:flex-1 lg:overflow-hidden")}>
      <ScrollArea className="w-full max-lg:overflow-visible lg:h-full lg:flex-1">
        <div className="mx-auto max-w-4xl space-y-8 px-1 py-4 sm:px-0">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Compass className="h-7 w-7 text-brand" />
          {t("explore.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("explore.subtitle")}</p>
      </header>

      <Card className="border-border/90 bg-card/60">
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[12rem] flex-1">
            <label className="text-xs font-medium text-muted-foreground">{t("explore.filterSearch")}</label>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("explore.filterSearchPlaceholder")} />
          </div>
          <div className="w-full sm:w-36">
            <label className="text-xs font-medium text-muted-foreground">{t("explore.filterLang")}</label>
            <Input value={lang} onChange={(e) => setLang(e.target.value)} placeholder="en" />
          </div>
          <div className="w-full sm:w-36">
            <label className="text-xs font-medium text-muted-foreground">{t("explore.filterGenre")}</label>
            <Input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="electronic" />
          </div>
          <Button
            type="button"
            variant={liveOnly ? "default" : "secondary"}
            className="shrink-0"
            onClick={() => setLiveOnly((v) => !v)}
          >
            {t("explore.filterLiveOnly")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4 text-brand" />
            {t("explore.liveChannels")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          ) : feed.live_channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("explore.noLive")}</p>
          ) : (
            <ul className="space-y-2">
              {feed.live_channels.map((ch) => (
                <li key={ch.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2">
                  <span className="truncate font-medium">{ch.name}</span>
                  <Button size="sm" asChild>
                    <Link href={`/join/public/${ch.public_join_slug ?? ch.public_slug}`}>{t("explore.join")}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {!liveOnly ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-brand" />
                {t("explore.popularWeek")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {feed.popular_channels.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("explore.noPopular")}</p>
              ) : (
                <ul className="space-y-2">
                  {feed.popular_channels.map((row) => (
                    <li
                      key={row.channel.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2"
                    >
                      <span className="truncate font-medium">{row.channel.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {t("explore.eventCount", { count: row.event_count })}
                        </Badge>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/party/${row.channel.id}`}>{t("explore.recap")}</Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListMusic className="h-4 w-4 text-brand" />
                {t("explore.sharedPlaylists")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {feed.shared_playlists.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("explore.noShared")}</p>
              ) : (
                <ul className="space-y-2">
                  {feed.shared_playlists.map((sp) => (
                    <li
                      key={sp.token}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{sp.playlist.name}</p>
                        <p className="text-xs text-muted-foreground">
                          @{sp.owner_username} · {t("explore.trackCount", { count: sp.item_count })}
                        </p>
                      </div>
                      <Button size="sm" asChild>
                        <Link href={sp.share_url}>{t("explore.openPlaylist")}</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
