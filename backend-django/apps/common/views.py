import re
import time
import uuid
from datetime import timedelta
from urllib.parse import urlparse

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import Channel, ChannelJoinRequest, ChannelMembership, InviteToken


def _channel_closed_response():
    return Response({"detail": "channel_closed"}, status=status.HTTP_410_GONE)
from apps.common.serializers import (
    ChannelSerializer,
    ChannelJoinRequestSerializer,
    MembershipSerializer,
    PlaybackSessionSerializer,
    PlaylistSerializer,
    PlaylistItemSerializer,
    QueueItemSerializer,
    TrackSerializer,
    AuthUserSerializer,
    InviteTokenSerializer,
    TrackSharePermissionSerializer,
)
from apps.playback.models import PlaybackSession
from apps.playback.permissions import can_control_channel
from apps.playback.services.channel_queue import (
    MAX_SHUFFLE_TRACKS,
    apply_track_to_session,
    pick_shuffled_tracks,
    replace_queue_with_tracks,
    tracks_accessible_to_user,
)
from apps.playback.services.state_store import playback_state_store
from apps.tracks.filesystem_import import import_audio_files_under_media
from apps.playlists.models import ChannelQueueItem, Playlist, PlaylistItem
from apps.tracks.models import Track, TrackSharePermission


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def api_time(_request):
    return Response({"time": time.time()})


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@ensure_csrf_cookie
def auth_csrf(_request):
    return Response({"detail": "csrf_cookie_set"})


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = (request.data.get("username") or "").strip()
        password = request.data.get("password") or ""
        email = (request.data.get("email") or "").strip()
        if not username or not password:
            return Response({"detail": "username_and_password_required"}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({"detail": "username_taken"}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.create_user(username=username, email=email, password=password)
        login(request, user)
        return Response({"user": AuthUserSerializer(user).data}, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        username = request.data.get("username") or ""
        password = request.data.get("password") or ""
        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response({"detail": "invalid_credentials"}, status=status.HTTP_401_UNAUTHORIZED)
        login(request, user)
        return Response({"user": AuthUserSerializer(user).data})


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({"detail": "logged_out"})


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({"user": AuthUserSerializer(request.user).data})


class UsersListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        users = User.objects.exclude(id=request.user.id).order_by("username")[:100]
        return Response({"results": [{"id": user.id, "username": user.username} for user in users]})


class ChannelViewSet(viewsets.ModelViewSet):
    serializer_class = ChannelSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Channel.objects.select_related("owner").all()

    def get_queryset(self):
        user = self.request.user
        return (
            self.queryset.filter(memberships__user=user)
            .filter(Q(is_active=True) | Q(owner=user))
            .distinct()
        )

    def perform_create(self, serializer):
        channel = serializer.save(owner=self.request.user)
        ChannelMembership.objects.create(channel=channel, user=self.request.user, role=ChannelMembership.Role.OWNER)
        PlaybackSession.objects.get_or_create(channel=channel)

    def _can_manage(self, channel_id: int) -> bool:
        return _can_manage_channel(self.request.user, channel_id)

    def perform_update(self, serializer):
        channel = self.get_object()
        if not self._can_manage(channel.id):
            raise PermissionDenied("permission_denied")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.owner_id != self.request.user.id:
            raise PermissionDenied("only_owner_can_delete_channel")
        playback_state_store.clear_channel(instance.id)
        instance.delete()


class TrackViewSet(viewsets.ModelViewSet):
    serializer_class = TrackSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Track.objects.select_related("owner").all()

    def get_queryset(self):
        return tracks_accessible_to_user(self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class PlaylistViewSet(viewsets.ModelViewSet):
    serializer_class = PlaylistSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Playlist.objects.select_related("owner", "channel").all()

    def get_queryset(self):
        user = self.request.user
        channel_id = self.request.query_params.get("channel")
        if channel_id is not None and channel_id != "":
            try:
                cid = int(channel_id)
            except ValueError:
                return self.queryset.none()
            if not ChannelMembership.objects.filter(channel_id=cid, user=user, is_active=True).exists():
                return self.queryset.none()
            return self.queryset.filter(channel_id=cid)

        return self.queryset.filter(
            Q(owner=user)
            | Q(channel__memberships__user=user, channel__memberships__is_active=True),
        ).distinct()

    def perform_create(self, serializer):
        channel = serializer.validated_data.get("channel")
        if channel is not None and not _can_manage_channel(self.request.user, channel.id):
            raise PermissionDenied("permission_denied")
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        if not _can_edit_channel_playlist(self.request.user, self.get_object()):
            raise PermissionDenied("permission_denied")
        serializer.save()

    def perform_destroy(self, instance):
        if not _can_edit_channel_playlist(self.request.user, instance):
            raise PermissionDenied("permission_denied")
        instance.delete()


class PlaylistItemViewSet(viewsets.ModelViewSet):
    serializer_class = PlaylistItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = PlaylistItem.objects.select_related("playlist", "track").all()

    def get_queryset(self):
        user = self.request.user
        playlist_id = self.request.query_params.get("playlist")
        if playlist_id is not None and playlist_id != "":
            try:
                pid = int(playlist_id)
            except ValueError:
                return PlaylistItem.objects.none()
            playlist = Playlist.objects.filter(id=pid).select_related("channel").first()
            if playlist is None:
                return PlaylistItem.objects.none()
            if playlist.channel_id:
                if not ChannelMembership.objects.filter(channel_id=playlist.channel_id, user=user, is_active=True).exists():
                    return PlaylistItem.objects.none()
            elif playlist.owner_id != user.id:
                return PlaylistItem.objects.none()
            return self.queryset.filter(playlist_id=pid)

        return self.queryset.filter(
            Q(playlist__owner=user)
            | Q(playlist__channel__memberships__user=user, playlist__channel__memberships__is_active=True),
        ).distinct()

    def perform_create(self, serializer):
        playlist = serializer.validated_data["playlist"]
        track = serializer.validated_data["track"]
        if not _can_edit_channel_playlist(self.request.user, playlist):
            raise PermissionDenied("permission_denied")
        can_use_track = track.owner_id == self.request.user.id or track.visibility in {
            Track.Visibility.PUBLIC_LAN,
            Track.Visibility.SHARED_WITH_CHANNELS,
            Track.Visibility.SHARED_WITH_USERS,
        }
        if not can_use_track:
            raise PermissionDenied("track_not_visible")
        serializer.save()

    def partial_update(self, request, *args, **kwargs):
        item = self.get_object()
        if not _can_edit_channel_playlist(request.user, item.playlist):
            raise PermissionDenied("permission_denied")
        if "position" not in request.data:
            return super().partial_update(request, *args, **kwargs)

        new_position = max(0, int(request.data.get("position", 0)))
        rows = list(PlaylistItem.objects.filter(playlist=item.playlist).order_by("position", "id"))
        rows = [row for row in rows if row.id != item.id]
        if new_position > len(rows):
            new_position = len(rows)
        rows.insert(new_position, item)
        for index, row in enumerate(rows):
            if row.position != index:
                row.position = index
                row.save(update_fields=["position"])
        item.refresh_from_db()
        return Response(PlaylistItemSerializer(item).data)

    def perform_destroy(self, instance):
        if not _can_edit_channel_playlist(self.request.user, instance.playlist):
            raise PermissionDenied("permission_denied")
        instance.delete()


class ChannelStateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active and channel.owner_id != request.user.id:
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


class ChannelControlView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _event_type(action: str) -> str:
        return action.upper()

    @staticmethod
    def _build_control_payload(channel_id: int, action: str, playback_session: PlaybackSession, position: float | None):
        return {
            "type": ChannelControlView._event_type(action),
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

    def post(self, request, channel_id: int):
        if not can_control_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)

        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active:
            return _channel_closed_response()
        playback_session, _ = PlaybackSession.objects.get_or_create(channel=channel)
        action = request.data.get("action")
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
                # Keep the server-authoritative timeline aligned after manual seek.
                playback_session.started_at_server_time = time.time() - playback_session.paused_at_position
        elif action in {"next", "prev"}:
            queue = list(ChannelQueueItem.objects.filter(channel=channel).order_by("position"))
            if queue:
                current_index = 0
                if playback_session.track_id is not None:
                    for idx, row in enumerate(queue):
                        if row.track_id == playback_session.track_id:
                            current_index = idx
                            break
                target_index = (current_index + 1) % len(queue) if action == "next" else (current_index - 1) % len(queue)
                playback_session.track = queue[target_index].track
                playback_session.is_playing = True
                playback_session.started_at_server_time = time.time()
                playback_session.paused_at_position = 0
            playback_session.queue_version += 1
        playback_session.save(update_fields=["is_playing", "started_at_server_time", "paused_at_position", "queue_version", "updated_at"])

        payload = self._build_control_payload(channel_id=channel.id, action=action, playback_session=playback_session, position=position)
        channel_layer = get_channel_layer()
        if channel_layer is not None:
            async_to_sync(channel_layer.group_send)(f"channel_{channel.id}", {"type": "broadcast_event", "payload": payload})
        return Response(PlaybackSessionSerializer(playback_session).data)


class ChannelPlayPlaylistView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int, playlist_id: int):
        if not can_control_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)

        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active:
            return _channel_closed_response()
        playlist = get_object_or_404(Playlist, id=playlist_id)
        if playlist.owner_id != request.user.id and playlist.channel_id != channel.id:
            return Response({"detail": "playlist_not_allowed"}, status=status.HTTP_403_FORBIDDEN)

        items = list(playlist.items.select_related("track").all())
        if not items:
            return Response({"detail": "playlist_empty"}, status=status.HTTP_400_BAD_REQUEST)

        ChannelQueueItem.objects.filter(channel=channel).delete()
        queue_rows = [
            ChannelQueueItem(channel=channel, track=item.track, position=index, added_by=request.user)
            for index, item in enumerate(items)
        ]
        ChannelQueueItem.objects.bulk_create(queue_rows)

        playback_session, _ = PlaybackSession.objects.get_or_create(channel=channel)
        playback_session.track = items[0].track
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

        payload = ChannelControlView._build_control_payload(
            channel_id=channel.id,
            action="play",
            playback_session=playback_session,
            position=0.0,
        )
        payload["track_file"] = playback_session.track.file.url if playback_session.track and playback_session.track.file else None
        payload["playlist_id"] = playlist.id
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
        tracks = pick_shuffled_tracks(request.user, channel, limit)
        if not tracks:
            return Response({"detail": "no_tracks"}, status=status.HTTP_400_BAD_REQUEST)

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

        payload = ChannelControlView._build_control_payload(
            channel_id=channel.id,
            action="play",
            playback_session=playback_session,
            position=0.0,
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


class ChannelQueueView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active:
            return _channel_closed_response()
        queue_snapshot = playback_state_store.get_queue_snapshot(channel_id)
        if queue_snapshot is not None:
            return Response({"results": queue_snapshot})
        queue = ChannelQueueItem.objects.filter(channel_id=channel_id).order_by("position", "id")
        serialized = QueueItemSerializer(queue, many=True).data
        playback_state_store.save_queue_snapshot(channel_id, list(serialized))
        return Response({"results": serialized})


class ChannelQueueItemManageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, channel_id: int, item_id: int):
        if not can_control_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active:
            return _channel_closed_response()
        item = get_object_or_404(ChannelQueueItem, id=item_id, channel_id=channel_id)
        new_position = max(0, int(request.data.get("position", 0)))
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
        session, _ = PlaybackSession.objects.get_or_create(channel_id=channel_id)
        session.queue_version += 1
        session.save(update_fields=["queue_version", "updated_at"])
        queue = ChannelQueueItem.objects.filter(channel_id=channel_id).order_by("position", "id")
        playback_state_store.save_queue_snapshot(channel_id, list(QueueItemSerializer(queue, many=True).data))
        return Response(QueueItemSerializer(item).data)

    def delete(self, request, channel_id: int, item_id: int):
        if not can_control_channel(request.user, channel_id):
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
        session, _ = PlaybackSession.objects.get_or_create(channel_id=channel_id)
        session.queue_version += 1
        session.save(update_fields=["queue_version", "updated_at"])
        queue = ChannelQueueItem.objects.filter(channel_id=channel_id).order_by("position", "id")
        playback_state_store.save_queue_snapshot(channel_id, list(QueueItemSerializer(queue, many=True).data))
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChannelQueueJumpView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int, item_id: int):
        if not can_control_channel(request.user, channel_id):
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
            update_fields=["track", "is_playing", "started_at_server_time", "paused_at_position", "queue_version", "updated_at"]
        )
        payload = ChannelControlView._build_control_payload(
            channel_id=channel_id,
            action="play",
            playback_session=session,
            position=0.0,
        )
        payload["track"] = {
            "id": session.track.id,
            "title": session.track.title,
            "artist": session.track.artist,
            "file": session.track.file.url if session.track.file else None,
        }
        playback_state_store.save_playback_snapshot(channel_id, payload)
        channel_layer = get_channel_layer()
        if channel_layer is not None:
            async_to_sync(channel_layer.group_send)(f"channel_{channel_id}", {"type": "broadcast_event", "payload": payload})
        return Response({"playback": PlaybackSessionSerializer(session).data})


class TrackSharePermissionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, track_id: int):
        track = get_object_or_404(Track, id=track_id, owner=request.user)
        shares = track.share_permissions.select_related("user", "channel").order_by("-created_at")
        return Response({"results": TrackSharePermissionSerializer(shares, many=True).data})

    def post(self, request, track_id: int):
        track = get_object_or_404(Track, id=track_id, owner=request.user)
        user_id = request.data.get("user_id")
        channel_id = request.data.get("channel_id")
        if not user_id and not channel_id:
            return Response({"detail": "user_id_or_channel_id_required"}, status=status.HTTP_400_BAD_REQUEST)

        kwargs = {"track": track}
        if user_id:
            kwargs["user"] = get_object_or_404(User, id=int(user_id))
        if channel_id:
            channel = get_object_or_404(Channel, id=int(channel_id))
            if not ChannelMembership.objects.filter(channel=channel, user=request.user, is_active=True).exists():
                return Response({"detail": "channel_not_accessible"}, status=status.HTTP_403_FORBIDDEN)
            kwargs["channel"] = channel
        share, _ = TrackSharePermission.objects.get_or_create(**kwargs)
        return Response(TrackSharePermissionSerializer(share).data, status=status.HTTP_201_CREATED)

    def delete(self, request, track_id: int):
        track = get_object_or_404(Track, id=track_id, owner=request.user)
        share_id = request.data.get("share_id")
        if not share_id:
            return Response({"detail": "share_id_required"}, status=status.HTTP_400_BAD_REQUEST)
        deleted, _ = TrackSharePermission.objects.filter(id=int(share_id), track=track).delete()
        if not deleted:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


def _validate_private_invite(channel: Channel, token_value, user=None) -> tuple[Response | None, InviteToken | None]:
    """Validate private-channel invite. Does not consume a use."""
    if channel.privacy != Channel.Privacy.PRIVATE:
        return None, None
    # Owners reach join without an invite token (e.g. SPA calls POST /join on every channel load).
    if user is not None and channel.owner_id == user.id:
        return None, None
    invite = InviteToken.objects.filter(channel=channel, token=token_value, is_active=True).first()
    if not invite:
        return Response({"detail": "invite_required"}, status=status.HTTP_403_FORBIDDEN), None
    if invite.expires_at and invite.expires_at <= timezone.now():
        return Response({"detail": "invite_expired"}, status=status.HTTP_403_FORBIDDEN), None
    if invite.max_uses and invite.used_count >= invite.max_uses:
        return Response({"detail": "invite_exhausted"}, status=status.HTTP_403_FORBIDDEN), None
    return None, invite


def _consume_invite(invite: InviteToken) -> None:
    invite.used_count += 1
    invite.save(update_fields=["used_count"])


def perform_channel_join(user, channel: Channel, token_value) -> Response:
    """
    If join_requires_approval: create a pending ChannelJoinRequest (private invite use is consumed on approve).
    Otherwise: immediate membership, consuming a private invite now.
    """
    membership = ChannelMembership.objects.filter(channel=channel, user=user).first()
    if membership and membership.is_active:
        if not channel.is_active and channel.owner_id != user.id:
            return _channel_closed_response()
        return Response(MembershipSerializer(membership).data, status=status.HTTP_200_OK)

    # Left the room but membership row remains — allow listing + one-click rejoin.
    if membership and not membership.is_active:
        if not channel.is_active and channel.owner_id != user.id:
            return _channel_closed_response()
        active_members = ChannelMembership.objects.filter(channel=channel, is_active=True).count()
        if active_members >= channel.member_limit:
            return Response({"detail": "channel_full"}, status=status.HTTP_403_FORBIDDEN)
        err, invite = _validate_private_invite(channel, token_value, user=user)
        if err:
            if channel.privacy != Channel.Privacy.PRIVATE or channel.owner_id == user.id:
                return err
        elif invite:
            _consume_invite(invite)
        membership.is_active = True
        membership.save(update_fields=["is_active"])
        return Response(MembershipSerializer(membership).data, status=status.HTTP_200_OK)

    if not channel.is_active:
        return _channel_closed_response()

    err, invite = _validate_private_invite(channel, token_value, user=user)
    if err:
        return err
    active_members = ChannelMembership.objects.filter(channel=channel, is_active=True).count()
    if active_members >= channel.member_limit:
        return Response({"detail": "channel_full"}, status=status.HTTP_403_FORBIDDEN)

    if channel.join_requires_approval:
        existing_pending = ChannelJoinRequest.objects.filter(
            channel=channel, user=user, status=ChannelJoinRequest.Status.PENDING
        ).first()
        if existing_pending:
            return Response(
                {
                    "status": "pending",
                    "message": "join_request_pending",
                    "channel": channel.id,
                    "request_id": existing_pending.id,
                },
                status=status.HTTP_202_ACCEPTED,
            )
        ChannelJoinRequest.objects.create(
            channel=channel,
            user=user,
            status=ChannelJoinRequest.Status.PENDING,
            invite=invite if channel.privacy == Channel.Privacy.PRIVATE else None,
        )
        return Response(
            {
                "status": "pending",
                "message": "join_request_created",
                "channel": channel.id,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    if channel.privacy == Channel.Privacy.PRIVATE and invite:
        _consume_invite(invite)

    membership, _ = ChannelMembership.objects.get_or_create(channel=channel, user=user)
    membership.is_active = True
    membership.save(update_fields=["is_active"])
    return Response(MembershipSerializer(membership).data, status=status.HTTP_200_OK)


class ChannelJoinRequestListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        pending = (
            ChannelJoinRequest.objects.filter(channel_id=channel_id, status=ChannelJoinRequest.Status.PENDING)
            .select_related("user")
            .order_by("created_at")
        )
        return Response({"results": ChannelJoinRequestSerializer(pending, many=True).data})


class ChannelJoinRequestApproveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int, request_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        join_req = (
            ChannelJoinRequest.objects.filter(id=request_id, channel_id=channel_id, status=ChannelJoinRequest.Status.PENDING)
            .select_related("channel", "invite")
            .first()
        )
        if not join_req:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        channel = join_req.channel
        if not channel.is_active:
            return _channel_closed_response()
        active_members = ChannelMembership.objects.filter(channel=channel, is_active=True).count()
        if active_members >= channel.member_limit:
            return Response({"detail": "channel_full"}, status=status.HTTP_403_FORBIDDEN)

        if channel.privacy == Channel.Privacy.PRIVATE and join_req.invite:
            inv = join_req.invite
            if not inv.is_active:
                return Response({"detail": "invite_invalid"}, status=status.HTTP_403_FORBIDDEN)
            if inv.expires_at and inv.expires_at <= timezone.now():
                return Response({"detail": "invite_expired"}, status=status.HTTP_403_FORBIDDEN)
            if inv.max_uses and inv.used_count >= inv.max_uses:
                return Response({"detail": "invite_exhausted"}, status=status.HTTP_403_FORBIDDEN)
            _consume_invite(inv)

        membership, _ = ChannelMembership.objects.get_or_create(channel=channel, user=join_req.user)
        membership.is_active = True
        membership.save(update_fields=["is_active"])

        join_req.status = ChannelJoinRequest.Status.APPROVED
        join_req.resolved_at = timezone.now()
        join_req.resolved_by = request.user
        join_req.save(update_fields=["status", "resolved_at", "resolved_by"])

        return Response(MembershipSerializer(membership).data, status=status.HTTP_200_OK)


class ChannelJoinRequestRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int, request_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        join_req = ChannelJoinRequest.objects.filter(
            id=request_id, channel_id=channel_id, status=ChannelJoinRequest.Status.PENDING
        ).first()
        if not join_req:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        join_req.status = ChannelJoinRequest.Status.REJECTED
        join_req.resolved_at = timezone.now()
        join_req.resolved_by = request.user
        join_req.save(update_fields=["status", "resolved_at", "resolved_by"])
        return Response({"detail": "rejected"}, status=status.HTTP_200_OK)


class ChannelJoinView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        return perform_channel_join(request.user, channel, request.data.get("token"))


class ChannelJoinFromLinkView(APIView):
    """Parse a pasted channel URL or id and join (supports /channel/<id>, /join/private/<token>, /join/public/<slug>)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        raw = (request.data.get("link") or "").strip()
        extra_token = request.data.get("token")
        if not raw:
            return Response({"detail": "link_required"}, status=status.HTTP_400_BAD_REQUEST)

        if re.fullmatch(r"\d+", raw):
            channel = Channel.objects.filter(id=int(raw)).first()
            if not channel:
                return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
            return perform_channel_join(request.user, channel, extra_token)

        path = raw
        try:
            if re.match(r"^https?://", raw, re.I):
                path = urlparse(raw).path or ""
            elif not raw.startswith("/"):
                path = "/" + raw
        except Exception:
            path = raw

        m = re.search(r"/channel/(\d+)", path)
        if m:
            channel = Channel.objects.filter(id=int(m.group(1))).first()
            if not channel:
                return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
            return perform_channel_join(request.user, channel, extra_token)

        m = re.search(r"/join/private/([0-9a-f-]{36})", path, re.I)
        if m:
            token_str = m.group(1)
            invite = (
                InviteToken.objects.filter(token=token_str, is_active=True)
                .select_related("channel")
                .first()
            )
            if not invite:
                return Response({"detail": "invite_invalid"}, status=status.HTTP_404_NOT_FOUND)
            return perform_channel_join(request.user, invite.channel, token_str)

        m = re.search(r"/join/public/([0-9a-f-]{36})", path, re.I)
        if m:
            slug = m.group(1)
            channel = Channel.objects.filter(public_slug=slug).first()
            if not channel:
                return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
            if channel.privacy == Channel.Privacy.PRIVATE:
                return Response({"detail": "private_requires_invite"}, status=status.HTTP_403_FORBIDDEN)
            return perform_channel_join(request.user, channel, None)

        return Response({"detail": "unrecognized_link"}, status=status.HTTP_400_BAD_REQUEST)


def _can_manage_channel(user, channel_id: int) -> bool:
    return ChannelMembership.objects.filter(
        channel_id=channel_id,
        user=user,
        role__in=[ChannelMembership.Role.OWNER, ChannelMembership.Role.MODERATOR],
        is_active=True,
    ).exists()


def _can_edit_channel_playlist(user, playlist: Playlist) -> bool:
    """Private playlists: owner only. Channel playlists: moderators/owners only (members read-only)."""
    if playlist.channel_id is None:
        return playlist.owner_id == user.id
    return _can_manage_channel(user, playlist.channel_id)


class ChannelInviteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        max_uses = int(request.data.get("max_uses", 0) or 0)
        expires_in_hours = int(request.data.get("expires_in_hours", 0) or 0)
        expires_at = timezone.now() + timedelta(hours=expires_in_hours) if expires_in_hours > 0 else None
        invite = InviteToken.objects.create(
            channel=channel,
            created_by=request.user,
            max_uses=max_uses,
            expires_at=expires_at,
            is_active=True,
        )
        return Response(
            {
                "token": str(invite.token),
                "invite_url": f"/join/private/{invite.token}",
                "invite": InviteTokenSerializer(invite).data,
            }
        )

    def get(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        invites = InviteToken.objects.filter(channel_id=channel_id).order_by("-created_at")[:20]
        return Response({"results": InviteTokenSerializer(invites, many=True).data})


class ChannelInviteRotateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        InviteToken.objects.filter(channel=channel, is_active=True).update(is_active=False)
        invite = InviteToken.objects.create(channel=channel, created_by=request.user, is_active=True)
        return Response({"token": str(invite.token), "invite_url": f"/join/private/{invite.token}"})


class ChannelPublicLinkRotateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        channel.public_slug = uuid.uuid4()
        channel.save(update_fields=["public_slug", "updated_at"])
        return Response({"public_url": f"/join/public/{channel.public_slug}"})


class ChannelSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        for field in ["name", "description", "privacy", "member_limit", "join_requires_approval"]:
            if field in request.data:
                setattr(channel, field, request.data[field])
        channel.save(
            update_fields=["name", "description", "privacy", "member_limit", "join_requires_approval", "updated_at"]
        )
        return Response(ChannelSerializer(channel, context={"request": request}).data)


class ChannelLeaveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        membership = ChannelMembership.objects.filter(channel=channel, user=request.user, is_active=True).first()
        if not membership:
            return Response({"detail": "not_a_member"}, status=status.HTTP_400_BAD_REQUEST)
        if channel.owner_id == request.user.id or membership.role == ChannelMembership.Role.OWNER:
            return Response({"detail": "owner_cannot_leave"}, status=status.HTTP_400_BAD_REQUEST)
        membership.is_active = False
        membership.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChannelCloseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if channel.owner_id != request.user.id:
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        if not channel.is_active:
            return Response(status=status.HTTP_204_NO_CONTENT)
        channel.is_active = False
        channel.save(update_fields=["is_active", "updated_at"])
        playback_state_store.clear_channel(channel.id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChannelReopenView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if channel.owner_id != request.user.id:
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        if channel.is_active:
            return Response(status=status.HTTP_204_NO_CONTENT)
        channel.is_active = True
        channel.save(update_fields=["is_active", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChannelMembersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        members = ChannelMembership.objects.filter(channel_id=channel_id).select_related("user").order_by("joined_at")
        data = [
            {
                "id": m.id,
                "user_id": m.user_id,
                "username": m.user.username,
                "role": m.role,
                "is_active": m.is_active,
                "joined_at": m.joined_at,
            }
            for m in members
        ]
        return Response({"results": data})


class ChannelMemberManageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, channel_id: int, member_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        membership = get_object_or_404(ChannelMembership, id=member_id, channel_id=channel_id)
        role = request.data.get("role")
        if role not in [ChannelMembership.Role.OWNER, ChannelMembership.Role.MODERATOR, ChannelMembership.Role.MEMBER]:
            return Response({"detail": "invalid_role"}, status=status.HTTP_400_BAD_REQUEST)
        if membership.role == ChannelMembership.Role.OWNER and role != ChannelMembership.Role.OWNER:
            current_owners = ChannelMembership.objects.filter(channel_id=channel_id, role=ChannelMembership.Role.OWNER, is_active=True).count()
            if current_owners <= 1:
                return Response({"detail": "owner_must_be_unique"}, status=status.HTTP_400_BAD_REQUEST)
        if role == ChannelMembership.Role.OWNER:
            ChannelMembership.objects.filter(channel_id=channel_id, role=ChannelMembership.Role.OWNER).exclude(id=membership.id).update(
                role=ChannelMembership.Role.MODERATOR
            )
            channel = membership.channel
            channel.owner_id = membership.user_id
            channel.save(update_fields=["owner", "updated_at"])
        membership.role = role
        membership.save(update_fields=["role"])
        return Response(MembershipSerializer(membership).data)

    def delete(self, request, channel_id: int, member_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        membership = get_object_or_404(ChannelMembership, id=member_id, channel_id=channel_id)
        if membership.role == ChannelMembership.Role.OWNER:
            return Response({"detail": "cannot_remove_owner"}, status=status.HTTP_400_BAD_REQUEST)
        membership.is_active = False
        membership.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)
