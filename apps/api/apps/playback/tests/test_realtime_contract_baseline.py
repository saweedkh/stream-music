from types import SimpleNamespace

from django.test import SimpleTestCase

from apps.channels.api.views.playback import ChannelControlView
from apps.playback.consumers import ChannelPlaybackConsumer


class RealtimeContractBaselineTests(SimpleTestCase):
    def test_http_control_payload_keeps_required_keys(self):
        session = SimpleNamespace(
            started_at_server_time=1710000000.0,
            is_playing=True,
            queue_version=11,
            track=SimpleNamespace(file=SimpleNamespace(url="/media/audio/demo.mp3")),
        )
        payload = ChannelControlView._build_control_payload(
            channel_id=99,
            action="play",
            playback_session=session,
            position=2.5,
        )
        for key in [
            "type",
            "action",
            "event_seq",
            "channel_id",
            "server_time",
            "started_at_server_time",
            "position",
            "is_playing",
            "queue_version",
            "track_file",
        ]:
            self.assertIn(key, payload)

    def test_ws_payload_builder_keeps_required_keys(self):
        channel = SimpleNamespace(id=5)
        track = SimpleNamespace(id=7, title="Demo", artist="Artist", file=SimpleNamespace(url="/media/audio/demo.mp3"))
        session = SimpleNamespace(
            started_at_server_time=1710000000.0,
            is_playing=True,
            queue_version=3,
            track=track,
        )
        payload = ChannelPlaybackConsumer._build_payload(channel=channel, action="play", playback_session=session, position=0.0)
        for key in [
            "type",
            "action",
            "event_seq",
            "channel_id",
            "server_time",
            "started_at_server_time",
            "position",
            "is_playing",
            "queue_version",
            "track_file",
            "track",
        ]:
            self.assertIn(key, payload)
