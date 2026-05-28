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



class ChannelJoinView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        return perform_channel_join(request.user, channel, request.data.get("token"))



class ChannelJoinFromLinkView(APIView):
    """Join from numeric id, invite UUID, public slug/code, or pasted URL path."""

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

        if _UUID_TOKEN_RE.match(raw):
            invite = InviteToken.objects.filter(token=raw, is_active=True).select_related("channel").first()
            if invite:
                return perform_channel_join(request.user, invite.channel, str(invite.token))
            channel = Channel.objects.filter(public_slug=raw).first()
            if channel:
                if channel.privacy == Channel.Privacy.PRIVATE:
                    return Response({"detail": "private_requires_invite"}, status=status.HTTP_403_FORBIDDEN)
                return perform_channel_join(request.user, channel, None)
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)

        if _PUBLIC_JOIN_CODE_RE.match(raw) and not _UUID_TOKEN_RE.match(raw):
            channel = Channel.objects.filter(public_join_slug__iexact=raw.lower()).first()
            if channel:
                if channel.privacy == Channel.Privacy.PRIVATE:
                    return Response({"detail": "private_requires_invite"}, status=status.HTTP_403_FORBIDDEN)
                return perform_channel_join(request.user, channel, None)

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

        m = re.search(r"/join/public/([a-zA-Z0-9-]+)", path, re.I)
        if m:
            seg = m.group(1)
            channel = _resolve_public_join_segment(seg)
            if not channel:
                return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
            if channel.privacy == Channel.Privacy.PRIVATE:
                return Response({"detail": "private_requires_invite"}, status=status.HTTP_403_FORBIDDEN)
            return perform_channel_join(request.user, channel, None)

        return Response({"detail": "unrecognized_link"}, status=status.HTTP_400_BAD_REQUEST)





