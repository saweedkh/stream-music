"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, ListMusic, Music, Share2 } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast-provider";
import { ChannelManagementSection } from "@/features/dashboard/channel-management-section";
import { JoinChannelDialog } from "@/features/dashboard/join-channel-dialog";
import { NotificationPreferencesCard } from "@/features/dashboard/notification-preferences-card";
import { PlaylistManager } from "@/features/dashboard/playlist-manager";
import { TrackLibrarySection } from "@/features/dashboard/track-library-section";
import { TrackSharingSection } from "@/features/dashboard/track-sharing-section";
import {
  addPlaylistItem,
  addTrackSharePermission,
  createChannel,
  createPlaylist,
  getMe,
  listChannels,
  listPlaylistItems,
  listPlaylists,
  listTracks,
  listTrackSharePermissions,
  listUsers,
  removeTrackSharePermission,
  reorderPlaylistItem,
  uploadTrackChunked,
  type ChannelSummary,
  type PlaylistItemSummary,
  type PlaylistSummary,
  type TrackSharePermission,
  type TrackSummary,
} from "@/lib/api";
import { createChannelSchema, createPlaylistSchema, uploadTrackSchema } from "@/lib/validation";

export function DashboardWorkspace() {
  const { showToast } = useToast();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItemSummary[]>([]);
  const [users, setUsers] = useState<Array<{ id: number; username: string }>>([]);
  const [trackShares, setTrackShares] = useState<TrackSharePermission[]>([]);
  const [, setStatus] = useState<string | null>(null);

  const [channelName, setChannelName] = useState("");
  const [channelPrivacy, setChannelPrivacy] = useState<ChannelSummary["privacy"]>("public");
  const [memberLimit, setMemberLimit] = useState("50");

  const [trackTitle, setTrackTitle] = useState("");
  const [trackVisibility, setTrackVisibility] = useState<TrackSummary["visibility"]>("private");
  const [trackFile, setTrackFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const [playlistName, setPlaylistName] = useState("");
  const [playlistChannel, setPlaylistChannel] = useState<string>("none");
  const [itemPlaylistId, setItemPlaylistId] = useState<string>("");
  const [itemTrackId, setItemTrackId] = useState<string>("");
  const [shareTrackId, setShareTrackId] = useState<string>("");
  const [shareUserId, setShareUserId] = useState<string>("");
  const [shareChannelId, setShareChannelId] = useState<string>("");
  const [draggingPlaylistItemId, setDraggingPlaylistItemId] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"channels" | "tracks" | "playlists" | "sharing">(
    tabFromUrl === "channels" || tabFromUrl === "tracks" || tabFromUrl === "playlists" || tabFromUrl === "sharing" ? tabFromUrl : "channels",
  );

  const groupedPlaylistItems = useMemo(() => {
    const result: Record<number, PlaylistItemSummary[]> = {};
    for (const item of playlistItems) {
      if (!result[item.playlist]) result[item.playlist] = [];
      result[item.playlist].push(item);
    }
    Object.keys(result).forEach((key) => result[Number(key)].sort((a, b) => a.position - b.position));
    return result;
  }, [playlistItems]);
  function deriveTitleFromFile(file: File) {
    return file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
  }

  function handleTrackFileSelect(file: File | null) {
    setTrackFile(file);
    if (!file) return;
    setTrackTitle((current) => (current.trim() ? current : deriveTitleFromFile(file)));
    setFieldErrors((prev) => {
      const { trackFile: _trackFile, trackTitle: _trackTitle, ...rest } = prev;
      return rest;
    });
  }

  async function refreshAll() {
    setIsLoading(true);
    try {
      const me = await getMe();
      setCurrentUserId(me?.user?.id ?? null);
      const [c, t, p, u] = await Promise.all([listChannels(), listTracks(), listPlaylists(), listUsers()]);
      const pi = await listPlaylistItems();
      setChannels(c);
      setTracks(t);
      setPlaylists(p);
      setPlaylistItems(pi);
      setUsers(u.results);
    } catch {
      setStatus("Cannot load dashboard data. Please login again.");
      showToast("Cannot load dashboard data. Please login again.", "error");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    const queryTab = searchParams.get("tab");
    if (queryTab === "channels" || queryTab === "tracks" || queryTab === "playlists" || queryTab === "sharing") {
      setActiveTab(queryTab);
    }
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("tab") === activeTab) return;
    params.set("tab", activeTab);
    const qs = params.toString();
    window.history.replaceState(window.history.state, "", qs.length ? `${pathname}?${qs}` : pathname);
  }, [activeTab, pathname, searchParams]);

  async function handleCreateChannel() {
    const result = createChannelSchema.safeParse({ channelName, memberLimit });
    const nextErrors: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? "");
        if (field === "channelName" || field === "memberLimit") nextErrors[field] = issue.message;
      }
    }
    setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
    if (Object.keys(nextErrors).length) {
      showToast("Please fix channel fields.", "error");
      return;
    }
    try {
      await createChannel({ name: channelName, privacy: channelPrivacy, member_limit: Number(memberLimit) || 50 });
      setStatus("Channel created.");
      showToast("Channel created.", "success");
      setChannelName("");
      await refreshAll();
    } catch {
      setStatus("Create channel failed.");
      showToast("Create channel failed.", "error");
    }
  }

  async function handleUploadTrack() {
    const normalizedTitle = trackTitle.trim() || (trackFile ? deriveTitleFromFile(trackFile) : "");
    const result = uploadTrackSchema.safeParse({ trackTitle: normalizedTitle, trackFile });
    const nextErrors: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? "");
        if (field === "trackTitle" || field === "trackFile") nextErrors[field] = issue.message;
      }
    }
    setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
    if (Object.keys(nextErrors).length) {
      showToast("Please fix track fields.", "error");
      return;
    }
    if (!trackFile) return;
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setTrackTitle(normalizedTitle);
      await uploadTrackChunked({ title: normalizedTitle, visibility: trackVisibility, file: trackFile }, { onProgress: setUploadProgress });
      setStatus("Track uploaded.");
      showToast("Track uploaded.", "success");
      setTrackTitle("");
      setTrackFile(null);
      setUploadProgress(100);
      await refreshAll();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload track failed.";
      setStatus(message);
      showToast(message, "error");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCreatePlaylist() {
    const result = createPlaylistSchema.safeParse({ playlistName });
    if (!result.success) {
      setFieldErrors((prev) => ({ ...prev, playlistName: result.error.issues[0]?.message ?? "Playlist name is required" }));
      showToast("Please enter playlist name.", "error");
      return;
    }
    try {
      await createPlaylist({ name: playlistName, channel: playlistChannel !== "none" ? Number(playlistChannel) : null });
      setStatus("Playlist created.");
      showToast("Playlist created.", "success");
      setPlaylistName("");
      setPlaylistChannel("none");
      await refreshAll();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Create playlist failed.";
      setStatus(message);
      showToast(message, "error");
    }
  }

  async function handleAddPlaylistItem() {
    if (!itemPlaylistId || !itemTrackId) {
      showToast("Select both playlist and track.", "error");
      return;
    }
    try {
      const playlistId = Number(itemPlaylistId);
      const trackId = Number(itemTrackId);
      const position = playlistItems.filter((item) => item.playlist === playlistId).length;
      await addPlaylistItem({ playlist: playlistId, track: trackId, position });
      setStatus("Track added to playlist.");
      showToast("Track added to playlist.", "success");
      setItemPlaylistId("");
      setItemTrackId("");
      await refreshAll();
    } catch {
      setStatus("Cannot add track to playlist.");
      showToast("Cannot add track to playlist.", "error");
    }
  }

  async function handleReorderPlaylist(draggingId: number, dropIndex: number) {
    try {
      await reorderPlaylistItem(draggingId, dropIndex);
      setStatus("Playlist reordered.");
      showToast("Playlist reordered.", "success");
      await refreshAll();
    } catch {
      setStatus("Cannot reorder playlist.");
      showToast("Cannot reorder playlist.", "error");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 pb-24">
        <section className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-950/45 p-5 shadow-lg shadow-black/25 backdrop-blur-xl">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-9 w-56" />
          <Skeleton className="mt-3 h-4 w-full max-w-xl" />
          <div className="mt-5 flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
          </div>
        </section>
        <section className="rounded-2xl border border-zinc-800/70 bg-zinc-950/45 p-5">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="mt-5 h-48 w-full rounded-xl" />
        </section>
      </div>
    );
  }

  async function handleTrackSelection(value: string) {
    setShareTrackId(value);
    if (!value) {
      setTrackShares([]);
      return;
    }
    try {
      const rows = await listTrackSharePermissions(Number(value));
      setTrackShares(rows.results);
    } catch {
      setStatus("Cannot load track shares.");
      showToast("Cannot load track shares.", "error");
    }
  }

  async function handleAddShare() {
    if (!shareTrackId || (!shareUserId && !shareChannelId)) {
      showToast("Select a track and at least one target (user or channel).", "error");
      return;
    }
    try {
      await addTrackSharePermission(Number(shareTrackId), {
        user_id: shareUserId ? Number(shareUserId) : undefined,
        channel_id: shareChannelId ? Number(shareChannelId) : undefined,
      });
      const rows = await listTrackSharePermissions(Number(shareTrackId));
      setTrackShares(rows.results);
      setShareUserId("");
      setShareChannelId("");
      setStatus("Track share permission added.");
      showToast("Track share permission added.", "success");
    } catch {
      setStatus("Cannot add share permission.");
      showToast("Cannot add share permission.", "error");
    }
  }

  async function handleRemoveShare(shareId: number) {
    if (!shareTrackId) return;
    try {
      await removeTrackSharePermission(Number(shareTrackId), shareId);
      const rows = await listTrackSharePermissions(Number(shareTrackId));
      setTrackShares(rows.results);
      setStatus("Share permission removed.");
      showToast("Share permission removed.", "success");
    } catch {
      setStatus("Cannot remove share permission.");
      showToast("Cannot remove share permission.", "error");
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <section className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-950/45 p-5 shadow-lg shadow-black/25 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-medium uppercase tracking-widest text-emerald-500/90">Workspace</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Dashboard</h1>
            <p className="max-w-lg text-sm text-zinc-400 sm:text-base">Channels, media library, playlists, and sharing in one place.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <JoinChannelDialog />
            <Button variant="secondary" size="sm" onClick={refreshAll}>
              Refresh
            </Button>
          </div>
        </div>
      </section>

      <NotificationPreferencesCard />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full animate-in fade-in duration-500">
        <div className="overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:overflow-visible">
          <TabsList className="inline-flex min-h-11 w-max min-w-full flex-wrap justify-start gap-1 sm:w-full sm:flex-nowrap sm:justify-center">
            <TabsTrigger value="channels" className="gap-1.5">
              <LayoutGrid className="h-4 w-4 opacity-80" aria-hidden />
              Channels
            </TabsTrigger>
            <TabsTrigger value="tracks" className="gap-1.5">
              <Music className="h-4 w-4 opacity-80" aria-hidden />
              Tracks
            </TabsTrigger>
            <TabsTrigger value="playlists" className="gap-1.5">
              <ListMusic className="h-4 w-4 opacity-80" aria-hidden />
              Playlists
            </TabsTrigger>
            <TabsTrigger value="sharing" className="gap-1.5">
              <Share2 className="h-4 w-4 opacity-80" aria-hidden />
              Sharing
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-6">
          <TabsContent value="channels" className="m-0 focus-visible:outline-none">
            <ChannelManagementSection
              channels={channels}
              channelName={channelName}
              channelPrivacy={channelPrivacy}
              memberLimit={memberLimit}
              errors={fieldErrors}
              onChannelNameChange={setChannelName}
              onChannelPrivacyChange={setChannelPrivacy}
              onMemberLimitChange={setMemberLimit}
              onCreateChannel={handleCreateChannel}
              currentUserId={currentUserId}
              onChannelsRefresh={() => void refreshAll()}
            />
          </TabsContent>

          <TabsContent value="tracks" className="m-0 focus-visible:outline-none">
            <TrackLibrarySection
              tracks={tracks}
              trackTitle={trackTitle}
              trackVisibility={trackVisibility}
              selectedTrackFileName={trackFile?.name}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              errors={fieldErrors}
              onTrackTitleChange={setTrackTitle}
              onTrackVisibilityChange={setTrackVisibility}
              onTrackFileChange={handleTrackFileSelect}
              onTrackFileDrop={handleTrackFileSelect}
              onUploadTrack={handleUploadTrack}
            />
          </TabsContent>

          <TabsContent value="playlists" className="m-0 focus-visible:outline-none">
            <PlaylistManager />
          </TabsContent>

          <TabsContent value="sharing" className="m-0 focus-visible:outline-none">
            <TrackSharingSection
              tracks={tracks}
              users={users}
              channels={channels}
              trackShares={trackShares}
              shareTrackId={shareTrackId}
              shareUserId={shareUserId}
              shareChannelId={shareChannelId}
              onShareTrackIdChange={handleTrackSelection}
              onShareUserIdChange={setShareUserId}
              onShareChannelIdChange={setShareChannelId}
              onAddShare={handleAddShare}
              onRemoveShare={handleRemoveShare}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
