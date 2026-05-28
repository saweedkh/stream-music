from types import SimpleNamespace

from django.test import SimpleTestCase

from apps.channels.api.views.playback import ChannelControlView
from apps.playback.consumers import ChannelPlaybackConsumer


class ControlContractTests(SimpleTestCase):
    def test_control_payload_contract_shape(self):
        session = SimpleNamespace(started_at_server_time=1710000000.0, is_playing=True, queue_version=3, track=None)
        payload = ChannelControlView._build_control_payload(
            channel_id=7,
            action="play",
            playback_session=session,
            position=12.5,
        )
        self.assertEqual(payload["type"], "PLAY")
        self.assertEqual(payload["action"], "play")
        self.assertEqual(payload["channel_id"], 7)
        self.assertEqual(payload["started_at_server_time"], 1710000000.0)
        self.assertEqual(payload["position"], 12.5)
        self.assertTrue(payload["is_playing"])
        self.assertEqual(payload["queue_version"], 3)
        self.assertIn("server_time", payload)

    def test_ws_action_normalization(self):
        self.assertEqual(ChannelPlaybackConsumer._normalize_action("PLAY"), "play")
        self.assertEqual(ChannelPlaybackConsumer._normalize_action("seek"), "seek")
        self.assertEqual(ChannelPlaybackConsumer._normalize_action("play_playlist"), "play_playlist")
        self.assertEqual(ChannelPlaybackConsumer._normalize_action("add_to_queue"), "add_to_queue")
        self.assertEqual(ChannelPlaybackConsumer._normalize_action("enqueue_next"), "enqueue_next")
        self.assertEqual(ChannelPlaybackConsumer._normalize_action("auto_next"), "auto_next")
        self.assertIsNone(ChannelPlaybackConsumer._normalize_action("PING_LATENCY"))
        self.assertIsNone(ChannelPlaybackConsumer._normalize_action("drop_db"))

    def test_ws_incoming_action_text_only_strings(self):
        self.assertEqual(ChannelPlaybackConsumer._incoming_action_text(" play "), "play")
        self.assertEqual(ChannelPlaybackConsumer._incoming_action_text(" PING_LATENCY "), "PING_LATENCY")
        self.assertIsNone(ChannelPlaybackConsumer._incoming_action_text("   "))
        self.assertIsNone(ChannelPlaybackConsumer._incoming_action_text(None))
        self.assertIsNone(ChannelPlaybackConsumer._incoming_action_text(1))
