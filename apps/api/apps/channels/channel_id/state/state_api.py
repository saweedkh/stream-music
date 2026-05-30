"""Channel API — ChannelStateView."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.user_badges import is_platform_superuser
from apps.channels.helpers import _channel_closed_response
from apps.channels.models import Channel
from apps.playback.models import PlaybackSession
from apps.playback.serializers.playback_serializers import PlaybackSessionSerializer
from apps.playback.services.state_store import playback_state_store


class ChannelStateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        from apps.channels.serializers.channel_serializers import ChannelSerializer

        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active and channel.owner_id != request.user.id and not is_platform_superuser(request.user):
            return _channel_closed_response()
        playback_session, _ = PlaybackSession.objects.get_or_create(channel=channel)
        playback_data = PlaybackSessionSerializer(playback_session).data
        snapshot = playback_state_store.get_playback_snapshot(channel.id)
        if snapshot:
            playback_data["started_at_server_time"] = snapshot.get("started_at_server_time")
            snapshot_position = snapshot.get("position")
            if snapshot_position is not None:
                playback_data["paused_at_position"] = snapshot_position
            playback_data["is_playing"] = bool(snapshot.get("is_playing"))
            playback_data["queue_version"] = snapshot.get("queue_version", playback_data.get("queue_version", 0))
            track = snapshot.get("track")
            if isinstance(track, dict):
                merged_track = dict(playback_data.get("track") or {})
                merged_track.update({k: track.get(k) for k in ["id", "title", "artist", "file"] if k in track})
                playback_data["track"] = merged_track
        return Response(
            {
                "channel": ChannelSerializer(channel, context={"request": request}).data,
                "playback": playback_data,
            }
        )
