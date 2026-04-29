"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { ChannelManagementSection } from "@/features/dashboard/channel-management-section";
import { PlaylistBuilderSection } from "@/features/dashboard/playlist-builder-section";
import { TrackLibrarySection } from "@/features/dashboard/track-library-section";
import { TrackSharingSection } from "@/features/dashboard/track-sharing-section";
import {
  addPlaylistItem,
  addTrackSharePermission,
  createChannel,
  createPlaylist,
  listChannels,
  listPlaylistItems,
  listPlaylists,
  listTracks,
  listTrackSharePermissions,
  listUsers,
  removeTrackSharePermission,
  reorderPlaylistItem,
  uploadTrack,
  type ChannelSummary,
  type PlaylistItemSummary,
  type PlaylistSummary,
  type TrackSharePermission,
  type TrackSummary,
} from "@/lib/api";
import { createChannelSchema, createPlaylistSchema, uploadTrackSchema } from "@/lib/validation";

export function DashboardWorkspace() {
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [playlistItems, setPlaylistItems] = useState<PlaylistItemSummary[]>([]);
  const [users, setUsers] = useState<Array<{ id: number; username: string }>>([]);
  const [trackShares, setTrackShares] = useState<TrackSharePermission[]>([]);
  const [status, setStatus] = useState<string | null>(null);

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
    setFieldErrors((prev) => ({ ...prev, trackFile: undefined, trackTitle: undefined }));
  }

  async function refreshAll() {
    try {
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
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeTab, pathname, router, searchParams]);

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
      await uploadTrack(
        { title: normalizedTitle, visibility: trackVisibility, file: trackFile },
        {
          onProgress: setUploadProgress,
          timeoutMs: 1000 * 60 * 20,
        },
      );
      setStatus("Track uploaded.");
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
      setPlaylistName("");
      setPlaylistChannel("none");
      await refreshAll();
    } catch {
      setStatus("Create playlist failed.");
      showToast("Create playlist failed.", "error");
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
      await refreshAll();
    } catch {
      setStatus("Cannot reorder playlist.");
      showToast("Cannot reorder playlist.", "error");
    }
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
    } catch {
      setStatus("Cannot remove share permission.");
      showToast("Cannot remove share permission.", "error");
    }
  }

  return (
    <div className="space-y-5">
      <section className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Your Dashboard</h1>
          <p className="text-sm text-slate-300">Create channels, upload tracks, and manage playlists.</p>
        </div>
        <Button variant="secondary" onClick={refreshAll}>
          Refresh
        </Button>
      </section>

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <aside className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
          <Button variant={activeTab === "channels" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("channels")}>Channels</Button>
          <Button variant={activeTab === "tracks" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("tracks")}>Tracks</Button>
          <Button variant={activeTab === "playlists" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("playlists")}>Playlists</Button>
          <Button variant={activeTab === "sharing" ? "default" : "ghost"} className="w-full justify-start" onClick={() => setActiveTab("sharing")}>Sharing</Button>
        </aside>
        <div className="space-y-4">
          {activeTab === "channels" ? (
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
            />
          ) : null}

          {activeTab === "tracks" ? (
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
          ) : null}

          {activeTab === "playlists" ? (
            <PlaylistBuilderSection
              channels={channels}
              playlists={playlists}
              tracks={tracks}
              groupedPlaylistItems={groupedPlaylistItems}
              playlistName={playlistName}
              playlistChannel={playlistChannel}
              itemPlaylistId={itemPlaylistId}
              itemTrackId={itemTrackId}
              errors={fieldErrors}
              onPlaylistNameChange={setPlaylistName}
              onPlaylistChannelChange={setPlaylistChannel}
              onItemPlaylistIdChange={setItemPlaylistId}
              onItemTrackIdChange={setItemTrackId}
              onCreatePlaylist={handleCreatePlaylist}
              onAddPlaylistItem={handleAddPlaylistItem}
              onReorderDrop={handleReorderPlaylist}
              setDraggingPlaylistItemId={setDraggingPlaylistItemId}
              draggingPlaylistItemId={draggingPlaylistItemId}
            />
          ) : null}

          {activeTab === "sharing" ? (
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
          ) : null}
        </div>
      </div>

      {status ? <Alert>{status}</Alert> : null}
    </div>
  );
}
