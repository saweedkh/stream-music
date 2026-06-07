from django.urls import path

from apps.admin_panel.admin.admin_api import (
    AdminBadgeDetailView,
    AdminBadgesView,
    AdminChannelDetailView,
    AdminChannelsView,
    AdminHealthView,
    AdminOverviewView,
    AdminTrackImportsView,
    AdminUserDetailView,
    AdminUsersView,
)
from apps.admin_panel.admin.admin_content_api import (
    AdminPlaylistDetailView,
    AdminPlaylistsView,
    AdminTrackDetailView,
    AdminTracksView,
)
from apps.admin_panel.admin.admin_ops_api import (
    AdminJoinRequestsView,
    AdminLiveSessionsView,
    AdminModerationReportDetailView,
    AdminModerationReportsView,
    AdminPremiumRedemptionsView,
    AdminSuggestionsView,
)
from apps.admin_panel.admin.admin_analytics_api import (
    AdminAnalyticsChannelDetailView,
    AdminAnalyticsChannelsView,
    AdminAnalyticsGamificationView,
    AdminAnalyticsOverviewView,
)
from apps.admin_panel.admin.admin_audit_api import AdminAuditLogView
from apps.admin_panel.admin.admin_social_api import (
    AdminSocialActivityView,
    AdminSocialChannelFollowsView,
    AdminSocialOverviewView,
    AdminSocialProfileDetailView,
    AdminSocialProfilesView,
    AdminSocialReferralsView,
    AdminSocialUserFollowsView,
)
from apps.admin_panel.admin.admin_billing_api import (
    AdminBillingOverviewView,
    AdminBillingPremiumUsersView,
    AdminBillingReferralSignupsExportView,
    AdminBillingReferralSignupsView,
    AdminBillingStripePurchasesExportView,
    AdminBillingStripePurchasesView,
)
from apps.admin_panel.admin.admin_integrations_api import (
    AdminIntegrationsApiTokensView,
    AdminIntegrationsDeliveriesExportView,
    AdminIntegrationsDeliveriesView,
    AdminIntegrationsOverviewView,
    AdminIntegrationsWebhookDetailView,
    AdminIntegrationsWebhooksView,
)
from apps.admin_panel.admin.premium_codes_api import AdminPremiumCodeDetailView, AdminPremiumCodesView

urlpatterns = [
    path("admin/overview", AdminOverviewView.as_view()),
    path("admin/users", AdminUsersView.as_view()),
    path("admin/users/<int:user_id>", AdminUserDetailView.as_view()),
    path("admin/badges", AdminBadgesView.as_view()),
    path("admin/badges/<int:badge_id>", AdminBadgeDetailView.as_view()),
    path("admin/channels", AdminChannelsView.as_view()),
    path("admin/channels/<int:channel_id>", AdminChannelDetailView.as_view()),
    path("admin/tracks", AdminTracksView.as_view()),
    path("admin/tracks/<int:track_id>", AdminTrackDetailView.as_view()),
    path("admin/playlists", AdminPlaylistsView.as_view()),
    path("admin/playlists/<int:playlist_id>", AdminPlaylistDetailView.as_view()),
    path("admin/health", AdminHealthView.as_view()),
    path("admin/track-imports", AdminTrackImportsView.as_view()),
    path("admin/premium-codes", AdminPremiumCodesView.as_view()),
    path("admin/premium-codes/<int:code_id>", AdminPremiumCodeDetailView.as_view()),
    path("admin/moderation/reports", AdminModerationReportsView.as_view()),
    path("admin/moderation/reports/<int:report_id>", AdminModerationReportDetailView.as_view()),
    path("admin/join-requests", AdminJoinRequestsView.as_view()),
    path("admin/live-sessions", AdminLiveSessionsView.as_view()),
    path("admin/premium-redemptions", AdminPremiumRedemptionsView.as_view()),
    path("admin/suggestions", AdminSuggestionsView.as_view()),
    path("admin/analytics/overview", AdminAnalyticsOverviewView.as_view()),
    path("admin/analytics/channels", AdminAnalyticsChannelsView.as_view()),
    path("admin/analytics/channels/<int:channel_id>", AdminAnalyticsChannelDetailView.as_view()),
    path("admin/analytics/gamification", AdminAnalyticsGamificationView.as_view()),
    path("admin/social/overview", AdminSocialOverviewView.as_view()),
    path("admin/social/profiles", AdminSocialProfilesView.as_view()),
    path("admin/social/profiles/<int:user_id>", AdminSocialProfileDetailView.as_view()),
    path("admin/social/channel-follows", AdminSocialChannelFollowsView.as_view()),
    path("admin/social/user-follows", AdminSocialUserFollowsView.as_view()),
    path("admin/social/referrals", AdminSocialReferralsView.as_view()),
    path("admin/social/activity", AdminSocialActivityView.as_view()),
    path("admin/audit-log", AdminAuditLogView.as_view()),
    path("admin/billing/overview", AdminBillingOverviewView.as_view()),
    path("admin/billing/stripe-purchases", AdminBillingStripePurchasesView.as_view()),
    path("admin/billing/stripe-purchases/export", AdminBillingStripePurchasesExportView.as_view()),
    path("admin/billing/premium-users", AdminBillingPremiumUsersView.as_view()),
    path("admin/billing/referral-signups", AdminBillingReferralSignupsView.as_view()),
    path("admin/billing/referral-signups/export", AdminBillingReferralSignupsExportView.as_view()),
    path("admin/integrations/overview", AdminIntegrationsOverviewView.as_view()),
    path("admin/integrations/webhooks", AdminIntegrationsWebhooksView.as_view()),
    path("admin/integrations/webhooks/<int:webhook_id>", AdminIntegrationsWebhookDetailView.as_view()),
    path("admin/integrations/deliveries", AdminIntegrationsDeliveriesView.as_view()),
    path("admin/integrations/deliveries/export", AdminIntegrationsDeliveriesExportView.as_view()),
    path("admin/integrations/api-tokens", AdminIntegrationsApiTokensView.as_view()),
]
