"use client";

import { ListMusic, Plus, Radio, User } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { useTranslations } from "@/shared/providers/locale-provider";
import type { ChannelSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

export type PlaylistLinkMode = "personal" | "channel";

const LINK_OPTIONS: Array<{ value: PlaylistLinkMode; icon: typeof User }> = [
  { value: "personal", icon: User },
  { value: "channel", icon: Radio },
];

export type CreatePlaylistFormProps = {
  name: string;
  linkMode: PlaylistLinkMode;
  channelId: string;
  channels: ChannelSummary[];
  nameError?: string;
  busy?: boolean;
  onNameChange: (value: string) => void;
  onLinkModeChange: (value: PlaylistLinkMode) => void;
  onChannelIdChange: (value: string) => void;
  onCreate: () => void;
  idPrefix?: string;
  layout?: "default" | "rail";
};

export function CreatePlaylistForm({
  name,
  linkMode,
  channelId,
  channels,
  nameError,
  busy = false,
  onNameChange,
  onLinkModeChange,
  onChannelIdChange,
  onCreate,
  idPrefix = "playlist",
  layout = "default",
}: CreatePlaylistFormProps) {
  const { t } = useTranslations();
  const rail = layout === "rail";
  const canSubmit = Boolean(name.trim()) && (linkMode === "personal" || (linkMode === "channel" && channelId));

  return (
    <form
      className={cn("flex flex-col", rail ? "gap-5" : "gap-4")}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit && !busy) onCreate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-new-playlist-name`} className={rail ? "text-xs text-muted-foreground" : undefined}>
          {t("playlists.nameLabel")}
        </Label>
        <Input
          id={`${idPrefix}-new-playlist-name`}
          value={name}
          aria-invalid={Boolean(nameError)}
          valid={Boolean(name.trim())}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t("playlists.namePlaceholder")}
          className={rail ? "h-10" : "h-11"}
          autoComplete="off"
        />
        {nameError ? <p className="text-xs text-rose-500 dark:text-rose-400">{nameError}</p> : null}
      </div>

      <fieldset className="space-y-2">
        <legend className={cn("text-sm font-medium", rail && "text-xs font-medium text-muted-foreground")}>
          {t("playlists.linkTo")}
        </legend>
        {rail ? (
          <div
            className="flex flex-col gap-1 rounded-lg border border-[var(--workspace-divider)] bg-muted/25 p-1"
            role="group"
            aria-label={t("playlists.linkTo")}
          >
            {LINK_OPTIONS.map(({ value, icon: Icon }) => {
              const selected = linkMode === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onLinkModeChange(value)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-start text-sm transition-colors",
                    selected
                      ? "bg-background font-medium text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                  )}
                  aria-pressed={selected}
                >
                  <Icon className={cn("size-4 shrink-0", selected && "text-brand")} aria-hidden />
                  {value === "personal" ? t("playlists.personalBadge") : t("playlists.scopeChannel")}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2" role="group" aria-label={t("playlists.linkTo")}>
            {LINK_OPTIONS.map(({ value, icon: Icon }) => {
              const selected = linkMode === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onLinkModeChange(value)}
                  className={cn(
                    "flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-center text-[11px] font-medium transition-colors sm:text-xs",
                    selected
                      ? "bg-brand/15 text-brand ring-2 ring-brand/35"
                      : "bg-[var(--workspace-stat)] text-muted-foreground hover:bg-muted/45 hover:text-foreground",
                  )}
                  aria-pressed={selected}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="leading-tight">
                    {value === "personal" ? t("playlists.personalBadge") : t("playlists.scopeChannel")}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      {linkMode === "channel" ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-new-playlist-channel`} className={cn("flex items-center gap-1.5", rail && "text-xs text-muted-foreground")}>
            <ListMusic className="size-3.5 opacity-70" aria-hidden />
            {t("playlists.channelOptional")}
          </Label>
          {channels.length > 0 ? (
            <Select
              id={`${idPrefix}-new-playlist-channel`}
              value={channelId}
              valid={Boolean(channelId)}
              onChange={(e) => onChannelIdChange(e.target.value)}
              className={rail ? "h-10" : "h-11"}
            >
              <option value="">{t("playlists.selectChannelPlaceholder")}</option>
              {channels.map((ch) => (
                <option key={ch.id} value={String(ch.id)}>
                  {ch.name}
                </option>
              ))}
            </Select>
          ) : (
            <p className="text-xs text-muted-foreground">{t("playlists.noChannelsForCreate")}</p>
          )}
        </div>
      ) : null}

      <Button
        type="submit"
        disabled={!canSubmit || busy}
        className={cn(
          "w-full gap-2 bg-brand text-brand-foreground hover:bg-brand-strong",
          rail ? "h-10 rounded-lg" : "h-11",
        )}
      >
        <Plus className="size-4" aria-hidden />
        {t("playlists.create")}
      </Button>
    </form>
  );
}
