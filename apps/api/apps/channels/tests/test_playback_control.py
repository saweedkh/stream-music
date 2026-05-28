"""Unit tests for playback control payload builder."""

from django.test import SimpleTestCase

from apps.channels.services.playback_control import playback_event_type


class PlaybackControlTests(SimpleTestCase):
    def test_playback_event_type_uppercases(self):
        self.assertEqual(playback_event_type("play"), "PLAY")
        self.assertEqual(playback_event_type("pause"), "PAUSE")
