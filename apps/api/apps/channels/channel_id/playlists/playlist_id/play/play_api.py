"""Channel API — ChannelPlayPlaylistView."""

from __future__ import annotations

import time

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.user_badges import is_platform_superuser
from apps.channels.channel_id.control.control_api import ChannelControlView
from apps.channels.helpers import _channel_closed_response, _log_channel_audit, _record_playback_event
from apps.channels.models import Channel
from apps.core.services.webpush import notify_channel_room_started_push
from apps.playback.models import PlaybackSession
from apps.playback.permissions import can_control_channel
from apps.playback.serializers.playback_serializers import PlaybackSessionSerializer
from apps.playback.services.queue_advance import set_active_playlist, set_playback_source
from apps.playback.services.state_store import playback_state_store
from apps.playlists.models import ChannelQueueItem, Playlist
from apps.playlists.playlists.playlist_serializers import QueueItemSerializer


class ChannelPlayPlaylistView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int, playlist_id: int):
        if not can_control_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)

        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active:
            return _channel_closed_response()
        playlist = get_object_or_404(Playlist, id=playlist_id)
        if (
            not is_platform_superuser(request.user)
            and playlist.owner_id != request.user.id
            and playlist.channel_id != channel.id
        ):
            return Response({"detail": "playlist_not_allowed"}, status=status.HTTP_403_FORBIDDEN)

        items = list(playlist.items.select_related("track").all())
        if not items:
            return Response({"detail": "playlist_empty"}, status=status.HTTP_400_BAD_REQUEST)

        raw_start = request.data.get("start_index")
        start_index = 0
        if raw_start is not None and raw_start != "":
            try:
                start_index = max(0, min(int(raw_start), len(items) - 1))
            except (TypeError, ValueError):
                start_index = 0

        ChannelQueueItem.objects.filter(channel=channel).delete()
        queue_rows = [
            ChannelQueueItem(channel=channel, track=item.track, position=index, added_by=request.user)
            for index, item in enumerate(items)
        ]
        ChannelQueueItem.objects.bulk_create(queue_rows)
        set_active_playlist(channel, playlist.id, playlist.name)
        set_playback_source(channel, "playlist")

        playback_session, _ = PlaybackSession.objects.get_or_create(channel=channel)
        playback_session.track = items[start_index].track
        playback_session.is_playing = True
        playback_session.started_at_server_time = time.time()
        playback_session.paused_at_position = 0
        playback_session.queue_version += 1
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
            "play_playlist",
            actor_id=request.user.id,
            track=playback_session.track,
            source="playlist",
            payload={"playlist_id": playlist.id, "start_index": start_index},
        )
        _log_channel_audit(
            channel.id,
            "playback.play_playlist",
            request.user.id,
            target_type="playlist",
            target_id=playlist.id,
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
        payload["playlist_id"] = playlist.id
        payload["start_index"] = start_index
        payload["track"] = {
            "id": playback_session.track.id,
            "title": playback_session.track.title,
            "artist": playback_session.track.artist,
            "file": playback_session.track.file.url if playback_session.track.file else None,
        }
        queue_serialized = QueueItemSerializer(
            ChannelQueueItem.objects.filter(channel=channel).order_by("position"), many=True
        ).data
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
