"""Webhooks and API token tests."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from apps.integrations.models import WebhookSubscription
from apps.integrations.services.api_tokens import create_api_token, user_from_bearer_token


class IntegrationsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("intuser", password="pass12345")
        self.client = APIClient()

    def test_api_token_auth(self):
        _, raw = create_api_token(self.user.id, "ci")
        u = user_from_bearer_token(f"Bearer {raw}")
        self.assertEqual(u.id, self.user.id)

    def test_public_channels_with_token(self):
        _, raw = create_api_token(self.user.id, "read")
        res = self.client.get("/api/public/v1/channels", HTTP_AUTHORIZATION=f"Bearer {raw}")
        self.assertEqual(res.status_code, 200)
        self.assertIn("results", res.data)

    def test_create_webhook(self):
        self.client.force_authenticate(self.user)
        res = self.client.post(
            "/api/me/webhooks",
            {"url": "https://example.com/hook", "events": ["channel.live"]},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(WebhookSubscription.objects.filter(owner_id=self.user.id).exists())
