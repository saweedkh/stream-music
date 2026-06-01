from django.contrib.auth.models import User
from django.db import IntegrityError
from django.test import TestCase

from apps.channels.models import Channel, ChannelMembership, InviteToken


class ChannelModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="alice", password="pw")

    def test_create_channel_defaults(self):
        ch = Channel.objects.create(name="Lofi Beats", owner=self.user)
        self.assertEqual(ch.name, "Lofi Beats")
        self.assertEqual(ch.privacy, Channel.Privacy.PUBLIC)
        self.assertEqual(ch.member_limit, 50)
        self.assertTrue(ch.is_active)
        self.assertIsNotNone(ch.public_slug)
        self.assertIsNone(ch.public_join_slug)

    def test_privacy_choices(self):
        for value, _label in Channel.Privacy.choices:
            ch = Channel.objects.create(name=f"Room-{value}", owner=self.user, privacy=value)
            self.assertEqual(ch.privacy, value)

    def test_public_slug_is_unique(self):
        ch1 = Channel.objects.create(name="A", owner=self.user)
        ch2 = Channel.objects.create(name="B", owner=self.user)
        self.assertNotEqual(ch1.public_slug, ch2.public_slug)


class ChannelMembershipTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pw")
        self.member = User.objects.create_user(username="member", password="pw")
        self.channel = Channel.objects.create(name="Test", owner=self.owner)

    def test_create_membership(self):
        m = ChannelMembership.objects.create(channel=self.channel, user=self.member, role=ChannelMembership.Role.MEMBER)
        self.assertEqual(m.role, "member")
        self.assertTrue(m.is_active)

    def test_unique_together_channel_user(self):
        ChannelMembership.objects.create(channel=self.channel, user=self.member)
        with self.assertRaises(IntegrityError):
            ChannelMembership.objects.create(channel=self.channel, user=self.member)

    def test_role_choices(self):
        self.assertIn("owner", [c[0] for c in ChannelMembership.Role.choices])
        self.assertIn("moderator", [c[0] for c in ChannelMembership.Role.choices])
        self.assertIn("member", [c[0] for c in ChannelMembership.Role.choices])


class InviteTokenTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="alice", password="pw")
        self.channel = Channel.objects.create(name="Room", owner=self.user)

    def test_create_invite(self):
        invite = InviteToken.objects.create(channel=self.channel, created_by=self.user)
        self.assertTrue(invite.is_active)
        self.assertIsNotNone(invite.token)
        self.assertEqual(invite.max_uses, 0)
        self.assertEqual(invite.used_count, 0)

    def test_invite_tokens_are_unique(self):
        t1 = InviteToken.objects.create(channel=self.channel, created_by=self.user)
        t2 = InviteToken.objects.create(channel=self.channel, created_by=self.user)
        self.assertNotEqual(t1.token, t2.token)
