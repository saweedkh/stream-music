"""Gamification points tests."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from apps.analytics.services.gamification import add_points, build_gamification_payload
from apps.analytics.models import GamificationPointEvent


class GamificationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("g1", password="pass12345")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_add_points_and_profile(self):
        add_points(self.user.id, 50, GamificationPointEvent.Reason.DAILY)
        payload = build_gamification_payload(self.user.id)
        self.assertGreaterEqual(payload["points"], 50)
        self.assertGreaterEqual(payload["level"], 1)

    def test_me_gamification_api(self):
        add_points(self.user.id, 100, GamificationPointEvent.Reason.CHAT)
        res = self.client.get("/api/auth/me/gamification")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["points"], 100)
