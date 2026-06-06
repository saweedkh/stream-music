"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/shared/ui/alert";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { ChannelManagementSection } from "@/features/dashboard/components/channel-management-section";
import { FollowingChannelsSection } from "@/features/dashboard/components/following-channels-section";
import { DashboardShell } from "@/features/dashboard/components/dashboard-shell";
import { DashboardPanelShell } from "@/features/dashboard/components/dashboard-panel-shell";
import { adminSectionFromSearch, adminSectionHref, dashboardTabFromSearch } from "@/features/dashboard/model/dashboard-nav-config";
import {
  isAccountDashboardTab,
  type AccountDashboardTab,
  type DashboardTab,
} from "@/features/dashboard/model/dashboard-types";
import { SupportHub, SupportStaffHub, isSupportStaff } from "@/features/support";
import { UserProfileHub } from "@/features/dashboard/components/user-profile-hub";
import { PlaylistSection } from "@/features/dashboard/components/playlist-section";
import { TrackLibrarySection } from "@/features/dashboard/components/track-library-section";
import { TrackSharingSection } from "@/features/dashboard/components/track-sharing-section";
import {
  addTrackSharePermission,
  createChannel,
  getMe,
  listChannels,
  listPlaylists,
  listTracks,
  listTrackSharePermissions,
  listUsers,
  removeTrackSharePermission,
  normalizeTrackList,
  type ChannelSummary,
  type PlaylistSummary,
  type TrackSharePermission,
  type AuthUser,
  type TrackSummary,
} from "@/lib/api";
import { loadPendingUpload, type PendingChunkUpload } from "@/lib/resumable-upload";
import { createChannelSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";

export function DashboardWorkspace() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabFromUrl = dashboardTabFromSearch(searchParams);

  const navigateDashboard = useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString();
      router.replace(qs.length ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const navigateMainTab = useCallback(
    (tab: DashboardTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      params.delete("section");
      params.delete("adminSection");
      navigateDashboard(params);
    },
    [navigateDashboard, searchParams],
  );

  useEffect(() => {
    if (searchParams.get("tab") !== "admin") return;
    const section = adminSectionFromSearch(searchParams);
    router.replace(adminSectionHref(section));
  }, [router, searchParams]);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [users, setUsers] = useState<Array<{ id: number; username: string }>>([]);
  const [trackShares, setTrackShares] = useState<TrackSharePermission[]>([]);
  const [, setStatus] = useState<string | null>(null);

  const [channelName, setChannelName] = useState("");
  const [channelPrivacy, setChannelPrivacy] = useState<ChannelSummary["privacy"]>("public");
  const [memberLimit, setMemberLimit] = useState("50");

  const [shareTrackId, setShareTrackId] = useState<string>("");
  const [shareUserId, setShareUserId] = useState<string>("");
  const [shareChannelId, setShareChannelId] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>(tabFromUrl);
  const [pendingUpload, setPendingUpload] = useState<PendingChunkUpload | null>(null);
  const [supportScreen, setSupportScreen] = useState<"list" | "chat">("list");

  useEffect(() => {
    if (activeTab !== "support") setSupportScreen("list");
  }, [activeTab]);

  async function refreshTracksForSharing() {
    try {
      const trackData = await listTracks({ limit: 500 });
      setTracks(normalizeTrackList(trackData));
    } catch {
      /* library panel handles its own refresh */
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
        listTracks({ limit: 500 }),
        listPlaylists(),
        listUsers(),
      ]);
      setChannels(c);
      setTracks(normalizeTrackList(trackData));
      setPlaylists(p);
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
    if (queryTab === "favoriteTracks" || legacySection === "favoriteTracks") {
      navigateMainTab("tracks");
      return;
    }
    if (queryTab === "favoritePlaylists" || legacySection === "favoritePlaylists") {
      navigateMainTab("playlists");
      return;
    }
    const resolved = dashboardTabFromSearch(searchParams);
    if (resolved === "support_staff" && currentUser && !isSupportStaff(currentUser)) {
      navigateMainTab("support");
      return;
    }
    if (queryTab === "settings" || searchParams.get("section")) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", resolved);
      params.delete("section");
      navigateDashboard(params);
      return;
    }
    setActiveTab(resolved);
  }, [searchParams, currentUser, navigateMainTab, navigateDashboard]);

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

  if (isLoading) {
    return (
      <DashboardShell activeTab={activeTab} onSelectMainTab={navigateMainTab}>
        <DashboardPanelShell
          tab={activeTab}
          className={cn(
          "lg:min-h-0 lg:flex-1",
          activeTab === "sharing" &&
            "[&_.workspace-panel__body]:[-ms-overflow-style:none] [&_.workspace-panel__body]:[scrollbar-width:none] [&_.workspace-panel__body]:[&::-webkit-scrollbar]:hidden",
        )}
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
    <Alert tone="info" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm">
        {t("dashboard.interruptedUpload")} <strong>{pendingUpload.fileName}</strong> (
        {Math.round((pendingUpload.written / Math.max(1, pendingUpload.fileSize)) * 100)}% {t("dashboard.done")})
      </span>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          if (activeTab !== "tracks") navigateMainTab("tracks");
          showToast(t("dashboard.resumeUploadHint"), "info");
        }}
      >
        {t("dashboard.resumeUpload")}
      </Button>
    </Alert>
  ) : null;

  return (
      <DashboardShell activeTab={activeTab} onSelectMainTab={navigateMainTab}>
        <DashboardPanelShell
          tab={activeTab}
        className={cn(
          "lg:min-h-0 lg:flex-1",
          activeTab === "sharing" &&
            "[&_.workspace-panel__body]:[-ms-overflow-style:none] [&_.workspace-panel__body]:[scrollbar-width:none] [&_.workspace-panel__body]:[&::-webkit-scrollbar]:hidden",
          (activeTab === "support" || activeTab === "support_staff") &&
            supportScreen === "chat" &&
            "[&_.workspace-panel__header]:hidden [&_.workspace-panel__body]:flex [&_.workspace-panel__body]:min-h-0 [&_.workspace-panel__body]:flex-1 [&_.workspace-panel__body]:overflow-hidden [&_.workspace-panel__body]:p-0 max-lg:[&_.workspace-panel__body]:overflow-visible",
        )}
      >
        {pendingUpload && activeTab !== "tracks" ? interruptedUploadAlert : null}

        {activeTab === "following" ? <FollowingChannelsSection /> : null}

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
          <TrackLibrarySection
            onUploadComplete={() => void refreshTracksForSharing()}
            resumeUploadBanner={interruptedUploadAlert}
          />
        ) : null}

        {activeTab === "playlists" ? <PlaylistSection /> : null}

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

        {activeTab === "support" ? <SupportHub user={currentUser} onScreenChange={setSupportScreen} /> : null}

        {activeTab === "support_staff" && isSupportStaff(currentUser) ? (
          <SupportStaffHub onScreenChange={setSupportScreen} />
        ) : null}

        {isAccountDashboardTab(activeTab) ? (
          <UserProfileHub
            tab={activeTab as AccountDashboardTab}
            channelCount={channels.length}
            trackCount={tracks.length}
            playlistCount={playlists.length}
          />
        ) : null}
      </DashboardPanelShell>
    </DashboardShell>
  );
}
