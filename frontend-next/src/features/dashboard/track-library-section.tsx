"use client";

import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FavoriteStarButton } from "@/components/ui/favorite-star-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useTranslations } from "@/components/providers/locale-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import type { TrackSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  tracks: TrackSummary[];
  trackTitle: string;
  trackVisibility: TrackSummary["visibility"];
  selectedTrackFileName?: string;
  isUploading: boolean;
  uploadProgress: number;
  errors: { trackTitle?: string; trackFile?: string };
  onTrackTitleChange: (value: string) => void;
  onTrackVisibilityChange: (value: TrackSummary["visibility"]) => void;
  onTrackFileChange: (file: File | null) => void;
  onTrackFileDrop: (file: File | null) => void;
  onUploadTrack: () => void;
  favoritesOnly?: boolean;
  favoriteBusyTrackId?: number | null;
  onFavoritesOnlyChange?: (on: boolean) => void;
  onToggleFavorite?: (trackId: number, favorited: boolean) => void;
};

const VISIBILITY_KEYS: Record<TrackSummary["visibility"], MessageKey> = {
  private: "tracks.visPrivate",
  shared_with_users: "tracks.visSharedUsers",
  shared_with_channels: "tracks.visSharedChannels",
  public_lan: "tracks.visPublicLan",
};

export function TrackLibrarySection(props: Props) {
  const { t } = useTranslations();
  const {
    tracks,
    trackTitle,
    trackVisibility,
    selectedTrackFileName,
    isUploading,
    uploadProgress,
    errors,
    onTrackTitleChange,
    onTrackVisibilityChange,
    onTrackFileChange,
    onTrackFileDrop,
    onUploadTrack,
    favoritesOnly = false,
    favoriteBusyTrackId = null,
    onFavoritesOnlyChange,
    onToggleFavorite,
  } = props;

  const visibilityTone: Record<TrackSummary["visibility"], "default" | "warning" | "success"> = {
    private: "default",
    shared_with_users: "warning",
    shared_with_channels: "warning",
    public_lan: "success",
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(280px,340px)_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{t("tracks.uploadTitle")}</CardTitle>
          <CardDescription>{t("tracks.uploadDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("tracks.title")}</Label>
            <Input
              value={trackTitle}
              aria-invalid={Boolean(errors.trackTitle)}
              valid={Boolean(trackTitle.trim())}
              onChange={(e) => onTrackTitleChange(e.target.value)}
            />
            {errors.trackTitle ? <p className="text-xs text-rose-400">{errors.trackTitle}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label>{t("tracks.visibility")}</Label>
            <Select
              value={trackVisibility}
              valid={Boolean(trackVisibility)}
              onChange={(e) => onTrackVisibilityChange(e.target.value as TrackSummary["visibility"])}
            >
              <option value="private">{t("tracks.visPrivate")}</option>
              <option value="shared_with_users">{t("tracks.visSharedUsers")}</option>
              <option value="shared_with_channels">{t("tracks.visSharedChannels")}</option>
              <option value="public_lan">{t("tracks.visPublicLan")}</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("tracks.audioFile")}</Label>
            <div
              className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground transition-colors hover:border-brand/35 hover:bg-brand/5"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                onTrackFileDrop(event.dataTransfer.files?.[0] ?? null);
              }}
            >
              {t("tracks.dropzone")}
            </div>
            <input
              className="w-full rounded-lg border border-border/80 bg-background px-3 py-2 text-sm file:me-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              type="file"
              accept="audio/*"
              onChange={(e) => onTrackFileChange(e.target.files?.[0] ?? null)}
            />
            {selectedTrackFileName ? (
              <p className="text-xs text-muted-foreground">{t("tracks.selectedFile", { name: selectedTrackFileName })}</p>
            ) : null}
            {errors.trackFile ? <p className="text-xs text-rose-400">{errors.trackFile}</p> : null}
          </div>
          {isUploading ? (
            <div className="space-y-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{t("tracks.uploading", { percent: uploadProgress })}</p>
            </div>
          ) : null}
          <Button className="w-full" onClick={onUploadTrack} disabled={isUploading}>
            {isUploading ? t("tracks.uploadingButton") : t("tracks.uploadButton")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle>{t("tracks.libraryTitle", { count: tracks.length })}</CardTitle>
              <CardDescription>{t("tracks.libraryDescription")}</CardDescription>
            </div>
            {onFavoritesOnlyChange ? (
              <Button
                type="button"
                size="sm"
                variant={favoritesOnly ? "default" : "outline"}
                className={cn("h-8 shrink-0 gap-1.5", favoritesOnly && "bg-amber-500/90 hover:bg-amber-500")}
                onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
              >
                <Star className={cn("h-3.5 w-3.5", favoritesOnly && "fill-current")} aria-hidden />
                {favoritesOnly ? t("favorites.showAll") : t("favorites.showOnly")}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {tracks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border/70 py-12 text-center text-sm text-muted-foreground">
              {favoritesOnly ? t("favorites.showOnly") : t("tracks.empty")}
            </p>
          ) : (
            <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto pe-1">
              {tracks.map((track) => (
                <li
                  key={track.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border/60 hover:bg-muted/30"
                >
                  {onToggleFavorite ? (
                    <FavoriteStarButton
                      favorited={Boolean(track.is_favorited)}
                      busy={favoriteBusyTrackId === track.id}
                      label={track.is_favorited ? t("favorites.remove") : t("favorites.add")}
                      onToggle={() => onToggleFavorite(track.id, !track.is_favorited)}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{track.title}</p>
                    <p className="text-xs text-muted-foreground">{t("tracks.trackId", { id: track.id })}</p>
                  </div>
                  <Badge variant={visibilityTone[track.visibility]} className="shrink-0 text-[10px]">
                    {t(VISIBILITY_KEYS[track.visibility])}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
