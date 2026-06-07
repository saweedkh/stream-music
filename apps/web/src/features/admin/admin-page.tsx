"use client";

import { Crown } from "lucide-react";
import { AdminOverviewSection } from "@/features/admin/components/admin-overview-section";
import { AdminAnalyticsSection } from "@/features/admin/components/admin-analytics-section";
import { AdminAuditSection } from "@/features/admin/components/admin-audit-section";
import { AdminBillingSection } from "@/features/admin/components/admin-billing-section";
import { AdminIntegrationsSection } from "@/features/admin/components/admin-integrations-section";
import { AdminSocialSection } from "@/features/admin/components/admin-social-section";
import {
  AdminPlaylistsSection,
  AdminPremiumCodesSection,
  AdminTrackImportsSection,
  AdminTracksSection,
} from "@/features/admin/components/admin-content-sections";
import {
  AdminBadgesSection,
  AdminChannelsSection,
  AdminSystemSection,
  AdminUsersSection,
} from "@/features/admin/components/admin-management-sections";
import {
  AdminJoinRequestsSection,
  AdminLiveSection,
  AdminModerationSection,
  AdminRedemptionsSection,
  AdminSuggestionsSection,
} from "@/features/admin/components/admin-operations-sections";
import { AdminSupportSection } from "@/features/admin/components/admin-support-section";
import type { AdminSection } from "@/features/admin/model/admin-nav";
import { adminSectionMeta } from "@/features/admin/model/admin-nav";
import { useTranslations } from "@/shared/providers/locale-provider";
import { cn } from "@/lib/utils";

export type { AdminSection };

export function AdminPage({ activeSection }: { activeSection: AdminSection }) {
  const { t } = useTranslations();
  const meta = adminSectionMeta(activeSection);

  return (
    <div className="min-w-0 space-y-5">
      <header className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.08] via-card to-card px-5 py-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Crown className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700/80 dark:text-amber-400/90">
              {t("admin.panelEyebrow")}
            </p>
            <h1 className="font-display text-xl font-semibold tracking-tight">{t(meta.titleKey)}</h1>
            {meta.descriptionKey ? (
              <p className="mt-1 text-sm text-muted-foreground">{t(meta.descriptionKey)}</p>
            ) : null}
          </div>
        </div>
      </header>

      <div className={cn("animate-in fade-in duration-300")}>
        {activeSection === "overview" ? <AdminOverviewSection /> : null}
        {activeSection === "analytics" ? <AdminAnalyticsSection /> : null}
        {activeSection === "auditLog" ? <AdminAuditSection /> : null}
        {activeSection === "users" ? <AdminUsersSection /> : null}
        {activeSection === "badges" ? <AdminBadgesSection /> : null}
        {activeSection === "premium" ? <AdminPremiumCodesSection /> : null}
        {activeSection === "redemptions" ? <AdminRedemptionsSection /> : null}
        {activeSection === "billing" ? <AdminBillingSection /> : null}
        {activeSection === "social" ? <AdminSocialSection /> : null}
        {activeSection === "channels" ? <AdminChannelsSection /> : null}
        {activeSection === "tracks" ? <AdminTracksSection /> : null}
        {activeSection === "playlists" ? <AdminPlaylistsSection /> : null}
        {activeSection === "imports" ? <AdminTrackImportsSection /> : null}
        {activeSection === "support" ? <AdminSupportSection /> : null}
        {activeSection === "moderation" ? <AdminModerationSection /> : null}
        {activeSection === "joinRequests" ? <AdminJoinRequestsSection /> : null}
        {activeSection === "suggestions" ? <AdminSuggestionsSection /> : null}
        {activeSection === "live" ? <AdminLiveSection /> : null}
        {activeSection === "integrations" ? <AdminIntegrationsSection /> : null}
        {activeSection === "system" ? <AdminSystemSection /> : null}
      </div>
    </div>
  );
}
