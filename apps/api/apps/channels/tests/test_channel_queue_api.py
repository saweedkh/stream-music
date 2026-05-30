"""Channel queue list and upvote API tests."""

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from apps.channels.models import Channel, ChannelMembership
from apps.playlists.models import ChannelQueueItem
from apps.tracks.models import Track


def _audio() -> SimpleUploadedFile:
    return SimpleUploadedFile("q.mp3", b"x", content_type="audio/mpeg")


class ChannelQueueApiTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="qowner", password="pw123456")
        self.member = User.objects.create_user(username="qmember", password="pw123456")
        self.channel = Channel.objects.create(name="Queue Room", owner=self.owner)
        ChannelMembership.objects.create(
            channel=self.channel, user=self.owner, role=ChannelMembership.Role.OWNER, is_active=True
        )
        ChannelMembership.objects.create(channel=self.channel, user=self.member, is_active=True)
        self.track = Track.objects.create(
            owner=self.owner,
            title="Queued",
            artist="",
            album="",
            file=_audio(),
            visibility=Track.Visibility.PUBLIC_LAN,
        )
        self.item = ChannelQueueItem.objects.create(
            channel=self.channel, track=self.track, position=0, added_by=self.owner
        )

    def test_get_queue_as_member(self):
        self.client.force_authenticate(user=self.member)
        res = self.client.get(f"/api/channels/{self.channel.id}/queue")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in res.data["results"]]
        self.assertIn(self.item.id, ids)

    def test_get_queue_denied_for_guest(self):
        res = self.client.get(f"/api/channels/{self.channel.id}/queue")
        self.assertIn(res.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_upvote_queue_item(self):
        from unittest.mock import patch

        self.client.force_authenticate(user=self.member)
        with patch("apps.channels.services.channel_queue.get_channel_layer", return_value=None):
            res = self.client.post(f"/api/channels/{self.channel.id}/queue/{self.item.id}/upvote")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertGreaterEqual(res.data.get("upvote_count", 0), 1)
