"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ProfilePageState } from "@/features/dashboard/profile/hooks/use-profile-page";

const ProfilePageContext = createContext<ProfilePageState | null>(null);

export function ProfilePageProvider({ value, children }: { value: ProfilePageState; children: ReactNode }) {
  return <ProfilePageContext.Provider value={value}>{children}</ProfilePageContext.Provider>;
}

export function useProfilePageContext(): ProfilePageState {
  const ctx = useContext(ProfilePageContext);
  if (!ctx) {
    throw new Error("useProfilePageContext must be used within ProfilePageProvider");
  }
  return ctx;
}
