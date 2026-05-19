"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "@/components/providers/locale-provider";
import { useToast } from "@/components/ui/toast-provider";
import { ChannelManagementSection } from "@/features/dashboard/channel-management-section";
import { DashboardShell } from "@/features/dashboard/dashboard-shell";
import { DashboardPanelShell } from "@/features/dashboard/dashboard-panel-shell";
import {
  adminSectionFromSearch,
  profileSectionFromSearch,
  type AdminSection,
  type ProfileSection,
} from "@/features/dashboard/dashboard-nav-config";
import { type DashboardTab, isDashboardTab } from "@/features/dashboard/dashboard-types";
import { AdminPanelHub } from "@/features/dashboard/admin-panel-hub";
import { SupportHub } from "@/features/dashboard/support-hub";
import { ProfileFavoritesPanel } from "@/features/dashboard/profile-favorites-panel";
import { UserProfileHub } from "@/features/dashboard/user-profile-hub";
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
  normalizeTrackList,
  setTrackFavorite,
  uploadTrackChunked,
  type ChannelSummary,
  type PlaylistItemSummary,
  type PlaylistSummary,
  type TrackSharePermission,
  type AuthUser,
  type TrackSummary,
} from "@/lib/api";
import { parseAudioFileMetadata } from "@/lib/audio-metadata";
import { loadPendingUpload, type PendingChunkUpload } from "@/lib/resumable-upload";
import { uploadTrackResumable } from "@/lib/resumable-upload";
import { createChannelSchema, createPlaylistSchema, uploadTrackSchema } from "@/lib/validation";

export function DashboardWorkspace() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const profileSection = useMemo(() => profileSectionFromSearch(searchParams), [searchParams]);
  const adminSection = useMemo(() => adminSectionFromSearch(searchParams), [searchParams]);

  const navigateDashboard = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString();
      router.replace(qs.length ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const navigateMainTab = useCallback(
    (tab: Exclude<DashboardTab, "settings" | "admin">) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      params.delete("section");
      params.delete("adminSection");
      navigateDashboard(params);
    },
    [navigateDashboard, searchParams],
  );

  const navigateProfileSection = useCallback(
    (section: ProfileSection) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "settings");
      if (section === "overview") params.delete("section");
      else params.set("section", section);
      params.delete("adminSection");
      navigateDashboard(params);
    },
    [navigateDashboard, searchParams],
  );

  const navigateAdminSection = useCallback(
    (section: AdminSection) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "admin");
      if (section === "overview") params.delete("adminSection");
      else params.set("adminSection", section);
      params.delete("section");
      navigateDashboard(params);
    },
    [navigateDashboard, searchParams],
  );
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
  const [pendingUpload, setPendingUpload] = useState<PendingChunkUpload | null>(null);

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
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>(isDashboardTab(tabFromUrl) ? tabFromUrl : "channels");
  const [tracksFavoritesOnly, setTracksFavoritesOnly] = useState(false);
  const [favoriteBusyTrackId, setFavoriteBusyTrackId] = useState<number | null>(null);

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
    void parseAudioFileMetadata(file).then((meta) => {
      if (meta.title) setTrackTitle((current) => (current.trim() ? current : meta.title!));
    });
    setFieldErrors((prev) => {
      const { trackFile: _trackFile, trackTitle: _trackTitle, ...rest } = prev;
      return rest;
    });
  }

  async function loadTracksForLibrary(favoritedOnly: boolean) {
    const data = await listTracks(favoritedOnly ? { favorited: true } : {});
    setTracks(normalizeTrackList(data));
  }

  async function handleTrackFavoriteToggle(trackId: number, next: boolean) {
    setFavoriteBusyTrackId(trackId);
    try {
      await setTrackFavorite(trackId, next);
      if (tracksFavoritesOnly && !next) {
        setTracks((prev) => prev.filter((t) => t.id !== trackId));
      } else {
        setTracks((prev) => prev.map((t) => (t.id === trackId ? { ...t, is_favorited: next } : t)));
      }
      showToast(t("favorites.updated"), "success");
    } catch {
      showToast(t("favorites.updateFailed"), "error");
    } finally {
      setFavoriteBusyTrackId(null);
    }
  }

  async function handleTracksFavoritesOnlyChange(on: boolean) {
    setTracksFavoritesOnly(on);
    try {
      await loadTracksForLibrary(on);
    } catch {
      showToast(t("dashboard.loadFailed"), "error");
    }
  }

  async function refreshAll() {
    setIsLoading(true);
    try {
      const me = await getMe();
      setCurrentUser(me?.user ?? null);
      setCurrentUserId(me?.user?.id ?? null);
      const [c, trackData, p, u] = await Promise.all([
        listChannels(),
        listTracks(tracksFavoritesOnly ? { favorited: true } : {}),
        listPlaylists(),
        listUsers(),
      ]);
      const pi = await listPlaylistItems();
      setChannels(c);
      setTracks(normalizeTrackList(trackData));
      setPlaylists(p);
      setPlaylistItems(pi);
      setUsers(u.results);
    } catch {
      setStatus(t("dashboard.loadFailed"));
      showToast(t("dashboard.loadFailed"), "error");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  useEffect(() => {
    setPendingUpload(loadPendingUpload());
  }, []);

  useEffect(() => {
    const queryTab = searchParams.get("tab");
    const legacySection = searchParams.get("section");
    if (queryTab === "settings" && (legacySection === "favoriteTracks" || legacySection === "favoritePlaylists")) {
      navigateMainTab(legacySection);
      return;
    }
    if (!isDashboardTab(queryTab)) return;
    if (queryTab === "admin" && currentUser && !currentUser.is_superuser) {
      navigateMainTab("channels");
      return;
    }
    setActiveTab(queryTab);
  }, [searchParams, currentUser, navigateMainTab]);

  async function handleCreateChannel() {
    const result = createChannelSchema(t).safeParse({ channelName, memberLimit });
    const nextErrors: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? "");
        if (field === "channelName" || field === "memberLimit") nextErrors[field] = issue.message;
      }
    }
    setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
    if (Object.keys(nextErrors).length) {
      showToast(t("dashboard.fixChannelFields"), "error");
      return;
    }
    try {
      await createChannel({ name: channelName, privacy: channelPrivacy, member_limit: Number(memberLimit) || 50 });
      setStatus(t("dashboard.channelCreated"));
      showToast(t("dashboard.channelCreated"), "success");
      setChannelName("");
      await refreshAll();
    } catch {
      setStatus(t("dashboard.createChannelFailed"));
      showToast(t("dashboard.createChannelFailed"), "error");
    }
  }

  async function handleUploadTrack() {
    const normalizedTitle = trackTitle.trim() || (trackFile ? deriveTitleFromFile(trackFile) : "");
    const result = uploadTrackSchema(t).safeParse({ trackTitle: normalizedTitle, trackFile });
    const nextErrors: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? "");
        if (field === "trackTitle" || field === "trackFile") nextErrors[field] = issue.message;
      }
    }
    setFieldErrors((prev) => ({ ...prev, ...nextErrors }));
    if (Object.keys(nextErrors).length) {
      showToast(t("dashboard.fixTrackFields"), "error");
      return;
    }
    if (!trackFile) return;
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setTrackTitle(normalizedTitle);
      await uploadTrackResumable(
        uploadTrackChunked,
        { title: normalizedTitle, visibility: trackVisibility, file: trackFile },
        { onProgress: setUploadProgress },
      );
      setStatus(t("dashboard.trackUploaded"));
      showToast(t("dashboard.trackUploaded"), "success");
      setTrackTitle("");
      setTrackFile(null);
      setUploadProgress(100);
      await refreshAll();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("dashboard.uploadFailed");
      setStatus(message);
      showToast(message, "error");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCreatePlaylist() {
    const result = createPlaylistSchema(t).safeParse({ playlistName });
    if (!result.success) {
      setFieldErrors((prev) => ({ ...prev, playlistName: result.error.issues[0]?.message ?? t("validation.playlistNameRequired") }));
      showToast(t("dashboard.enterPlaylistName"), "error");
      return;
    }
    try {
      await createPlaylist({ name: playlistName, channel: playlistChannel !== "none" ? Number(playlistChannel) : null });
      setStatus(t("dashboard.playlistCreated"));
      showToast(t("dashboard.playlistCreated"), "success");
      setPlaylistName("");
      setPlaylistChannel("none");
      await refreshAll();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("dashboard.createPlaylistFailed");
      setStatus(message);
      showToast(message, "error");
    }
  }

  async function handleAddPlaylistItem() {
    if (!itemPlaylistId || !itemTrackId) {
      showToast(t("dashboard.selectPlaylistAndTrack"), "error");
      return;
    }
    try {
      const playlistId = Number(itemPlaylistId);
      const trackId = Number(itemTrackId);
      const position = playlistItems.filter((item) => item.playlist === playlistId).length;
      await addPlaylistItem({ playlist: playlistId, track: trackId, position });
      setStatus(t("dashboard.trackAddedToPlaylist"));
      showToast(t("dashboard.trackAddedToPlaylist"), "success");
      setItemPlaylistId("");
      setItemTrackId("");
      await refreshAll();
    } catch {
      setStatus(t("dashboard.cannotAddToPlaylist"));
      showToast(t("dashboard.cannotAddToPlaylist"), "error");
    }
  }

  async function handleReorderPlaylist(draggingId: number, dropIndex: number) {
    try {
      await reorderPlaylistItem(draggingId, dropIndex);
      setStatus(t("dashboard.playlistReordered"));
      showToast(t("dashboard.playlistReordered"), "success");
      await refreshAll();
    } catch {
      setStatus(t("dashboard.cannotReorderPlaylist"));
      showToast(t("dashboard.cannotReorderPlaylist"), "error");
    }
  }

  if (isLoading) {
    return (
      <DashboardShell
        activeTab={activeTab}
        activeProfileSection={profileSection}
        activeAdminSection={adminSection}
        onSelectMainTab={navigateMainTab}
        onSelectProfileSection={navigateProfileSection}
        onSelectAdminSection={navigateAdminSection}
      >
        <DashboardPanelShell
          tab={activeTab}
          profileSection={activeTab === "settings" ? profileSection : undefined}
          adminSection={activeTab === "admin" ? adminSection : undefined}
          className="lg:min-h-0 lg:flex-1"
        >
          <div className="space-y-4">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </DashboardPanelShell>
      </DashboardShell>
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
      setStatus(t("dashboard.cannotLoadShares"));
      showToast(t("dashboard.cannotLoadShares"), "error");
    }
  }

  async function handleAddShare() {
    if (!shareTrackId || (!shareUserId && !shareChannelId)) {
      showToast(t("dashboard.selectTrackAndTarget"), "error");
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
      setStatus(t("dashboard.shareAdded"));
      showToast(t("dashboard.shareAdded"), "success");
    } catch {
      setStatus(t("dashboard.cannotAddShare"));
      showToast(t("dashboard.cannotAddShare"), "error");
    }
  }

  async function handleRemoveShare(shareId: number) {
    if (!shareTrackId) return;
    try {
      await removeTrackSharePermission(Number(shareTrackId), shareId);
      const rows = await listTrackSharePermissions(Number(shareTrackId));
      setTrackShares(rows.results);
      setStatus(t("dashboard.shareRemoved"));
      showToast(t("dashboard.shareRemoved"), "success");
    } catch {
      setStatus(t("dashboard.cannotRemoveShare"));
      showToast(t("dashboard.cannotRemoveShare"), "error");
    }
  }

  const interruptedUploadAlert = pendingUpload ? (
    <Alert tone="info" className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm">
        {t("dashboard.interruptedUpload")} <strong>{pendingUpload.fileName}</strong> (
        {Math.round((pendingUpload.written / Math.max(1, pendingUpload.fileSize)) * 100)}% {t("dashboard.done")})
      </span>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setTrackTitle(pendingUpload.title);
          setTrackVisibility(pendingUpload.visibility as TrackSummary["visibility"]);
          if (activeTab !== "tracks") navigateMainTab("tracks");
          showToast(t("dashboard.resumeUploadHint"), "info");
        }}
      >
        {t("dashboard.resumeUpload")}
      </Button>
    </Alert>
  ) : null;

  return (
    <DashboardShell
      activeTab={activeTab}
      activeProfileSection={profileSection}
      activeAdminSection={adminSection}
      onSelectMainTab={navigateMainTab}
      onSelectProfileSection={navigateProfileSection}
      onSelectAdminSection={navigateAdminSection}
    >
      <DashboardPanelShell
        tab={activeTab}
        profileSection={activeTab === "settings" ? profileSection : undefined}
        adminSection={activeTab === "admin" ? adminSection : undefined}
        flush={activeTab === "playlists" || activeTab === "support"}
        className="lg:min-h-0 lg:flex-1"
      >
        {pendingUpload && activeTab !== "tracks" ? interruptedUploadAlert : null}

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
            currentUserId={currentUserId}
            onChannelsRefresh={() => void refreshAll()}
          />
        ) : null}

        {activeTab === "tracks" ? (
          <>
            {interruptedUploadAlert}
            <TrackLibrarySection
              tracks={tracks}
              trackTitle={trackTitle}
              trackVisibility={trackVisibility}
              selectedTrackFileName={trackFile?.name}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              errors={fieldErrors}
              favoritesOnly={tracksFavoritesOnly}
              favoriteBusyTrackId={favoriteBusyTrackId}
              onTrackTitleChange={setTrackTitle}
              onTrackVisibilityChange={setTrackVisibility}
              onTrackFileChange={handleTrackFileSelect}
              onTrackFileDrop={handleTrackFileSelect}
              onUploadTrack={handleUploadTrack}
              onFavoritesOnlyChange={(on) => void handleTracksFavoritesOnlyChange(on)}
              onToggleFavorite={(trackId, next) => void handleTrackFavoriteToggle(trackId, next)}
            />
          </>
        ) : null}

        {activeTab === "playlists" ? <PlaylistManager /> : null}

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

        {activeTab === "support" ? <SupportHub user={currentUser} /> : null}

        {activeTab === "favoritePlaylists" ? <ProfileFavoritesPanel kind="playlists" /> : null}

        {activeTab === "favoriteTracks" ? <ProfileFavoritesPanel kind="tracks" /> : null}

        {activeTab === "settings" ? (
          <UserProfileHub
            activeSection={profileSection}
            channelCount={channels.length}
            trackCount={tracks.length}
            playlistCount={playlists.length}
          />
        ) : null}

        {activeTab === "admin" && currentUser?.is_superuser ? (
          <AdminPanelHub activeSection={adminSection} />
        ) : null}
      </DashboardPanelShell>
    </DashboardShell>
  );
}
