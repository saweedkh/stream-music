"""Channel queue read/update orchestration."""

from __future__ import annotations

import time

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response

from apps.channels.api.helpers import (
    _channel_closed_response,
    _queue_serialize_context,
    _serialize_queue,
)
from apps.channels.models import Channel, ChannelMembership
from apps.common.user_badges import is_platform_superuser
from apps.playback.models import PlaybackSession
from apps.playback.permissions import can_control_channel
from apps.playback.services.state_store import playback_state_store
from apps.playlists.api.serializers import QueueItemSerializer
from apps.playlists.models import ChannelQueueItem, ChannelQueueUpvote


def _member_or_superuser(user, channel_id: int) -> bool:
    if is_platform_superuser(user):
        return True
    return ChannelMembership.objects.filter(channel_id=channel_id, user=user, is_active=True).exists()


def get_channel_queue(user, channel_id: int) -> Response:
    if not _member_or_superuser(user, channel_id):
        return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
    channel = get_object_or_404(Channel, id=channel_id)
    if not channel.is_active:
        return _channel_closed_response()
    serialized = _serialize_queue(channel_id, user.id)
    playback_state_store.save_queue_snapshot(channel_id, list(serialized))
    return Response({"results": serialized})


def _bump_queue_version(channel_id: int) -> None:
    session, _ = PlaybackSession.objects.get_or_create(channel_id=channel_id)
    session.queue_version += 1
    session.save(update_fields=["queue_version", "updated_at"])


def reorder_queue_item(user, channel_id: int, item_id: int, position: int) -> Response:
    if not can_control_channel(user, channel_id):
        return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
    channel = get_object_or_404(Channel, id=channel_id)
    if not channel.is_active:
        return _channel_closed_response()
    item = get_object_or_404(ChannelQueueItem, id=item_id, channel_id=channel_id)
    new_position = max(0, int(position))
    rows = list(ChannelQueueItem.objects.filter(channel_id=channel_id).order_by("position", "id"))
    rows = [row for row in rows if row.id != item.id]
    if new_position > len(rows):
        new_position = len(rows)
    rows.insert(new_position, item)
    for index, row in enumerate(rows):
        if row.position != index:
            row.position = index
            row.save(update_fields=["position"])
    item.refresh_from_db()
    _bump_queue_version(channel_id)
    serialized = _serialize_queue(channel_id, user.id)
    ctx = _queue_serialize_context(channel_id, user.id, [item.id])
    playback_state_store.save_queue_snapshot(channel_id, serialized)
    return Response(QueueItemSerializer(item, context=ctx).data)


def delete_queue_item(user, channel_id: int, item_id: int) -> Response:
    if not can_control_channel(user, channel_id):
        return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
    channel = get_object_or_404(Channel, id=channel_id)
    if not channel.is_active:
        return _channel_closed_response()
    item = get_object_or_404(ChannelQueueItem, id=item_id, channel_id=channel_id)
    item.delete()
    rows = list(ChannelQueueItem.objects.filter(channel_id=channel_id).order_by("position", "id"))
    for index, row in enumerate(rows):
        if row.position != index:
            row.position = index
            row.save(update_fields=["position"])
    _bump_queue_version(channel_id)
    serialized = _serialize_queue(channel_id, user.id)
    playback_state_store.save_queue_snapshot(channel_id, serialized)
    return Response(status=status.HTTP_204_NO_CONTENT)


def _broadcast_queue(channel_id: int, serialized: list) -> None:
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(
        f"channel_{channel_id}",
        {
            "type": "broadcast_event",
            "payload": {
                "type": "QUEUE_UPDATED",
                "action": "queue_updated",
                "channel_id": channel_id,
                "queue": serialized,
            },
        },
    )


def upvote_queue_item(user, channel_id: int, item_id: int) -> Response:
    if not _member_or_superuser(user, channel_id):
        return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
    channel = get_object_or_404(Channel, id=channel_id)
    if not channel.is_active:
        return _channel_closed_response()
    item = get_object_or_404(ChannelQueueItem, id=item_id, channel_id=channel_id)
    ChannelQueueUpvote.objects.get_or_create(queue_item=item, user=user)
    serialized = _serialize_queue(channel_id, user.id)
    playback_state_store.save_queue_snapshot(channel_id, serialized)
    _broadcast_queue(channel_id, serialized)
    ctx = _queue_serialize_context(channel_id, user.id, [item.id])
    return Response(QueueItemSerializer(item, context=ctx).data, status=status.HTTP_201_CREATED)


def remove_queue_upvote(user, channel_id: int, item_id: int) -> Response:
    if not _member_or_superuser(user, channel_id):
        return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
    ChannelQueueUpvote.objects.filter(
        queue_item_id=item_id, queue_item__channel_id=channel_id, user=user
    ).delete()
    serialized = _serialize_queue(channel_id, user.id)
    playback_state_store.save_queue_snapshot(channel_id, serialized)
    _broadcast_queue(channel_id, serialized)
    return Response(status=status.HTTP_204_NO_CONTENT)


def jump_to_queue_item(user, channel_id: int, item_id: int) -> Response:
    from apps.channels.services.playback_control import build_control_payload
    from apps.playback.api.serializers import PlaybackSessionSerializer

    if not can_control_channel(user, channel_id):
        return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
    channel = get_object_or_404(Channel, id=channel_id)
    if not channel.is_active:
        return _channel_closed_response()
    item = get_object_or_404(ChannelQueueItem, id=item_id, channel_id=channel_id)
    session, _ = PlaybackSession.objects.get_or_create(channel_id=channel_id)
    session.track = item.track
    session.is_playing = True
    session.started_at_server_time = time.time()
    session.paused_at_position = 0
    session.queue_version += 1
    session.save(
        update_fields=[
            "track",
            "is_playing",
            "started_at_server_time",
            "paused_at_position",
            "queue_version",
            "updated_at",
        ]
    )
    payload = build_control_payload(channel_id, "play", session, 0.0, channel)
    payload["track"] = {
        "id": session.track.id,
        "title": session.track.title,
        "artist": session.track.artist,
        "file": session.track.file.url if session.track.file else None,
    }
    playback_state_store.save_playback_snapshot(channel_id, payload)
    channel_layer = get_channel_layer()
    if channel_layer is not None:
        async_to_sync(channel_layer.group_send)(
            f"channel_{channel_id}", {"type": "broadcast_event", "payload": payload}
        )
    return Response({"playback": PlaybackSessionSerializer(session).data})
