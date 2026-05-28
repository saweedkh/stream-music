"""Playback control orchestration for channel rooms."""

from __future__ import annotations

import time

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response

from apps.channels.api.helpers import _channel_closed_response, _log_channel_audit, _record_playback_event
from apps.channels.models import Channel
from apps.core.services.webpush import notify_channel_room_started_push
from apps.playback.models import PlaybackSession
from apps.playback.permissions import can_control_channel
from apps.playback.services.queue_advance import apply_queue_advance, scheduled_start_blocks_playback
from apps.playback.services.state_store import playback_state_store
from apps.playlists.models import ChannelQueueItem


def playback_event_type(action: str) -> str:
    return action.upper()


def build_control_payload(
    channel_id: int,
    action: str,
    playback_session: PlaybackSession,
    position: float | None,
    channel: Channel | None = None,
):
    from apps.playback.services.queue_advance import playback_queue_meta

    if channel is None:
        channel = Channel.objects.filter(id=channel_id).first()
    payload = {
        "type": playback_event_type(action),
        "action": action,
        "event_seq": playback_state_store.next_event_seq(channel_id),
        "channel_id": channel_id,
        "server_time": time.time(),
        "started_at_server_time": playback_session.started_at_server_time,
        "position": position,
        "is_playing": playback_session.is_playing,
        "queue_version": playback_session.queue_version,
        "track_file": playback_session.track.file.url if playback_session.track and playback_session.track.file else None,
    }
    if channel is not None:
        payload.update(playback_queue_meta(channel, playback_session))
    return payload


def apply_channel_control(request, channel_id: int) -> Response:
    """Apply play/pause/seek/next/prev and broadcast WS payload."""
    from apps.playback.api.serializers import PlaybackSessionSerializer  # noqa: PLC0415

    if not can_control_channel(request.user, channel_id):
        return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)

    channel = get_object_or_404(Channel, id=channel_id)
    if not channel.is_active:
        return _channel_closed_response()
    blocked, _scheduled_at = scheduled_start_blocks_playback(channel)
    playback_session, _ = PlaybackSession.objects.get_or_create(channel=channel)
    action = request.data.get("action")
    if blocked and action == "play":
        return Response({"detail": "scheduled_not_started"}, status=status.HTTP_403_FORBIDDEN)
    if action not in {"play", "pause", "seek", "next", "prev"}:
        return Response({"detail": "invalid_action"}, status=status.HTTP_400_BAD_REQUEST)
    position = request.data.get("position")
    if position is not None:
        position = float(position)
    if action == "play":
        if playback_session.track_id is None:
            first_queue_item = ChannelQueueItem.objects.filter(channel=channel).order_by("position").first()
            if first_queue_item:
                playback_session.track = first_queue_item.track
        resume_from = float(position) if position is not None else float(playback_session.paused_at_position or 0)
        playback_session.is_playing = True
        playback_session.started_at_server_time = time.time() - max(0.0, resume_from)
        playback_session.paused_at_position = max(0.0, resume_from)
    elif action == "pause":
        playback_session.is_playing = False
        playback_session.paused_at_position = position if position is not None else float(request.data.get("position", 0))
    elif action == "seek":
        seek_position = position if position is not None else float(request.data.get("position", 0))
        playback_session.paused_at_position = max(0.0, seek_position)
        if playback_session.is_playing:
            playback_session.started_at_server_time = time.time() - playback_session.paused_at_position
    elif action in {"next", "prev"}:
        queue = list(ChannelQueueItem.objects.filter(channel=channel).order_by("position"))
        if queue:
            direction = "next" if action == "next" else "prev"
            target_index = apply_queue_advance(channel, playback_session, queue, direction)
            if target_index is None:
                action = "pause"
        playback_session.queue_version += 1
    playback_session.save(
        update_fields=["is_playing", "started_at_server_time", "paused_at_position", "queue_version", "track", "updated_at"]
    )
    _record_playback_event(
        channel.id,
        action,
        actor_id=request.user.id,
        track=playback_session.track,
        source="control",
        payload={"position": position},
    )
    _log_channel_audit(
        channel.id,
        f"playback.{action}",
        request.user.id,
        target_type="channel",
        target_id=channel.id,
        metadata={"position": position},
    )
    if action == "play":
        notify_channel_room_started_push(channel.id, actor_user_id=request.user.id)

    payload = build_control_payload(
        channel_id=channel.id,
        action=action,
        playback_session=playback_session,
        position=position,
        channel=channel,
    )
    channel_layer = get_channel_layer()
    if channel_layer is not None:
        async_to_sync(channel_layer.group_send)(f"channel_{channel.id}", {"type": "broadcast_event", "payload": payload})
    return Response(PlaybackSessionSerializer(playback_session).data)
