"""Admin portal API integration tests."""

from __future__ import annotations

from rest_framework import status

from apps.admin_panel.models import PlatformAdminAuditLog
from apps.admin_panel.tests.helpers import AdminApiTestCase
from apps.analytics.models import ChannelAnalytics, UserGamificationProfile
from apps.channels.models import ChannelChatReport, ChannelJoinRequest, ChannelMembership, ChannelPlaylistSuggestion
from apps.social.models import ActivityEvent, ChannelFollow, UserFollow


class AdminCoreApiTests(AdminApiTestCase):
    def test_overview_requires_superuser(self):
        self.assert_forbidden_for_non_superuser("get", "/api/admin/overview")

    def test_overview_returns_counts(self):
        res = self.client.get("/api/admin/overview")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("users", res.data)
        self.assertIn("pending", res.data)
        self.assertGreaterEqual(res.data["users"]["total"], 3)

    def test_users_list_and_detail(self):
        res = self.client.get("/api/admin/users", {"search": "member"})
        self.assert_paginated_ok(res)
        self.assertTrue(any(row["username"] == "member" for row in res.data["results"]))

        detail = self.client.get(f"/api/admin/users/{self.user.id}")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["username"], "member")

    def test_health(self):
        res = self.client.get("/api/admin/health")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("db", res.data)


class AdminBillingApiTests(AdminApiTestCase):
    def test_billing_overview(self):
        self.assert_forbidden_for_non_superuser("get", "/api/admin/billing/overview")
        res = self.client.get("/api/admin/billing/overview")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("stripe_purchases", res.data)
        self.assertIn("trends", res.data)
        self.assertEqual(len(res.data["trends"]["stripe_purchases"]), 30)

    def test_billing_overview_date_filter(self):
        res = self.client.get("/api/admin/billing/overview", {"date_from": "2099-01-01"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["stripe_purchases"], 0)
        self.assertEqual(res.data["referral_signups"], 0)

    def test_stripe_purchases_list_search_and_export(self):
        res = self.client.get("/api/admin/billing/stripe-purchases", {"search": "member"})
        self.assert_paginated_ok(res)
        self.assertGreaterEqual(res.data["total"], 1)

        export = self.client.get("/api/admin/billing/stripe-purchases/export")
        self.assertEqual(export.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", export["Content-Type"])
        body = export.content.decode("utf-8")
        self.assertIn("stripe_session_id", body)
        self.assertIn("cs_admin_test_1", body)

    def test_premium_users_list(self):
        res = self.client.get("/api/admin/billing/premium-users", {"search": "member"})
        self.assert_paginated_ok(res)
        self.assertTrue(any(row["username"] == "member" for row in res.data["results"]))

    def test_referral_signups_list_and_export(self):
        res = self.client.get("/api/admin/billing/referral-signups", {"search": "ADMINTEST"})
        self.assert_paginated_ok(res)
        self.assertGreaterEqual(res.data["total"], 1)

        export = self.client.get("/api/admin/billing/referral-signups/export")
        self.assertEqual(export.status_code, status.HTTP_200_OK)
        self.assertIn("ADMINTEST", export.content.decode("utf-8"))


class AdminIntegrationsApiTests(AdminApiTestCase):
    def test_integrations_overview(self):
        self.assert_forbidden_for_non_superuser("get", "/api/admin/integrations/overview")
        res = self.client.get("/api/admin/integrations/overview")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res.data["webhooks_total"], 1)

    def test_webhooks_list_and_patch(self):
        res = self.client.get("/api/admin/integrations/webhooks", {"search": "member"})
        self.assert_paginated_ok(res)
        self.assertGreaterEqual(res.data["total"], 1)

        patch = self.client.patch(
            f"/api/admin/integrations/webhooks/{self.webhook.id}",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(patch.status_code, status.HTTP_200_OK)
        self.assertFalse(patch.data["is_active"])
        self.assertTrue(
            PlatformAdminAuditLog.objects.filter(action="webhook.update", target_id=str(self.webhook.id)).exists()
        )

    def test_deliveries_list_export_and_date_filter(self):
        res = self.client.get("/api/admin/integrations/deliveries", {"search": "channel.live"})
        self.assert_paginated_ok(res)
        self.assertGreaterEqual(res.data["total"], 1)

        filtered = self.client.get("/api/admin/integrations/deliveries", {"date_from": "2099-01-01"})
        self.assertEqual(filtered.status_code, status.HTTP_200_OK)
        self.assertEqual(filtered.data["total"], 0)

        export = self.client.get("/api/admin/integrations/deliveries/export")
        self.assertEqual(export.status_code, status.HTTP_200_OK)
        self.assertIn("channel.live", export.content.decode("utf-8"))

    def test_api_tokens_list(self):
        res = self.client.get("/api/admin/integrations/api-tokens", {"search": "admin-test-token"})
        self.assert_paginated_ok(res)
        self.assertGreaterEqual(res.data["total"], 1)


class AdminSocialApiTests(AdminApiTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        UserFollow.objects.create(follower=cls.other, following=cls.user)
        ChannelFollow.objects.create(user=cls.other, channel=cls.channel)
        ActivityEvent.objects.create(
            actor=cls.user,
            kind=ActivityEvent.Kind.CHANNEL_LIVE,
            channel=cls.channel,
            metadata={"source": "test"},
        )

    def test_social_overview(self):
        res = self.client.get("/api/admin/social/overview")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("profiles", res.data)
        self.assertIn("referrals", res.data)

    def test_profiles_list_and_patch(self):
        res = self.client.get("/api/admin/social/profiles", {"search": "member", "is_public": "true"})
        self.assert_paginated_ok(res)
        self.assertTrue(any(row["username"] == "member" for row in res.data["results"]))

        patch = self.client.patch(
            f"/api/admin/social/profiles/{self.user.id}",
            {"bio": "Updated by admin", "is_public": False},
            format="json",
        )
        self.assertEqual(patch.status_code, status.HTTP_200_OK)
        self.assertEqual(patch.data["bio"], "Updated by admin")
        self.assertFalse(patch.data["is_public"])

    def test_follows_referrals_activity(self):
        for url in (
            "/api/admin/social/channel-follows",
            "/api/admin/social/user-follows",
            "/api/admin/social/referrals",
            "/api/admin/social/activity",
        ):
            res = self.client.get(url)
            self.assert_paginated_ok(res)
            self.assertGreaterEqual(res.data["total"], 1, msg=url)


class AdminAnalyticsApiTests(AdminApiTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        ChannelAnalytics.objects.create(
            channel=cls.channel,
            total_listen_seconds=7200,
            total_play_events=12,
            unique_listener_count=2,
        )
        UserGamificationProfile.objects.create(user=cls.user, points=1200, streak_days=3, lifetime_listen_seconds=3600)

    def test_analytics_overview(self):
        res = self.client.get("/api/admin/analytics/overview")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("listen", res.data)
        self.assertIn("gamification", res.data)

    def test_analytics_channels_search(self):
        res = self.client.get("/api/admin/analytics/channels", {"search": "Admin Test"})
        self.assert_paginated_ok(res)
        self.assertGreaterEqual(res.data["total"], 1)

    def test_analytics_channel_detail(self):
        res = self.client.get(f"/api/admin/analytics/channels/{self.channel.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["channel_name"], "Admin Test Room")

        missing = self.client.get("/api/admin/analytics/channels/999999")
        self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)

    def test_gamification_list(self):
        res = self.client.get("/api/admin/analytics/gamification", {"search": "member"})
        self.assert_paginated_ok(res)
        self.assertTrue(any(row["username"] == "member" for row in res.data["results"]))


class AdminOpsApiTests(AdminApiTestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        ChannelMembership.objects.create(channel=cls.channel, user=cls.user, role=ChannelMembership.Role.OWNER)
        ChannelJoinRequest.objects.create(channel=cls.channel, user=cls.other)
        ChannelPlaylistSuggestion.objects.create(
            channel=cls.channel,
            user=cls.other,
            external_title="Suggested Track",
        )

    def test_ops_endpoints(self):
        endpoints = (
            "/api/admin/moderation/reports",
            "/api/admin/join-requests",
            "/api/admin/suggestions",
            "/api/admin/live-sessions",
            "/api/admin/premium-redemptions",
        )
        for url in endpoints:
            self.assert_forbidden_for_non_superuser("get", url)
            res = self.client.get(url)
            self.assert_paginated_ok(res)


class AdminAuditApiTests(AdminApiTestCase):
    def test_audit_log_lists_webhook_action(self):
        self.client.patch(
            f"/api/admin/integrations/webhooks/{self.webhook.id}",
            {"is_active": True},
            format="json",
        )
        res = self.client.get("/api/admin/audit-log", {"search": "webhook.update"})
        self.assert_paginated_ok(res)
        self.assertGreaterEqual(res.data["total"], 1)

    def test_audit_log_filters(self):
        res = self.client.get(
            "/api/admin/audit-log",
            {"action": "webhook.update", "target_type": "webhook_subscription"},
        )
        self.assert_paginated_ok(res)


class AdminContentApiTests(AdminApiTestCase):
    def test_tracks_playlists_premium_codes(self):
        for url in ("/api/admin/tracks", "/api/admin/playlists", "/api/admin/premium-codes"):
            self.assert_forbidden_for_non_superuser("get", url)
            res = self.client.get(url)
            self.assert_paginated_ok(res)

    def test_track_imports_still_work(self):
        res = self.client.get("/api/admin/track-imports")
        self.assert_paginated_ok(res)
