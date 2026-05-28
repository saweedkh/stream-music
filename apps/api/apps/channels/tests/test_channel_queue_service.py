"""Unit tests for channel queue service helpers."""

from django.test import SimpleTestCase

from apps.channels.services.channel_queue import _member_or_superuser


class ChannelQueueServiceTests(SimpleTestCase):
    def test_member_or_superuser_false_for_anonymous(self):
        from django.contrib.auth.models import AnonymousUser

        self.assertFalse(_member_or_superuser(AnonymousUser(), 1))
