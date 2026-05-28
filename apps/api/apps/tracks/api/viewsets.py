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


class TrackViewSet(viewsets.ModelViewSet):
    serializer_class = TrackSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Track.objects.select_related("owner").all()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        user = self.request.user
        if getattr(user, "is_authenticated", False):
            ctx["favorited_track_ids"] = _favorited_track_ids_for_user(user)
        return ctx

    def get_queryset(self):
        if is_platform_superuser(self.request.user):
            qs = Track.objects.select_related("owner").order_by("title", "id")
        else:
            qs = tracks_accessible_to_user(self.request.user).order_by("title", "id")
        search = (self.request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(artist__icontains=search)
                | Q(album__icontains=search)
                | Q(genre__icontains=search)
            )
        genre = (self.request.query_params.get("genre") or "").strip()
        if genre:
            qs = qs.filter(genre__iexact=genre)
        album = (self.request.query_params.get("album") or "").strip()
        if album:
            qs = qs.filter(album__iexact=album)
        tag = (self.request.query_params.get("tag") or "").strip()
        if tag:
            qs = qs.filter(tags__contains=[tag])
        fav = (self.request.query_params.get("favorited") or "").strip().lower()
        if fav in ("1", "true", "yes"):
            qs = qs.filter(favorited_by__user=self.request.user).distinct()
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        offset_raw = request.query_params.get("offset")
        if offset_raw is not None and offset_raw != "":
            try:
                offset = max(0, int(offset_raw))
            except (TypeError, ValueError):
                offset = 0
            raw_limit = request.query_params.get("limit", "50")
            try:
                lim = int(raw_limit)
            except (TypeError, ValueError):
                lim = 50
            lim = max(1, min(lim, 200))
            total = qs.count()
            page_qs = qs[offset : offset + lim]
            serializer = self.get_serializer(page_qs, many=True)
            return Response({"results": serializer.data, "total": total, "offset": offset, "limit": lim})

        raw_limit = request.query_params.get("limit")
        search = (self.request.query_params.get("search") or "").strip()
        if raw_limit not in (None, ""):
            try:
                lim = int(raw_limit)
            except (TypeError, ValueError):
                lim = None
            if lim is not None:
                lim = max(1, min(lim, 500))
                qs = qs[:lim]
        elif search:
            qs = qs[:100]
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post", "delete"], url_path="favorite")
    def favorite(self, request, pk=None):
        track = self.get_object()
        if request.method == "POST":
            UserTrackFavorite.objects.get_or_create(user=request.user, track=track)
            return Response({"is_favorited": True})
        UserTrackFavorite.objects.filter(user=request.user, track=track).delete()
        return Response({"is_favorited": False})


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
            if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel=channel, user=request.user, is_active=True).exists():
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


