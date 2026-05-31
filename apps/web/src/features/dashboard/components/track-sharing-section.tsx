"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Globe,
  Lock,
  Music2,
  Radio,
  Search,
  Share2,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  fromBackendVisibility,
  TRACK_ACCESS_LABEL_KEYS,
  type TrackAccess,
} from "@/features/tracks/model/track-access";
import {
  WorkspaceEmpty,
  WorkspaceList,
  WorkspacePage,
  WorkspaceRail,
  WorkspaceRailCard,
} from "@/shared/layout/workspace";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { TrackArtwork } from "@/shared/ui/track-artwork";
import type { ChannelSummary, TrackSharePermission, TrackSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Scroll works but scrollbar stays hidden. */
const scrollHide =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

type Props = {
  tracks: TrackSummary[];
  users: Array<{ id: number; username: string }>;
  channels: ChannelSummary[];
  trackShares: TrackSharePermission[];
  shareTrackId: string;
  shareUserId: string;
  shareChannelId: string;
  onShareTrackIdChange: (value: string) => void;
  onShareUserIdChange: (value: string) => void;
  onShareChannelIdChange: (value: string) => void;
  onAddShare: () => void;
  onRemoveShare: (shareId: number) => void;
};

type ShareTarget = "user" | "channel";

function AccessBadge({ access }: { access: TrackAccess }) {
  const { t } = useTranslations();
  const isPublic = access === "public";
  const Icon = isPublic ? Globe : Lock;
  return (
    <Badge variant={isPublic ? "success" : "secondary"} className="gap-1 px-1.5 py-0 text-[10px] font-normal">
      <Icon className="size-2.5" aria-hidden />
      {t(TRACK_ACCESS_LABEL_KEYS[access])}
    </Badge>
  );
}

function TrackSidebarItem({
  track,
  selected,
  onSelect,
}: {
  track: TrackSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslations();
  const meta = [track.artist, track.album].filter(Boolean).join(" · ");

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start transition-colors sm:px-2.5",
          selected ? "bg-brand/[0.08] text-foreground" : "hover:bg-muted/30",
        )}
      >
        <TrackArtwork title={track.title} className="size-9 text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{track.title}</p>
          {meta ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{meta}</p> : null}
        </div>
      </button>
    </li>
  );
}

export type TrackShareSidebarProps = {
  tracks: TrackSummary[];
  filteredTracks: TrackSummary[];
  search: string;
  shareTrackId: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
};

export function TrackShareSidebar({
  tracks,
  filteredTracks,
  search,
  shareTrackId,
  onSearchChange,
  onSelect,
}: TrackShareSidebarProps) {
  const { t } = useTranslations();

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          className="h-9 bg-transparent ps-9 pe-9"
          placeholder={t("sharing.searchTracks")}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label={t("sharing.searchTracks")}
        />
        {search ? (
          <button
            type="button"
            className="absolute end-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            onClick={() => onSearchChange("")}
            aria-label={t("channels.clearSearch")}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      {tracks.length === 0 ? (
        <WorkspaceEmpty icon={Music2} title={t("sharing.noTracks")}>
          {t("sharing.noTracksHint")}
        </WorkspaceEmpty>
      ) : filteredTracks.length === 0 ? (
        <WorkspaceEmpty icon={Search} title={t("sharing.noSearchResults")} />
      ) : (
        <WorkspaceList>
          {filteredTracks.map((track) => (
            <TrackSidebarItem
              key={track.id}
              track={track}
              selected={String(track.id) === shareTrackId}
              onSelect={() => onSelect(String(track.id))}
            />
          ))}
        </WorkspaceList>
      )}
    </div>
  );
}

function GrantAccessBar({
  shareTrackId,
  shareUserId,
  shareChannelId,
  users,
  channels,
  onShareUserIdChange,
  onShareChannelIdChange,
  onAddShare,
}: {
  shareTrackId: string;
  shareUserId: string;
  shareChannelId: string;
  users: Array<{ id: number; username: string }>;
  channels: ChannelSummary[];
  onShareUserIdChange: (value: string) => void;
  onShareChannelIdChange: (value: string) => void;
  onAddShare: () => void;
}) {
  const { t } = useTranslations();
  const [target, setTarget] = useState<ShareTarget>(shareUserId ? "user" : "channel");

  const canAdd =
    Boolean(shareTrackId) &&
    (target === "user" ? Boolean(shareUserId) : Boolean(shareChannelId));

  function switchTarget(next: ShareTarget) {
    setTarget(next);
    if (next === "user") onShareChannelIdChange("");
    else onShareUserIdChange("");
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-[var(--workspace-divider)] bg-[var(--workspace-list)] p-3">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("sharing.addPermissionTitle")}>
        {(
          [
            { value: "user" as const, icon: User, label: t("sharing.targetUser") },
            { value: "channel" as const, icon: Radio, label: t("sharing.targetChannel") },
          ] as const
        ).map(({ value, icon: Icon, label }) => {
          const selected = target === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={selected}
              className={cn(
                "flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-[11px] font-medium transition-all sm:text-xs",
                selected
                  ? "bg-brand/15 text-brand shadow-sm ring-2 ring-brand/40"
                  : "bg-[var(--workspace-stat)] text-muted-foreground hover:bg-muted/45 hover:text-foreground",
              )}
              onClick={() => switchTarget(value)}
            >
              <Icon className={cn("size-4 shrink-0", selected && "text-brand")} aria-hidden />
              <span className="leading-tight">{label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          {target === "user" ? (
            <Select
              value={shareUserId}
              valid={Boolean(shareUserId)}
              disabled={!shareTrackId}
              placeholder={t("sharing.selectUserPlaceholder")}
              onChange={(e) => onShareUserIdChange(e.target.value)}
            >
              <option value="">{t("sharing.selectUserPlaceholder")}</option>
              {users.map((user) => (
                <option key={user.id} value={String(user.id)}>
                  {user.username}
                </option>
              ))}
            </Select>
          ) : (
            <Select
              value={shareChannelId}
              valid={Boolean(shareChannelId)}
              disabled={!shareTrackId}
              placeholder={t("sharing.selectChannelPlaceholder")}
              onChange={(e) => onShareChannelIdChange(e.target.value)}
            >
              <option value="">{t("sharing.selectChannelPlaceholder")}</option>
              {channels.map((channel) => (
                <option key={channel.id} value={String(channel.id)}>
                  {channel.name}
                </option>
              ))}
            </Select>
          )}
        </div>
        <Button type="button" size="sm" className="shrink-0 gap-1.5" disabled={!canAdd} onClick={onAddShare}>
          <Share2 className="size-3.5" aria-hidden />
          {t("sharing.addPermission")}
        </Button>
      </div>
    </div>
  );
}

function PermissionRow({ share, onRemove }: { share: TrackSharePermission; onRemove: () => void }) {
  const { t } = useTranslations();
  const isUser = Boolean(share.username);
  const Icon = isUser ? User : Radio;
  const name = isUser ? share.username : share.channel_name;

  return (
    <li className="group flex items-center gap-2.5 px-2 py-2 sm:px-2.5">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          isUser ? "bg-violet-500/12 text-violet-600 dark:text-violet-400" : "bg-brand/12 text-brand",
        )}
        aria-hidden
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-[11px] text-muted-foreground">
          {isUser ? t("sharing.targetUser") : t("sharing.targetChannel")}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground hover:text-rose-500"
        aria-label={t("sharing.remove")}
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" aria-hidden />
      </Button>
    </li>
  );
}

function TrackShareDetail({
  track,
  trackShares,
  users,
  channels,
  shareTrackId,
  shareUserId,
  shareChannelId,
  onShareUserIdChange,
  onShareChannelIdChange,
  onAddShare,
  onRemoveShare,
  mobilePicker,
}: {
  track: TrackSummary;
  trackShares: TrackSharePermission[];
  users: Array<{ id: number; username: string }>;
  channels: ChannelSummary[];
  shareTrackId: string;
  shareUserId: string;
  shareChannelId: string;
  onShareUserIdChange: (value: string) => void;
  onShareChannelIdChange: (value: string) => void;
  onAddShare: () => void;
  onRemoveShare: (shareId: number) => void;
  mobilePicker?: React.ReactNode;
}) {
  const { t } = useTranslations();
  const access = fromBackendVisibility(track.visibility);
  const meta = [track.artist, track.album].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-4">
      {mobilePicker}

      <div className="flex items-center gap-3 border-b border-[var(--workspace-divider)] pb-3">
        <TrackArtwork title={track.title} className="size-11 text-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate font-display text-base font-semibold">{track.title}</h3>
            <AccessBadge access={access} />
          </div>
          {meta ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p> : null}
        </div>
      </div>

      <GrantAccessBar
        shareTrackId={shareTrackId}
        shareUserId={shareUserId}
        shareChannelId={shareChannelId}
        users={users}
        channels={channels}
        onShareUserIdChange={onShareUserIdChange}
        onShareChannelIdChange={onShareChannelIdChange}
        onAddShare={onAddShare}
      />

      {trackShares.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("sharing.noPermissionsHint")}</p>
      ) : (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {t("sharing.permissionsTitle")} · {trackShares.length}
          </p>
          <ul className="divide-y divide-border/40 rounded-lg border border-border/50">
            {trackShares.map((share) => (
              <PermissionRow key={share.id} share={share} onRemove={() => onRemoveShare(share.id)} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TrackShareMobilePicker({
  open,
  onOpenChange,
  selectedTrack,
  ...sidebarProps
}: TrackShareSidebarProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTrack: TrackSummary | undefined;
}) {
  const { t } = useTranslations();

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-[var(--workspace-divider)] bg-[var(--workspace-list)] px-3 py-2 text-start xl:hidden"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <TrackArtwork title={selectedTrack?.title ?? "?"} className="size-8 text-xs" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {selectedTrack?.title ?? t("sharing.selectTrackPlaceholder")}
            </span>
            <span className="block text-[11px] text-muted-foreground">{t("sharing.tapToSwitch")}</span>
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-hidden rounded-t-2xl p-0">
          <SheetTitle className="sr-only">{t("sharing.trackListTitle")}</SheetTitle>
          <div className="border-b border-border/50 px-4 py-3">
            <h3 className="font-display text-sm font-semibold">{t("sharing.trackListTitle")}</h3>
          </div>
          <div className={cn("overflow-y-auto px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]", scrollHide)}>
            <TrackShareSidebar
              {...sidebarProps}
              onSelect={(id) => {
                sidebarProps.onSelect(id);
                onOpenChange(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function TrackSharingSection(props: Props) {
  const { t } = useTranslations();
  const {
    tracks,
    users,
    channels,
    trackShares,
    shareTrackId,
    shareUserId,
    shareChannelId,
    onShareTrackIdChange,
    onShareUserIdChange,
    onShareChannelIdChange,
    onAddShare,
    onRemoveShare,
  } = props;

  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const filteredTracks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter(
      (track) =>
        track.title.toLowerCase().includes(q) ||
        track.artist?.toLowerCase().includes(q) ||
        track.album?.toLowerCase().includes(q),
    );
  }, [tracks, search]);

  const selectedTrack = tracks.find((track) => String(track.id) === shareTrackId);

  useEffect(() => {
    if (shareTrackId || tracks.length === 0) return;
    onShareTrackIdChange(String(tracks[0].id));
  }, [shareTrackId, tracks, onShareTrackIdChange]);

  const sidebarProps: TrackShareSidebarProps = {
    tracks,
    filteredTracks,
    search,
    shareTrackId,
    onSearchChange: setSearch,
    onSelect: onShareTrackIdChange,
  };

  const mobilePicker = (
    <TrackShareMobilePicker
      open={pickerOpen}
      onOpenChange={setPickerOpen}
      selectedTrack={selectedTrack}
      {...sidebarProps}
    />
  );

  return (
    <WorkspacePage className={scrollHide}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] xl:items-start xl:gap-6">
        <WorkspaceRail className="hidden xl:block xl:w-full">
          <WorkspaceRailCard icon={Music2} title={t("sharing.trackListTitle")} description={t("sharing.trackListHint")}>
            <TrackShareSidebar {...sidebarProps} />
          </WorkspaceRailCard>
        </WorkspaceRail>

        {selectedTrack ? (
          <TrackShareDetail
            track={selectedTrack}
            trackShares={trackShares}
            users={users}
            channels={channels}
            shareTrackId={shareTrackId}
            shareUserId={shareUserId}
            shareChannelId={shareChannelId}
            onShareUserIdChange={onShareUserIdChange}
            onShareChannelIdChange={onShareChannelIdChange}
            onAddShare={onAddShare}
            onRemoveShare={onRemoveShare}
            mobilePicker={mobilePicker}
          />
        ) : (
          <WorkspaceEmpty icon={Music2} title={t("sharing.noTrackSelected")} className="py-10">
            {mobilePicker}
          </WorkspaceEmpty>
        )}
      </div>
    </WorkspacePage>
  );
}
