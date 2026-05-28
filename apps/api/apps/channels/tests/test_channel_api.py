from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from apps.channels.models import Channel, ChannelMembership


class ChannelCRUDTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="alice", password="pw")
        self.other = User.objects.create_user(username="bob", password="pw")

    def test_create_channel_authenticated(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post("/api/channels/", {"name": "My Room", "privacy": "public"})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["name"], "My Room")
        self.assertTrue(Channel.objects.filter(name="My Room", owner=self.user).exists())

    def test_create_channel_unauthenticated(self):
        res = self.client.post("/api/channels/", {"name": "Ghost Room", "privacy": "public"})
        self.assertIn(res.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_list_channels(self):
        self.client.force_authenticate(user=self.user)
        Channel.objects.create(name="Room A", owner=self.user)
        Channel.objects.create(name="Room B", owner=self.user)
        ChannelMembership.objects.create(
            channel=Channel.objects.get(name="Room A"), user=self.user, role=ChannelMembership.Role.OWNER
        )
        ChannelMembership.objects.create(
            channel=Channel.objects.get(name="Room B"), user=self.user, role=ChannelMembership.Role.OWNER
        )
        res = self.client.get("/api/channels/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        names = [ch["name"] for ch in res.data]
        self.assertIn("Room A", names)
        self.assertIn("Room B", names)

    def test_channel_detail(self):
        self.client.force_authenticate(user=self.user)
        ch = Channel.objects.create(name="Detail Room", owner=self.user)
        ChannelMembership.objects.create(channel=ch, user=self.user, role=ChannelMembership.Role.OWNER)
        res = self.client.get(f"/api/channels/{ch.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["name"], "Detail Room")


class ChannelJoinLeaveTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pw")
        self.joiner = User.objects.create_user(username="joiner", password="pw")
        self.channel = Channel.objects.create(name="Join Test", owner=self.owner, privacy=Channel.Privacy.PUBLIC)
        ChannelMembership.objects.create(channel=self.channel, user=self.owner, role=ChannelMembership.Role.OWNER)

    def test_join_public_channel(self):
        self.client.force_authenticate(user=self.joiner)
        res = self.client.post(f"/api/channels/{self.channel.id}/join")
        self.assertIn(res.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertTrue(
            ChannelMembership.objects.filter(channel=self.channel, user=self.joiner).exists()
        )

    def test_leave_channel(self):
        self.client.force_authenticate(user=self.joiner)
        ChannelMembership.objects.create(channel=self.channel, user=self.joiner)
        res = self.client.post(f"/api/channels/{self.channel.id}/leave")
        self.assertEqual(res.status_code, status.HTTP_200_OK)


class ChannelMembersTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pw")
        self.member = User.objects.create_user(username="member", password="pw")
        self.channel = Channel.objects.create(name="Members Test", owner=self.owner)
        ChannelMembership.objects.create(channel=self.channel, user=self.owner, role=ChannelMembership.Role.OWNER)
        ChannelMembership.objects.create(channel=self.channel, user=self.member, role=ChannelMembership.Role.MEMBER)

    def test_list_members(self):
        self.client.force_authenticate(user=self.owner)
        res = self.client.get(f"/api/channels/{self.channel.id}/members")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        usernames = [m["username"] for m in res.data["results"]]
        self.assertIn("owner", usernames)
        self.assertIn("member", usernames)

    def test_members_requires_auth(self):
        res = self.client.get(f"/api/channels/{self.channel.id}/members")
        self.assertIn(res.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])
