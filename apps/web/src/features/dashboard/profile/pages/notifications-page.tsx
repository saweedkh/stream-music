"use client";

import { NotificationPreferencesCard } from "@/features/dashboard/components/notification-preferences-card";
import { WorkspacePage } from "@/shared/layout/workspace";

export function NotificationsPage() {
  return (
    <WorkspacePage className="max-w-3xl">
      <NotificationPreferencesCard variant="plain" />
    </WorkspacePage>
  );
}
