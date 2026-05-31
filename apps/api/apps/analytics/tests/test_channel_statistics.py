"""Channel analytics API tests."""

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from apps.analytics.models import ChannelAnalytics
from apps.analytics.services.listen_metrics import record_listen_seconds
from apps.channels.models import Channel, ChannelMembership


class ChannelStatisticsTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("owner", password="pass12345")
        self.listener = User.objects.create_user("listener", password="pass12345")
        self.channel = Channel.objects.create(name="Stats Room", owner=self.owner)
        ChannelMembership.objects.create(channel=self.channel, user=self.owner, role="owner")
        ChannelMembership.objects.create(channel=self.channel, user=self.listener, role="member")
        self.client = APIClient()

    def test_public_statistics_after_listen(self):
        record_listen_seconds(self.channel.id, self.listener.id, 120, count_as_play=True)
        self.client.force_authenticate(self.listener)
        res = self.client.get(f"/api/channels/{self.channel.id}/statistics")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["total_listen_seconds"], 120)
        self.assertGreaterEqual(res.data["unique_listeners"], 1)
        row = ChannelAnalytics.objects.get(channel_id=self.channel.id)
        self.assertEqual(row.total_listen_seconds, 120)

    def test_heartbeat_endpoint(self):
        self.client.force_authenticate(self.listener)
        res = self.client.post(
            f"/api/channels/{self.channel.id}/statistics/heartbeat",
            {"seconds": 30},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["ok"])

    def test_detailed_requires_owner_or_premium(self):
        record_listen_seconds(self.channel.id, self.listener.id, 60)
        self.client.force_authenticate(self.listener)
        res = self.client.get(f"/api/channels/{self.channel.id}/statistics/detailed")
        self.assertEqual(res.status_code, 403)
        self.client.force_authenticate(self.owner)
        res2 = self.client.get(f"/api/channels/{self.channel.id}/statistics/detailed")
        self.assertEqual(res2.status_code, 200)
        self.assertIn("top_listeners", res2.data)
