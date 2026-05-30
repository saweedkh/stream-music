"""Channel API — ChannelShufflePlayView."""

from __future__ import annotations

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.channel_id.control.control_api import ChannelControlView
from apps.channels.helpers import _channel_closed_response, _log_channel_audit, _record_playback_event
from apps.channels.models import Channel
from apps.core.services.webpush import notify_channel_room_started_push
from apps.playback.models import PlaybackSession
from apps.playback.permissions import can_control_channel
from apps.playback.serializers.playback_serializers import PlaybackSessionSerializer
from apps.playback.services.channel_queue import (
    MAX_SHUFFLE_TRACKS,
    apply_track_to_session,
    pick_shuffled_tracks,
    replace_queue_with_tracks,
)
from apps.playback.services.queue_advance import clear_active_playlist, set_playback_source
from apps.playback.services.state_store import playback_state_store
from apps.playlists.playlists.playlist_serializers import QueueItemSerializer


class ChannelShufflePlayView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        if not can_control_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)

        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active:
            return _channel_closed_response()
        raw = request.data.get("limit")
        if raw in (None, ""):
            limit = None
        else:
            try:
                limit = int(raw)
            except (TypeError, ValueError):
                limit = None
            if limit is not None and limit <= 0:
                limit = None
            elif limit is not None:
                limit = min(limit, MAX_SHUFFLE_TRACKS)
        ex = channel.experience if isinstance(channel.experience, dict) else {}
        try:
            anti_repeat_window = max(0, int(ex.get("anti_repeat_window") or 0))
        except (TypeError, ValueError):
            anti_repeat_window = 0
        try:
            weighted_bias = max(0.0, min(2.0, float(ex.get("weighted_shuffle_bias") or 0.0)))
        except (TypeError, ValueError):
            weighted_bias = 0.0
        tracks = pick_shuffled_tracks(
            request.user,
            channel,
            limit,
            anti_repeat_window=anti_repeat_window,
            weighted_bias=weighted_bias,
        )
        if not tracks:
            return Response({"detail": "no_tracks"}, status=status.HTTP_400_BAD_REQUEST)

        clear_active_playlist(channel)
        set_playback_source(channel, "shuffle")
        persisted_rows = replace_queue_with_tracks(channel=channel, tracks=tracks, user_id=request.user.id)
        playback_session, _ = PlaybackSession.objects.get_or_create(channel=channel)
        apply_track_to_session(playback_session, tracks[0])
        playback_session.save(
            update_fields=[
                "track",
                "is_playing",
                "started_at_server_time",
                "paused_at_position",
                "queue_version",
                "updated_at",
            ]
        )
        _record_playback_event(
            channel.id,
            "shuffle_play",
            actor_id=request.user.id,
            track=playback_session.track,
            source="shuffle",
            payload={"limit": limit},
        )
        _log_channel_audit(
            channel.id,
            "playback.shuffle_play",
            request.user.id,
            target_type="channel",
            target_id=channel.id,
            metadata={"limit": limit},
        )
        notify_channel_room_started_push(channel.id, actor_user_id=request.user.id)

        payload = ChannelControlView._build_control_payload(
            channel_id=channel.id,
            action="play",
            playback_session=playback_session,
            position=0.0,
            channel=channel,
        )
        payload["track_file"] = (
            playback_session.track.file.url if playback_session.track and playback_session.track.file else None
        )
        payload["shuffle"] = True
        payload["track"] = {
            "id": playback_session.track.id,
            "title": playback_session.track.title,
            "artist": playback_session.track.artist,
            "file": playback_session.track.file.url if playback_session.track.file else None,
        }
        queue_serialized = QueueItemSerializer(persisted_rows, many=True).data
        playback_state_store.save_playback_snapshot(channel.id, payload)
        playback_state_store.save_queue_snapshot(channel.id, list(queue_serialized))

        channel_layer = get_channel_layer()
        if channel_layer is not None:
            async_to_sync(channel_layer.group_send)(
                f"channel_{channel.id}", {"type": "broadcast_event", "payload": payload}
            )

        return Response(
            {
                "playback": PlaybackSessionSerializer(playback_session).data,
                "queue": queue_serialized,
            }
        )
