"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, Music2, RefreshCw, Search, Send, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-provider";
import { useTranslations } from "@/components/providers/locale-provider";
import { listenerFieldClass, listenerItemClass } from "@/features/channels/channel-listener-panel-styles";
import { useChannelQueue } from "@/features/channels/channel-queue-context";
import {
  createChannelSuggestion,
  getMe,
  listChannelSuggestions,
  listTracks,
  normalizeTrackList,
  reviewChannelSuggestion,
  type ChannelPlaylistSuggestion,
  type TrackSummary,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  channelId: string;
  canManage: boolean;
  variant?: "admin" | "listener";
  /** Admin tab layout — skip duplicate card chrome (page header provides title). */
  embedded?: boolean;
};

function suggestionStatusLabel(
  t: (key: "room.suggestions.status.pending" | "room.suggestions.status.approved" | "room.suggestions.status.rejected", vars?: Record<string, string | number>) => string,
  status: string,
) {
  const key = `room.suggestions.status.${status}` as "room.suggestions.status.pending";
  const translated = t(key);
  return translated === key ? status : translated;
}

function ListenerTrackSuggestions({ channelId }: { channelId: string }) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [mySuggestions, setMySuggestions] = useState<ChannelPlaylistSuggestion[]>([]);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [externalTitle, setExternalTitle] = useState("");
  const [externalArtist, setExternalArtist] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [trackList, suggestions, me] = await Promise.all([
      listTracks(),
      listChannelSuggestions(channelId),
      getMe(),
    ]);
    const uid = me?.user?.id ?? null;
    setMyUserId(uid);
    setTracks(normalizeTrackList(trackList));
    setMySuggestions(uid != null ? suggestions.results.filter((s) => s.user === uid) : []);
  }, [channelId]);

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((e) => showToast(e instanceof Error ? e.message : "Could not load suggestions.", "error"))
      .finally(() => setLoading(false));
  }, [load, showToast]);

  const filteredTracks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? tracks.filter((track) => {
          const title = track.title.toLowerCase();
          const artist = (track.artist ?? "").toLowerCase();
          return title.includes(q) || artist.includes(q);
        })
      : tracks;
    return list.slice(0, 80);
  }, [tracks, search]);

  const selectedTrack = selectedTrackId != null ? tracks.find((t) => t.id === selectedTrackId) : null;

  async function submitSuggestion() {
    if (selectedTrackId == null) return;
    setSubmitting(true);
    try {
      await createChannelSuggestion(channelId, { track_id: selectedTrackId, note: note.trim() });
      setNote("");
      setSelectedTrackId(null);
      setSearch("");
      showToast(t("room.listener.suggestions.sent"), "success");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Suggestion failed.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitExternalSuggestion() {
    const url = externalUrl.trim();
    if (!url) return;
    setSubmitting(true);
    try {
      await createChannelSuggestion(channelId, {
        external_url: url,
        external_title: externalTitle.trim() || undefined,
        external_artist: externalArtist.trim() || undefined,
        note: note.trim(),
      });
      setExternalUrl("");
      setExternalTitle("");
      setExternalArtist("");
      setNote("");
      showToast(t("room.listener.suggestions.sent"), "success");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Suggestion failed.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-border/50 bg-gradient-to-b from-card/40 to-card/15">
        <div className="border-b border-border/40 bg-[var(--surface-inset)]/80 px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">{t("room.listener.suggestions.composeTitle")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("room.listener.suggestions.composeHint")}</p>
        </div>

        <div className="space-y-3 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("room.listener.suggestions.searchPlaceholder")}
              className={cn("ps-9", listenerFieldClass)}
            />
          </div>

          <ScrollArea className="h-[min(12rem,32vh)] rounded-xl border border-border/40 bg-background/30">
            <ul className="p-1">
              {loading ? (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">{t("common.loading")}</li>
              ) : filteredTracks.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {t("room.listener.suggestions.noTracks")}
                </li>
              ) : (
                filteredTracks.map((track) => {
                  const isSelected = selectedTrackId === track.id;
                  return (
                    <li key={track.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedTrackId(track.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm transition-colors",
                          isSelected
                            ? "bg-brand/15 text-brand ring-1 ring-brand/30"
                            : "text-foreground hover:bg-muted/40",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                            isSelected ? "border-brand/30 bg-brand/10" : "border-border/50 bg-muted/20",
                          )}
                        >
                          <Music2 className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{track.title}</span>
                          {track.artist ? (
                            <span className="block truncate text-xs text-muted-foreground">{track.artist}</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </ScrollArea>

          {selectedTrack ? (
            <p className="text-xs text-muted-foreground">
              {t("room.listener.suggestions.selected")}:{" "}
              <span className="font-medium text-foreground">{selectedTrack.title}</span>
            </p>
          ) : null}

          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("room.listener.suggestions.notePlaceholder")}
            className={listenerFieldClass}
            maxLength={280}
          />

          <Button
            type="button"
            className="w-full gap-2 bg-brand text-brand-foreground hover:bg-brand-strong"
            disabled={selectedTrackId == null || submitting}
            onClick={() => void submitSuggestion()}
          >
            <Send className="size-4" aria-hidden />
            {submitting ? t("common.loading") : t("room.listener.suggestions.submit")}
          </Button>

          <div className="border-t border-border/40 pt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t("suggestions.externalUrl")}</p>
            <Input
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://open.spotify.com/… or YouTube"
              className={cn("mb-2", listenerFieldClass)}
            />
            <div className="mb-2 grid gap-2 sm:grid-cols-2">
              <Input
                value={externalTitle}
                onChange={(e) => setExternalTitle(e.target.value)}
                placeholder={t("suggestions.externalTitle")}
                className={listenerFieldClass}
              />
              <Input
                value={externalArtist}
                onChange={(e) => setExternalArtist(e.target.value)}
                placeholder={t("suggestions.externalArtist")}
                className={listenerFieldClass}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={!externalUrl.trim() || submitting}
              onClick={() => void submitExternalSuggestion()}
            >
              {t("suggestions.submitExternal")}
            </Button>
          </div>
        </div>
      </section>

      {mySuggestions.length > 0 ? (
        <section className="space-y-2">
          <h3 className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t("room.listener.suggestions.yourSuggestions")}
          </h3>
          <ul className="space-y-2">
            {mySuggestions.map((s) => {
              const title =
                tracks.find((tr) => tr.id === s.track)?.title ??
                s.track_title ??
                s.external_title ??
                (s.external_url ? s.external_url : `#${s.track ?? "link"}`);
              return (
                <li key={s.id} className={cn("px-3 py-2.5", listenerItemClass)}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 font-medium text-foreground">{title}</span>
                    <Badge
                      variant={
                        s.status === "approved" ? "success" : s.status === "rejected" ? "destructive" : "secondary"
                      }
                      className="shrink-0 capitalize"
                    >
                      {suggestionStatusLabel(t, s.status)}
                    </Badge>
                  </div>
                  {s.note ? <p className="mt-1 text-xs text-muted-foreground">{s.note}</p> : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : myUserId != null && !loading ? (
        <p className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
          {t("room.listener.suggestions.emptyYours")}
        </p>
      ) : null}
    </div>
  );
}

type SuggestionFilter = "" | "pending" | "approved" | "rejected";

function AdminSuggestTrackPicker({
  tracks,
  selectedTrackId,
  onSelect,
  loading,
}: {
  tracks: TrackSummary[];
  selectedTrackId: number | null;
  onSelect: (id: number | null) => void;
  loading?: boolean;
}) {
  const { t } = useTranslations();
  const [search, setSearch] = useState("");

  const filteredTracks = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? tracks.filter((track) => {
          const title = track.title.toLowerCase();
          const artist = (track.artist ?? "").toLowerCase();
          return title.includes(q) || artist.includes(q);
        })
      : tracks;
    return list.slice(0, 80);
  }, [tracks, search]);

  const selectedTrack = selectedTrackId != null ? tracks.find((tr) => tr.id === selectedTrackId) : null;

  return (
    <div className="min-w-0 flex-1 space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("room.listener.suggestions.searchPlaceholder")}
          className={cn("ps-9", listenerFieldClass)}
        />
      </div>
      <ScrollArea className="h-[min(10rem,24vh)] rounded-xl border border-border/40 bg-background/30">
        <ul className="p-1">
          {loading ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t("common.loading")}</li>
          ) : filteredTracks.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("room.listener.suggestions.noTracks")}
            </li>
          ) : (
            filteredTracks.map((track) => {
              const isSelected = selectedTrackId === track.id;
              return (
                <li key={track.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(isSelected ? null : track.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors",
                      isSelected
                        ? "bg-brand/15 text-brand ring-1 ring-brand/30"
                        : "text-foreground hover:bg-muted/40",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg border",
                        isSelected ? "border-brand/30 bg-brand/10" : "border-border/50 bg-muted/20",
                      )}
                    >
                      <Music2 className="size-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{track.title}</span>
                      {track.artist ? (
                        <span className="block truncate text-xs text-muted-foreground">{track.artist}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </ScrollArea>
      {selectedTrack ? (
        <p className="text-xs text-muted-foreground">
          {t("room.listener.suggestions.selected")}:{" "}
          <span className="font-medium text-foreground">{selectedTrack.title}</span>
        </p>
      ) : null}
    </div>
  );
}

export function ChannelTrackSuggestions({ channelId, canManage, variant = "admin", embedded = false }: Props) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const { refreshQueue } = useChannelQueue();
  const [suggestions, setSuggestions] = useState<ChannelPlaylistSuggestion[]>([]);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [suggestTrackId, setSuggestTrackId] = useState<number | null>(null);
  const [suggestNote, setSuggestNote] = useState("");
  const [suggestionFilter, setSuggestionFilter] = useState<SuggestionFilter>("pending");
  const [adminSearch, setAdminSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const isListener = variant === "listener";

  const filteredSuggestions = useMemo(() => {
    const q = adminSearch.trim().toLowerCase();
    if (!q) return suggestions;
    return suggestions.filter((s) => {
      const title =
        tracks.find((tr) => tr.id === s.track)?.title ??
        s.track_title ??
        s.external_title ??
        s.external_url ??
        "";
      const user = s.username ?? "";
      const note = s.note ?? "";
      const blob = `${title} ${user} ${note}`.toLowerCase();
      return blob.includes(q);
    });
  }, [adminSearch, suggestions, tracks]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, trackList] = await Promise.all([
        listChannelSuggestions(channelId, suggestionFilter || undefined),
        listTracks(),
      ]);
      setSuggestions(s.results);
      setTracks(normalizeTrackList(trackList));
    } finally {
      setLoading(false);
    }
  }, [channelId, suggestionFilter]);

  useEffect(() => {
    if (isListener) return;
    void load().catch((e) => showToast(e instanceof Error ? e.message : "Could not load suggestions.", "error"));
  }, [load, showToast, isListener]);

  useEffect(() => {
    if (isListener) return;
    const reload = () => void load().catch(() => undefined);
    const onChanged = (ev: Event) => {
      const e = ev as CustomEvent<{ channelId?: string }>;
      if (String(e.detail?.channelId ?? "") !== String(channelId)) return;
      reload();
    };
    const onPlayback = (ev: Event) => {
      const e = ev as CustomEvent<{ channelId?: string; payload?: { type?: string } }>;
      if (String(e.detail?.channelId ?? "") !== String(channelId)) return;
      if (String(e.detail?.payload?.type ?? "").toLowerCase() !== "suggestions_updated") return;
      reload();
    };
    window.addEventListener("channel-suggestions-changed", onChanged);
    window.addEventListener("channel-playback-updated", onPlayback);
    return () => {
      window.removeEventListener("channel-suggestions-changed", onChanged);
      window.removeEventListener("channel-playback-updated", onPlayback);
    };
  }, [channelId, isListener, load]);

  async function submitSuggestion() {
    if (suggestTrackId == null) return;
    try {
      await createChannelSuggestion(channelId, { track_id: suggestTrackId, note: suggestNote.trim() });
      setSuggestNote("");
      setSuggestTrackId(null);
      showToast("Suggestion sent to moderators.", "success");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Suggestion failed.", "error");
    }
  }

  async function review(id: number, action: "approve" | "reject") {
    try {
      await reviewChannelSuggestion(channelId, { suggestion_id: id, action });
      await refreshQueue();
      showToast(action === "approve" ? "Queued as next up after the current track." : "Suggestion rejected.", "success");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Review failed.", "error");
    }
  }

  if (isListener) {
    return <ListenerTrackSuggestions channelId={channelId} />;
  }

  const segmentBtn = (active: boolean) =>
    cn(
      "flex flex-1 items-center justify-center rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:text-sm",
      active ? "bg-brand/12 text-brand" : "text-muted-foreground hover:bg-muted/35 hover:text-foreground",
    );

  const filterTabs: { id: SuggestionFilter; labelKey: "room.admin.suggestions.filter.pending" | "room.admin.suggestions.filter.approved" | "room.admin.suggestions.filter.rejected" | "room.admin.suggestions.filter.all" }[] = [
    { id: "pending", labelKey: "room.admin.suggestions.filter.pending" },
    { id: "approved", labelKey: "room.admin.suggestions.filter.approved" },
    { id: "rejected", labelKey: "room.admin.suggestions.filter.rejected" },
    { id: "", labelKey: "room.admin.suggestions.filter.all" },
  ];

  const suggestionRows = (
    <ul className="space-y-0.5 text-sm">
      {filteredSuggestions.map((s) => {
        const title = tracks.find((tr) => tr.id === s.track)?.title ?? `Track #${s.track}`;
        return (
          <li
            key={s.id}
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2.5 transition-colors",
              embedded ? "hover:bg-muted/30" : "border border-border/80 bg-card/40",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{title}</p>
              {s.note ? <p className="truncate text-xs text-muted-foreground">{s.note}</p> : null}
            </div>
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {suggestionStatusLabel(t, s.status)}
            </Badge>
            {canManage && s.status === "pending" ? (
              <span className="flex shrink-0 gap-1">
                <Button type="button" size="sm" className="h-8" onClick={() => void review(s.id, "approve")}>
                  {t("room.admin.suggestions.approve")}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => void review(s.id, "reject")}>
                  {t("room.admin.suggestions.reject")}
                </Button>
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-brand/25 bg-[var(--brand-subtle)] text-brand">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <div>
              <h2 className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
                {t("room.admin.tab.suggestions.title")}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("room.admin.suggestions.count", { count: suggestions.length })}</p>
            </div>
          </div>
          <Button type="button" variant="secondary" size="sm" className="h-9 shrink-0 gap-2" disabled={loading} onClick={() => void load()}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {t("room.admin.suggestions.refresh")}
          </Button>
        </div>

        <div className="shrink-0 space-y-3 border-b border-border/40 px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={adminSearch}
              onChange={(e) => setAdminSearch(e.target.value)}
              placeholder={t("room.admin.suggestions.searchPlaceholder")}
              className="ps-9"
            />
          </div>
          <div className="flex gap-1 rounded-xl bg-muted/25 p-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.id || "all"}
                type="button"
                className={segmentBtn(suggestionFilter === tab.id)}
                onClick={() => setSuggestionFilter(tab.id)}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>

          <details className="group rounded-xl border border-border/50 bg-muted/15">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
              <Send className="size-4 text-muted-foreground" aria-hidden />
              {t("room.admin.suggestions.compose")}
              <ChevronDown className="ms-auto size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-2 border-t border-border/40 px-3 py-3">
              <AdminSuggestTrackPicker
                tracks={tracks}
                selectedTrackId={suggestTrackId}
                onSelect={setSuggestTrackId}
                loading={loading}
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Input
                  placeholder={t("room.admin.suggestions.notePlaceholder")}
                  value={suggestNote}
                  onChange={(e) => setSuggestNote(e.target.value)}
                  className={cn("sm:max-w-xs", listenerFieldClass)}
                  maxLength={280}
                  valid
                />
                <Button type="button" className="shrink-0" onClick={() => void submitSuggestion()} disabled={suggestTrackId == null}>
                  {t("room.admin.suggestions.submit")}
                </Button>
              </div>
            </div>
          </details>

          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t("room.admin.suggestions.listLabel")}
          </p>
        </div>

        <ScrollArea className="min-h-0 flex-1 px-2 py-3 sm:px-3">
          {loading ? (
            <div className="space-y-1.5 px-2 py-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
              ))}
            </div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
              <Sparkles className="size-10 text-muted-foreground/50" aria-hidden />
              <p className="text-sm text-muted-foreground">{t("room.admin.suggestions.empty")}</p>
            </div>
          ) : (
            <div className="px-1">{suggestionRows}</div>
          )}
        </ScrollArea>
      </div>
    );
  }

  const body = (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select
          value={suggestionFilter}
          onChange={(e) => setSuggestionFilter(e.target.value as SuggestionFilter)}
          className="w-40 border-border bg-card"
        >
          <option value="pending">{t("room.admin.suggestions.filter.pending")}</option>
          <option value="approved">{t("room.admin.suggestions.filter.approved")}</option>
          <option value="rejected">{t("room.admin.suggestions.filter.rejected")}</option>
          <option value="">{t("room.admin.suggestions.filter.all")}</option>
        </Select>
        <Button type="button" variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("room.admin.suggestions.refresh")}
        </Button>
      </div>

      <AdminSuggestTrackPicker
        tracks={tracks}
        selectedTrackId={suggestTrackId}
        onSelect={setSuggestTrackId}
        loading={loading}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
        <Input
          placeholder={t("room.admin.suggestions.notePlaceholder")}
          value={suggestNote}
          onChange={(e) => setSuggestNote(e.target.value)}
          className="max-w-xs border-border bg-card"
          maxLength={280}
        />
        <Button type="button" className="shrink-0" onClick={() => void submitSuggestion()} disabled={suggestTrackId == null}>
          {t("room.admin.suggestions.submit")}
        </Button>
      </div>

      {suggestions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-8 text-center text-muted-foreground">
          {t("room.admin.suggestions.empty")}
        </p>
      ) : (
        suggestionRows
      )}
    </div>
  );

  return (
    <Card className="border-border/90">
      <CardHeader className="border-b border-border/80 pb-3">
        <CardTitle className="text-lg">{t("room.admin.tab.suggestions.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">{body}</CardContent>
    </Card>
  );
}
