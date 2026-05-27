"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Radio, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { WorkspaceChip, WorkspaceChipGroup, WorkspaceEmpty, WorkspaceList, WorkspacePage, WorkspaceRail, WorkspaceRailCard, WorkspaceSplit } from "@/components/layout/workspace";
import { ChannelCard } from "@/features/dashboard/channels/channel-card";
import { ChannelRow } from "@/features/dashboard/channels/channel-row";
import { ChannelViewToggle, type ChannelViewMode } from "@/features/dashboard/channels/channel-view-toggle";
import { CreateChannelForm } from "@/features/dashboard/channels/create-channel-form";
import { ChannelsPremiumNotice } from "@/features/dashboard/channels/channels-premium-notice";
import { useTranslations } from "@/components/providers/locale-provider";
import { getMeChannelsPendingSuggestions, type ChannelSummary } from "@/lib/api";
import {
  filterChannelsBySearch,
  filterDashboardChannels,
  sortChannelsForDashboard,
} from "@/lib/channel-filters";

type Props = {
  channels: ChannelSummary[];
  channelName: string;
  channelPrivacy: ChannelSummary["privacy"];
  memberLimit: string;
  errors: { channelName?: string; memberLimit?: string };
  onChannelNameChange: (value: string) => void;
  onChannelPrivacyChange: (value: ChannelSummary["privacy"]) => void;
  onMemberLimitChange: (value: string) => void;
  onCreateChannel: () => void;
  currentUserId: number | null;
  onChannelsRefresh: () => void | Promise<void>;
};

type ChannelFilter = "all" | "live" | "closed";

const CHANNEL_VIEW_STORAGE_KEY = "dashboard-channels-view";

function filterLabel(base: string, count: number) {
  return count > 0 ? `${base} (${count})` : base;
}

export function ChannelManagementSection(props: Props) {
  const { t } = useTranslations();
  const {
    channels,
    channelName,
    channelPrivacy,
    memberLimit,
    errors,
    onChannelNameChange,
    onChannelPrivacyChange,
    onMemberLimitChange,
    onCreateChannel,
    currentUserId,
    onChannelsRefresh,
  } = props;

  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [channelSearch, setChannelSearch] = useState("");
  const [filter, setFilter] = useState<ChannelFilter>("all");
  const [viewMode, setViewMode] = useState<ChannelViewMode>("list");
  const [pendingByChannel, setPendingByChannel] = useState<Record<number, number>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHANNEL_VIEW_STORAGE_KEY);
      if (saved === "list" || saved === "grid") setViewMode(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const handleViewModeChange = useCallback((mode: ChannelViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(CHANNEL_VIEW_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const data = await getMeChannelsPendingSuggestions();
      const map: Record<number, number> = {};
      for (const row of data.results) {
        map[row.channel_id] = row.pending_count;
      }
      setPendingByChannel(map);
    } catch {
      setPendingByChannel({});
    }
  }, []);

  useEffect(() => {
    void loadPending();
    const id = setInterval(() => void loadPending(), 30_000);
    return () => clearInterval(id);
  }, [loadPending, channels.length]);

  const baseChannels = useMemo(
    () => sortChannelsForDashboard(filterChannelsBySearch(filterDashboardChannels(channels), channelSearch)),
    [channels, channelSearch],
  );

  const visibleChannels = useMemo(() => {
    if (filter === "live") {
      return baseChannels.filter((c) => c.is_active !== false && c.is_playing === true);
    }
    if (filter === "closed") {
      return baseChannels.filter((c) => c.is_active === false);
    }
    return baseChannels;
  }, [baseChannels, filter]);

  const liveCount = useMemo(
    () => baseChannels.filter((c) => c.is_active !== false && c.is_playing === true).length,
    [baseChannels],
  );

  const closedCount = useMemo(() => baseChannels.filter((c) => c.is_active === false).length, [baseChannels]);

  const createForm = (
    <CreateChannelForm
      channelName={channelName}
      channelPrivacy={channelPrivacy}
      memberLimit={memberLimit}
      errors={errors}
      onChannelNameChange={onChannelNameChange}
      onChannelPrivacyChange={onChannelPrivacyChange}
      onMemberLimitChange={onMemberLimitChange}
      onCreateChannel={() => {
        onCreateChannel();
        setCreateSheetOpen(false);
      }}
      idPrefix="dash"
    />
  );

  return (
    <WorkspacePage className="gap-4">
      <ChannelsPremiumNotice />

      <WorkspaceSplit
        main={
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                className="h-10 bg-transparent ps-9 pe-9"
                placeholder={t("channels.searchPlaceholder")}
                value={channelSearch}
                onChange={(e) => setChannelSearch(e.target.value)}
                aria-label={t("channels.searchPlaceholder")}
              />
              {channelSearch ? (
                <button
                  type="button"
                  className="absolute end-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  onClick={() => setChannelSearch("")}
                  aria-label={t("channels.clearSearch")}
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <WorkspaceChipGroup className="min-w-0 flex-1">
                <WorkspaceChip selected={filter === "all"} onClick={() => setFilter("all")}>
                  {filterLabel(t("channels.filterAll"), baseChannels.length)}
                </WorkspaceChip>
                <WorkspaceChip selected={filter === "live"} onClick={() => setFilter("live")}>
                  {filterLabel(t("channels.filterLive"), liveCount)}
                </WorkspaceChip>
                <WorkspaceChip selected={filter === "closed"} onClick={() => setFilter("closed")}>
                  {filterLabel(t("channels.filterClosed"), closedCount)}
                </WorkspaceChip>
              </WorkspaceChipGroup>
              <ChannelViewToggle mode={viewMode} onModeChange={handleViewModeChange} />
            </div>

            {visibleChannels.length === 0 ? (
              <WorkspaceEmpty icon={Radio}>
                <p>{t("channels.empty")}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3 xl:hidden"
                  onClick={() => setCreateSheetOpen(true)}
                >
                  <Plus className="size-4" aria-hidden />
                  {t("channels.newChannel")}
                </Button>
              </WorkspaceEmpty>
            ) : viewMode === "grid" ? (
              <ul className="workspace-channel-grid">
                {visibleChannels.map((channel) => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    currentUserId={currentUserId}
                    pendingSuggestions={pendingByChannel[channel.id] ?? 0}
                    onChannelsRefresh={onChannelsRefresh}
                  />
                ))}
              </ul>
            ) : (
              <WorkspaceList>
                {visibleChannels.map((channel) => (
                  <ChannelRow
                    key={channel.id}
                    channel={channel}
                    currentUserId={currentUserId}
                    pendingSuggestions={pendingByChannel[channel.id] ?? 0}
                    onChannelsRefresh={onChannelsRefresh}
                  />
                ))}
              </WorkspaceList>
            )}
          </div>
        }
        aside={
          <WorkspaceRail className="hidden xl:block xl:w-[18rem] 2xl:w-[19rem]">
            <div className="workspace-rail sticky top-0 overflow-hidden">
              <div className="border-b border-[var(--workspace-divider)] px-4 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
                    <Plus className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-sm font-semibold leading-tight">{t("channels.newChannel")}</h3>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{t("channels.createSubtitle")}</p>
                  </div>
                </div>
              </div>
              <div className="px-4 py-4">
                <CreateChannelForm
                  channelName={channelName}
                  channelPrivacy={channelPrivacy}
                  memberLimit={memberLimit}
                  errors={errors}
                  onChannelNameChange={onChannelNameChange}
                  onChannelPrivacyChange={onChannelPrivacyChange}
                  onMemberLimitChange={onMemberLimitChange}
                  onCreateChannel={() => {
                    onCreateChannel();
                    setCreateSheetOpen(false);
                  }}
                  idPrefix="dash-rail"
                  layout="rail"
                />
              </div>
            </div>
          </WorkspaceRail>
        }
      />

      <div className="fixed bottom-[calc(var(--player-mini-inset,0px)+1rem+env(safe-area-inset-bottom))] end-4 z-30 xl:hidden">
        <Button
          type="button"
          size="icon"
          className="size-12 rounded-full bg-brand text-brand-foreground shadow-lg shadow-brand/25 hover:bg-brand-strong"
          onClick={() => setCreateSheetOpen(true)}
          aria-label={t("channels.newChannel")}
        >
          <Plus className="size-5" aria-hidden />
        </Button>
      </div>

      <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
        <SheetContent side="bottom" className="gap-0 p-0">
          <SheetTitle className="sr-only">{t("channels.newChannel")}</SheetTitle>
          <WorkspaceRailCard icon={Plus} title={t("channels.newChannel")} description={t("channels.createSubtitle")} className="border-0 shadow-none">
            {createForm}
          </WorkspaceRailCard>
        </SheetContent>
      </Sheet>
    </WorkspacePage>
  );
}
