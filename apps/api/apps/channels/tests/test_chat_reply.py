"""Chat reply_to persistence (complements Playwright e2e)."""

from django.contrib.auth.models import User
from django.test import TestCase

from apps.channels.chat_service import apply_chat_send
from apps.channels.models import Channel, ChannelChatMessage, ChannelMembership


class ChatReplyTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="pw")
        self.member = User.objects.create_user(username="member", password="pw")
        self.channel = Channel.objects.create(name="Test", owner=self.owner, privacy=Channel.Privacy.PUBLIC)
        ChannelMembership.objects.create(channel=self.channel, user=self.owner, role=ChannelMembership.Role.OWNER)
        ChannelMembership.objects.create(channel=self.channel, user=self.member, role=ChannelMembership.Role.MEMBER)

    def test_reply_links_parent_message(self):
        parent, err = apply_chat_send(self.channel.id, self.member, "Hello room")
        self.assertIsNone(err)
        assert parent is not None
        reply, err2 = apply_chat_send(self.channel.id, self.owner, "Hi back", reply_to_id=parent["id"])
        self.assertIsNone(err2)
        assert reply is not None
        self.assertEqual(reply["reply_to_id"], parent["id"])
        self.assertEqual(reply["reply_preview"]["username"], "member")
        row = ChannelChatMessage.objects.get(id=reply["id"])
        self.assertEqual(row.reply_to_id, parent["id"])
