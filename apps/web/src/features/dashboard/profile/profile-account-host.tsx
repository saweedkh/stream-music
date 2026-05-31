"use client";

import type { AccountDashboardTab } from "@/features/dashboard/model/dashboard-types";
import { ProfilePageProvider } from "@/features/dashboard/profile/context/profile-page-context";
import { useProfilePage } from "@/features/dashboard/profile/hooks/use-profile-page";
import { AccountPage } from "@/features/dashboard/profile/pages/account-page";
import { NotificationsPage } from "@/features/dashboard/profile/pages/notifications-page";
import { SecurityPage } from "@/features/dashboard/profile/pages/security-page";
import { ProfileGate } from "@/features/dashboard/profile/ui/profile-gate";
import { ProfileLoadingState } from "@/features/dashboard/profile/ui/profile-loading-state";

export type ProfileAccountHostProps = {
  tab: AccountDashboardTab;
  channelCount: number;
  trackCount: number;
  playlistCount: number;
};

export function ProfileAccountHost({ tab, channelCount, trackCount, playlistCount }: ProfileAccountHostProps) {
  const state = useProfilePage();

  if (state.loading) {
    return <ProfileLoadingState />;
  }

  if (!state.user) {
    return <ProfileGate />;
  }

  return (
    <ProfilePageProvider value={state}>
      {tab === "profile" ? (
        <AccountPage channelCount={channelCount} trackCount={trackCount} playlistCount={playlistCount} />
      ) : null}
      {tab === "security" ? <SecurityPage /> : null}
      {tab === "notifications" ? <NotificationsPage /> : null}
    </ProfilePageProvider>
  );
}
