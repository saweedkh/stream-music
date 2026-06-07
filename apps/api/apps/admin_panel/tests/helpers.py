"""Shared fixtures for admin API tests."""

from __future__ import annotations

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import SLUG_PREMIUM, UserBadgeDefinition
from apps.accounts.services.stripe_premium import grant_premium_from_stripe
from apps.channels.models import Channel
from apps.integrations.models import WebhookDeliveryLog, WebhookSubscription
from apps.integrations.services.api_tokens import create_api_token
from apps.social.models import ReferralCode, ReferralSignup, UserPublicProfile
from apps.social.services.referral import apply_referral_on_signup


class AdminApiTestCase(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_superuser("admintest", "admin@test.com", "pw12345678")
        cls.user = User.objects.create_user("member", email="member@test.com", password="pw12345678")
        cls.other = User.objects.create_user("other", email="other@test.com", password="pw12345678")
        UserBadgeDefinition.objects.get_or_create(
            slug=SLUG_PREMIUM,
            defaults={"label": "Premium", "priority": 50, "is_system": True},
        )
        cls.channel = Channel.objects.create(name="Admin Test Room", owner=cls.user, privacy=Channel.Privacy.PUBLIC)
        cls.profile = UserPublicProfile.objects.create(user=cls.user, bio="Hello", is_public=True)
        cls.referral = ReferralCode.objects.create(user=cls.user, code="ADMINTEST")
        apply_referral_on_signup(user_id=cls.other.id, raw_code=cls.referral.code)
        grant_premium_from_stripe(
            cls.user.id,
            session_id="cs_admin_test_1",
            session={"amount_total": 999, "currency": "usd"},
        )
        cls.webhook = WebhookSubscription.objects.create(
            owner=cls.user,
            url="https://example.com/hook",
            events=["channel.live"],
        )
        WebhookDeliveryLog.objects.create(
            subscription=cls.webhook,
            event="channel.live",
            status_code=200,
            success=True,
        )
        create_api_token(cls.user.id, "admin-test-token")

    def setUp(self):
        self.client.force_authenticate(user=self.admin)

    def assert_forbidden_for_non_superuser(self, method: str, url: str, **kwargs):
        self.client.force_authenticate(user=self.user)
        response = getattr(self.client, method)(url, **kwargs)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(user=self.admin)

    def assert_paginated_ok(self, response):
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertIn("total", response.data)
        self.assertIn("offset", response.data)
        self.assertIn("limit", response.data)
