"""Channel API — ChannelControlView."""

from __future__ import annotations

from rest_framework import permissions
from rest_framework.views import APIView

from apps.channels.models import Channel
from apps.playback.models import PlaybackSession


class ChannelControlView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _event_type(action: str) -> str:
        from apps.channels.services.playback_control import playback_event_type

        return playback_event_type(action)

    @staticmethod
    def _build_control_payload(
        channel_id: int,
        action: str,
        playback_session: PlaybackSession,
        position: float | None,
        channel: Channel | None = None,
    ):
        from apps.channels.services.playback_control import build_control_payload

        return build_control_payload(channel_id, action, playback_session, position, channel)

    def post(self, request, channel_id: int):
        from apps.channels.services.playback_control import apply_channel_control

        return apply_channel_control(request, channel_id)
