import json
import re
import time
import uuid
from datetime import timedelta
from urllib.parse import urlparse

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings as django_settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Max, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import (
    Channel,
    ChannelAuditLog,
    ChannelChatMessage,
    ChannelNotificationPreference,
    ChannelPlaylistSuggestion,
    ChannelTrackReaction,
    ChannelJoinRequest,
    ChannelMembership,
    InviteToken,
    UserNotificationSettings,
    WebPushSubscription,
)


from apps.common.serializers import (
    ChannelAuditLogSerializer,
    ChannelSerializer,
    ChannelChatMessageSerializer,
    ChannelNotificationPreferenceSerializer,
    ChannelPlaylistSuggestionSerializer,
    ChannelTrackReactionSerializer,
    ChannelJoinRequestSerializer,
    MembershipSerializer,
    PlaybackEventSerializer,
    PlaybackSessionSerializer,
    PlaylistSerializer,
    PlaylistItemSerializer,
    QueueItemSerializer,
    TrackSerializer,
    AuthUserProfileUpdateSerializer,
    AuthUserSerializer,
    PasswordChangeSerializer,
    InviteTokenSerializer,
    TrackSharePermissionSerializer,
    UserNotificationSettingsSerializer,
)
from apps.common.webpush_service import notify_channel_room_started_push
from apps.playback.models import PlaybackEvent, PlaybackSession
from apps.playback.permissions import can_control_channel
from apps.playback.services.channel_queue import (
    MAX_SHUFFLE_TRACKS,
    apply_track_to_session,
    pick_shuffled_tracks,
    replace_queue_with_tracks,
    tracks_accessible_to_user,
)
from apps.playback.services.queue_advance import (
    apply_queue_advance,
    clear_active_playlist,
    playback_queue_meta,
    scheduled_start_blocks_playback,
    set_active_playlist,
    set_playback_source,
)
from apps.playback.services.state_store import playback_state_store
from apps.tracks.filesystem_import import import_audio_files_under_media
from apps.playlists.models import ChannelQueueItem, ChannelQueueUpvote, Playlist, PlaylistItem
from apps.tracks.models import Track, TrackSharePermission
from apps.common.admin_views import (
    AdminChannelsView,
    AdminHealthView,
    AdminOverviewView,
    AdminUserDetailView,
    AdminUsersView,
)
from apps.common.favorites import UserPlaylistFavorite, UserTrackFavorite
from apps.common.user_badges import is_platform_superuser, user_badge_flags
from apps.channels.api.helpers import (
    _broadcast_queue_updated,
    _broadcast_suggestions_updated,
    _can_copy_playlist_to_channel,
    _can_edit_channel_playlist,
    _can_manage_channel,
    _channel_closed_response,
    _consume_invite,
    _log_channel_audit,
    _normalize_public_join_slug_for_save,
    _playlist_inaccessible_track_ids,
    _record_playback_event,
    _resolve_public_join_segment,
    _queue_serialize_context,
    _serialize_queue,
    _validate_private_invite,
    perform_channel_join,
)


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
        payload["track_file"] = playback_session.track.file.url if playback_session.track and playback_session.track.file else None
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
            async_to_sync(channel_layer.group_send)(f"channel_{channel.id}", {"type": "broadcast_event", "payload": payload})

        return Response(
            {
                "playback": PlaybackSessionSerializer(playback_session).data,
                "queue": queue_serialized,
            }
        )



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



class ChannelPlayPlaylistView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int, playlist_id: int):
        if not can_control_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)

        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active:
            return _channel_closed_response()
        playlist = get_object_or_404(Playlist, id=playlist_id)
        if not is_platform_superuser(request.user) and playlist.owner_id != request.user.id and playlist.channel_id != channel.id:
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
        payload["track_file"] = playback_session.track.file.url if playback_session.track and playback_session.track.file else None
        payload["playlist_id"] = playlist.id
        payload["start_index"] = start_index
        payload["track"] = {
            "id": playback_session.track.id,
            "title": playback_session.track.title,
            "artist": playback_session.track.artist,
            "file": playback_session.track.file.url if playback_session.track.file else None,
        }
        queue_serialized = QueueItemSerializer(ChannelQueueItem.objects.filter(channel=channel).order_by("position"), many=True).data
        playback_state_store.save_playback_snapshot(channel.id, payload)
        playback_state_store.save_queue_snapshot(channel.id, list(queue_serialized))

        channel_layer = get_channel_layer()
        if channel_layer is not None:
            async_to_sync(channel_layer.group_send)(f"channel_{channel.id}", {"type": "broadcast_event", "payload": payload})

        return Response(
            {
                "playback": PlaybackSessionSerializer(playback_session).data,
                "queue": queue_serialized,
            }
        )



class ChannelStateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active and channel.owner_id != request.user.id and not is_platform_superuser(request.user):
            return _channel_closed_response()
        playback_session, _ = PlaybackSession.objects.get_or_create(channel=channel)
        playback_data = PlaybackSessionSerializer(playback_session).data
        snapshot = playback_state_store.get_playback_snapshot(channel.id)
        if snapshot:
            # Redis snapshot is the realtime source of truth; DB remains durable fallback.
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



class ChannelPlayTrackView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int, track_id: int):
        if not can_control_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)

        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active:
            return _channel_closed_response()

        track = get_object_or_404(tracks_accessible_to_user(request.user), id=track_id)
        if not track.file:
            return Response({"detail": "track_no_file"}, status=status.HTTP_400_BAD_REQUEST)

        clear_active_playlist(channel)
        set_playback_source(channel, "manual")
        replace_queue_with_tracks(channel=channel, tracks=[track], user_id=request.user.id)
        playback_session, _ = PlaybackSession.objects.get_or_create(channel=channel)
        apply_track_to_session(playback_session, track)
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
            "play_track",
            actor_id=request.user.id,
            track=track,
            source="manual",
            payload={"track_id": track.id},
        )
        _log_channel_audit(
            channel.id,
            "playback.play_track",
            request.user.id,
            target_type="track",
            target_id=track.id,
        )
        notify_channel_room_started_push(channel.id, actor_user_id=request.user.id)

        payload = ChannelControlView._build_control_payload(
            channel_id=channel.id,
            action="play",
            playback_session=playback_session,
            position=0.0,
            channel=channel,
        )
        payload["track_file"] = playback_session.track.file.url if playback_session.track and playback_session.track.file else None
        payload["track"] = {
            "id": track.id,
            "title": track.title,
            "artist": track.artist,
            "file": track.file.url if track.file else None,
        }
        queue_serialized = QueueItemSerializer(ChannelQueueItem.objects.filter(channel=channel).order_by("position"), many=True).data
        playback_state_store.save_playback_snapshot(channel.id, payload)
        playback_state_store.save_queue_snapshot(channel.id, list(queue_serialized))

        channel_layer = get_channel_layer()
        if channel_layer is not None:
            async_to_sync(channel_layer.group_send)(f"channel_{channel.id}", {"type": "broadcast_event", "payload": payload})

        return Response(
            {
                "playback": PlaybackSessionSerializer(playback_session).data,
                "queue": queue_serialized,
            }
        )



