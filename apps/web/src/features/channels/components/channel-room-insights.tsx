"use client";

import { Download, ExternalLink, History, Lightbulb, ListMusic, Loader2, PartyPopper, RefreshCw, Shield, ThumbsUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Button } from "@/shared/ui/button";
import { ChannelBlindGuessPanel } from "@/features/channels/components/channel-blind-guess-panel";
import { ChannelStatisticsPanel } from "@/features/channels/components/channel-statistics-panel";
import type { ChannelExperience } from "@/features/experience";
import { ChannelAdminInlineShell } from "@/features/channels/components/channel-admin-inline-shell";
import { adminSegmentBtn, adminSectionLabel } from "@/features/channels/components/channel-admin-panel-styles";
import { listenerFieldClass } from "@/features/channels/components/channel-listener-panel-styles";
import { Input } from "@/shared/ui/input";
import { useToast } from "@/shared/ui/toast-provider";
import {
  addTrackReaction,
  getAuditLogExportUrl,
  listChannelAuditLog,
  exportChannelSessionPlaylist,
  listChannelSuggestions,
  listPlaybackHistory,
  listTrackReactions,
  type ChannelAuditLogRow,
  type ChannelTrackReactionRow,
  type ChannelPlaylistSuggestion,
  type PlaybackHistoryRow,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  channelId: string;
  canManage: boolean;
  currentTrackId?: number | null;
  experience?: ChannelExperience | null;
  embedded?: boolean;
};

type InsightTab = "recap" | "history" | "reactions" | "suggestions" | "audit";

export function ChannelRoomInsights({ channelId, canManage, currentTrackId, experience, embedded = true }: Props) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [history, setHistory] = useState<PlaybackHistoryRow[]>([]);
  const [audit, setAudit] = useState<ChannelAuditLogRow[]>([]);
  const [reactions, setReactions] = useState<ChannelTrackReactionRow[]>([]);
  const [reactionEmoji, setReactionEmoji] = useState("🔥");
  const [loading, setLoading] = useState(true);
  const [insightTab, setInsightTab] = useState<InsightTab>("recap");
  const [suggestions, setSuggestions] = useState<ChannelPlaylistSuggestion[]>([]);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, a, sug] = await Promise.all([
        listPlaybackHistory(channelId),
        canManage ? listChannelAuditLog(channelId) : Promise.resolve({ results: [] }),
        listChannelSuggestions(channelId).catch(() => ({ results: [] })),
      ]);
      setHistory(h.results);
      setAudit(a.results);
      setSuggestions(sug.results.filter((s) => s.status === "approved" || s.status === "pending").slice(0, 40));
      if (currentTrackId) {
        const r = await listTrackReactions(channelId, currentTrackId);
        setReactions(r.results);
      } else {
        setReactions([]);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not load insights.", "error");
    } finally {
      setLoading(false);
    }
  }, [channelId, canManage, currentTrackId, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function postReaction() {
    if (!currentTrackId) {
      showToast("Nothing is playing right now.", "info");
      return;
    }
    try {
      await addTrackReaction(channelId, { track_id: currentTrackId, emoji: reactionEmoji });
      showToast("Reaction saved.", "success");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Reaction failed.", "error");
    }
  }

  const recapTop = useMemo(() => {
    const counts = new Map<string, { title: string; count: number }>();
    for (const row of history) {
      const key = row.track_title ?? `track-${row.track ?? row.id}`;
      const prev = counts.get(key);
      counts.set(key, { title: row.track_title ?? key, count: (prev?.count ?? 0) + 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  }, [history]);

  const tabs: { id: InsightTab; labelKey: Parameters<typeof t>[0] }[] = [
    { id: "recap", labelKey: "room.admin.insights.tab.recap" },
    { id: "history", labelKey: "room.admin.insights.tab.history" },
    { id: "reactions", labelKey: "room.admin.insights.tab.reactions" },
    { id: "suggestions", labelKey: "room.admin.insights.suggestions" },
    ...(canManage ? [{ id: "audit" as const, labelKey: "room.admin.insights.tab.audit" as const }] : []),
  ];

  const toolbar = embedded ? (
    <div className="flex gap-1 rounded-xl bg-muted/25 p-1">
      {tabs.map((tab) => (
        <button key={tab.id} type="button" className={adminSegmentBtn(insightTab === tab.id)} onClick={() => setInsightTab(tab.id)}>
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  ) : null;

  const blindMode = Boolean(experience?.blind_playlist_id);

  const recapSection = (
    <section className="space-y-4 px-1">
      {blindMode ? (
        <ChannelBlindGuessPanel channelId={channelId} currentTrackId={currentTrackId} canReveal={canManage} />
      ) : null}
      <ChannelStatisticsPanel channelId={channelId} canViewDetailed={canManage} />
      {recapTop.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("room.admin.insights.recapEmpty")}</p>
      ) : (
        <ol className="space-y-0.5">
          {recapTop.map((row, i) => (
            <li key={row.title} className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-muted/30">
              <span className="truncate text-sm text-foreground">
                {i + 1}. {row.title}
              </span>
              <span className="shrink-0 text-sm font-medium text-brand">×{row.count}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="default" asChild>
          <Link href={`/party/${channelId}`}>
            <PartyPopper className="mr-1 h-4 w-4" />
            {t("room.admin.insights.partyRecap")}
          </Link>
        </Button>
        {canManage ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={exporting}
            onClick={() => {
              setExporting(true);
              void exportChannelSessionPlaylist(channelId)
                .then(() => showToast(t("room.admin.insights.exportSession"), "success"))
                .catch((e) => showToast(e instanceof Error ? e.message : "Export failed", "error"))
                .finally(() => setExporting(false));
            }}
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListMusic className="mr-1 h-4 w-4" />}
            {t("room.admin.insights.exportSession")}
          </Button>
        ) : null}
      </div>
    </section>
  );

  const historySection = (
    <section className="px-1">
      {history.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("room.admin.insights.historyEmpty")}</p>
      ) : (
        <ul className="space-y-0.5 font-mono text-xs">
          {history.map((row) => (
            <li key={row.id} className="rounded-lg px-2 py-2 text-muted-foreground hover:bg-muted/30">
              {row.emitted_at?.slice(11, 19)} · {row.event_type}
              {row.track_title ? ` · ${row.track_title}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const reactionsSection = (
    <section className="space-y-3 px-1">
      <div className="flex flex-wrap gap-2">
        <Input
          value={reactionEmoji}
          onChange={(e) => setReactionEmoji(e.target.value)}
          maxLength={8}
          className={cn("w-20", listenerFieldClass)}
          valid
        />
        <Button type="button" size="sm" className="h-9" onClick={() => void postReaction()} disabled={!currentTrackId}>
          {t("room.admin.insights.reactNow")}
        </Button>
      </div>
      {reactions.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("room.admin.insights.reactionsEmpty")}</p>
      ) : (
        <ul className="space-y-0.5">
          {reactions.map((r) => (
            <li key={r.id} className="rounded-lg px-2 py-2 text-sm hover:bg-muted/30">
              {r.emoji} @{r.username}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const suggestionsSection = (
    <section className="px-1">
      {suggestions.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("room.admin.insights.recapEmpty")}</p>
      ) : (
        <ul className="space-y-2">
          {suggestions.map((s) => (
            <li key={s.id} className="rounded-lg border border-border/50 px-3 py-2 text-sm">
              <p className="font-medium">
                {s.track_title ?? s.external_title ?? "—"}
                {s.external_artist ? ` · ${s.external_artist}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                @{s.username ?? "?"} · {s.status}
              </p>
              {s.external_url ? (
                <a href={s.external_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-brand hover:underline">
                  <ExternalLink className="h-3 w-3" />
                  {s.external_url}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const auditSection = (
    <section className="px-1">
      <div className="mb-3 flex justify-end">
        <a href={getAuditLogExportUrl(channelId)} download>
          <Button type="button" size="sm" variant="secondary" className="h-9 gap-2">
            <Download className="size-4" />
            {t("room.admin.insights.exportCsv")}
          </Button>
        </a>
      </div>
      {audit.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("room.admin.insights.auditEmpty")}</p>
      ) : (
        <ul className="space-y-0.5 font-mono text-xs">
          {audit.map((row) => (
            <li key={row.id} className="rounded-lg px-2 py-2 text-muted-foreground hover:bg-muted/30">
              {row.created_at?.slice(0, 19)} · {row.action} · {row.actor_username ?? "?"}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  const tabContent = loading ? (
    <div className="space-y-1.5 px-2 py-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-lg bg-muted/40" />
      ))}
    </div>
  ) : insightTab === "recap" ? (
    recapSection
  ) : insightTab === "history" ? (
    historySection
  ) : insightTab === "reactions" ? (
    reactionsSection
  ) : insightTab === "suggestions" ? (
    suggestionsSection
  ) : (
    auditSection
  );

  if (!embedded) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {recapSection}
        {historySection}
        {reactionsSection}
        {canManage ? auditSection : null}
      </div>
    );
  }

  return (
    <ChannelAdminInlineShell
      icon={Lightbulb}
      title={t("room.admin.tab.insights.title")}
      subtitle={t("room.admin.tab.insights.description")}
      toolbar={toolbar}
      actions={
        <Button type="button" variant="secondary" size="sm" className="h-9 gap-2" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {t("room.admin.insights.refresh")}
        </Button>
      }
    >
      {tabContent}
    </ChannelAdminInlineShell>
  );
}
