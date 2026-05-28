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
from apps.core.services.webpush import notify_channel_room_started_push
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
from apps.accounts.models import UserPlaylistFavorite, UserTrackFavorite
from apps.accounts.user_badges import is_platform_superuser, user_badge_flags
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


class ChannelViewSet(viewsets.ModelViewSet):
    serializer_class = ChannelSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Channel.objects.select_related("owner").all()

    def get_queryset(self):
        user = self.request.user
        if is_platform_superuser(user):
            qs = self.queryset.select_related("playback_session").distinct()
        else:
            qs = (
                self.queryset.filter(memberships__user=user)
                .filter(Q(is_active=True) | Q(owner=user))
                .select_related("playback_session")
                .distinct()
            )
        if getattr(self, "action", None) == "list" and not (
            self.request.query_params.get("include_test") or ""
        ).strip().lower() in ("1", "true", "yes"):
            qs = qs.exclude(Q(name__iexact="E2E") | Q(name__istartswith="E2E Room") | Q(name__istartswith="E2E "))
        return qs.order_by("-is_active", "-id")

    def create(self, request, *args, **kwargs):
        from apps.accounts.premium_limits import can_create_channel

        ok, code = can_create_channel(request.user)
        if not ok:
            return Response({"detail": code}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        from apps.accounts.premium_limits import clamp_member_limit

        ml = clamp_member_limit(self.request.user, serializer.validated_data.get("member_limit", 50))
        channel = serializer.save(owner=self.request.user, member_limit=ml)
        ChannelMembership.objects.create(channel=channel, user=self.request.user, role=ChannelMembership.Role.OWNER)
        PlaybackSession.objects.get_or_create(channel=channel)
        InviteToken.objects.create(channel=channel, created_by=self.request.user, is_active=True)

    def _can_manage(self, channel_id: int) -> bool:
        return _can_manage_channel(self.request.user, channel_id)

    def perform_update(self, serializer):
        channel = self.get_object()
        if not self._can_manage(channel.id):
            raise PermissionDenied("permission_denied")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.owner_id != self.request.user.id:
            raise PermissionDenied("only_channel_owner_can_delete_channel")
        playback_state_store.clear_channel(instance.id)
        instance.delete()



