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


def _channel_closed_response():
    return Response({"detail": "channel_closed"}, status=status.HTTP_410_GONE)


_ALLOWED_EXPERIENCE_KEYS = frozenset(
    {
        "accent",
        "rehearsal_mode",
        "rehearsal_lift_until",
        "queue_locked",
        "blind_playlist_id",
        "intro_preview_seconds",
        "veto_skip_threshold",
        "anti_repeat_window",
        "weighted_shuffle_bias",
        "suggestions_enabled",
        "suggestion_rate_limit_per_hour",
        "chat_slow_mode_seconds",
        "theme_primary",
        "theme_surface",
        "theme_font",
        "listening_party_only",
        "radio_mode",
        "scheduled_start_at",
        "queue_end_mode",
        "room_rules",
        "chat_word_filters",
    },
)


_UUID_TOKEN_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
_PUBLIC_JOIN_CODE_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9-]{2,39}$")
_PUBLIC_JOIN_RESERVED = frozenset(
    {
        "join",
        "api",
        "www",
        "static",
        "channel",
        "dashboard",
        "login",
        "register",
        "admin",
        "media",
        "audio",
        "private",
        "public",
        "invite",
        "ws",
        "app",
        "next",
    },
)


def _normalize_public_join_slug_for_save(raw) -> str | None | bool:
    """Return normalized slug, None to clear, False if invalid."""
    if raw is None or (isinstance(raw, str) and not str(raw).strip()):
        return None
    s = str(raw).strip().lower()
    if len(s) > 40 or s in _PUBLIC_JOIN_RESERVED or s.isdigit():
        return False
    if not _PUBLIC_JOIN_CODE_RE.match(s):
        return False
    return s


def _resolve_public_join_segment(seg: str) -> Channel | None:
    low = seg.strip().lower()
    ch = Channel.objects.filter(public_join_slug__iexact=low).first()
    if ch:
        return ch
    if _UUID_TOKEN_RE.match(seg):
        return Channel.objects.filter(public_slug=seg).first()
    return None


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

# Per-request cap for playlist bulk-add (client may send smaller chunks).
PLAYLIST_BULK_ADD_MAX = 150


def _favorited_track_ids_for_user(user) -> set[int]:
    return set(UserTrackFavorite.objects.filter(user_id=user.id).values_list("track_id", flat=True))


def _favorited_playlist_ids_for_user(user) -> set[int]:
    return set(UserPlaylistFavorite.objects.filter(user_id=user.id).values_list("playlist_id", flat=True))


def _playlist_visible_to_user(user, playlist: Playlist) -> bool:
    if is_platform_superuser(user):
        return True
    if playlist.owner_id == user.id:
        return True
    if UserPlaylistFavorite.objects.filter(user_id=user.id, playlist_id=playlist.id).exists():
        return True
    if playlist.channel_id:
        return ChannelMembership.objects.filter(channel_id=playlist.channel_id, user=user, is_active=True).exists()
    from apps.common.social_models import PlaylistShareLink

    return PlaylistShareLink.objects.filter(playlist_id=playlist.id, is_active=True).exists()


def _queue_serialize_context(channel_id: int, user_id: int | None, item_ids: list[int]) -> dict:
    from django.db.models import Count

    if not item_ids:
        return {"upvote_counts": {}, "user_upvoted_ids": set(), "added_by_names": {}}
    rows = (
        ChannelQueueUpvote.objects.filter(queue_item_id__in=item_ids)
        .values("queue_item_id")
        .annotate(c=Count("id"))
    )
    upvote_counts = {r["queue_item_id"]: r["c"] for r in rows}
    user_upvoted_ids = set()
    if user_id:
        user_upvoted_ids = set(
            ChannelQueueUpvote.objects.filter(queue_item_id__in=item_ids, user_id=user_id).values_list(
                "queue_item_id", flat=True
            )
        )
    items = ChannelQueueItem.objects.filter(id__in=item_ids).select_related("added_by")
    added_by_names = {i.added_by_id: i.added_by.username for i in items if i.added_by_id}
    return {
        "upvote_counts": upvote_counts,
        "user_upvoted_ids": user_upvoted_ids,
        "added_by_names": added_by_names,
    }


def _serialize_queue(channel_id: int, user_id: int | None = None):
    from apps.common.premium_limits import track_owner_is_premium
    from apps.playback.services.queue_advance import find_current_queue_index

    queue = list(
        ChannelQueueItem.objects.filter(channel_id=channel_id)
        .select_related("track", "track__owner", "added_by")
        .order_by("position", "id")
    )
    ctx = _queue_serialize_context(channel_id, user_id, [q.id for q in queue])
    premium_track_ids = {q.track_id for q in queue if q.track_id and track_owner_is_premium(q.track)}
    session = PlaybackSession.objects.filter(channel_id=channel_id).only("track_id").first()
    current_idx = find_current_queue_index(queue, session.track_id if session else None)
    tail = queue[current_idx + 1 :] if current_idx + 1 < len(queue) else []
    premium_boosted_ids: set[int] = set()
    if len(tail) >= 2:
        prem = [r for r in tail if r.track_id in premium_track_ids]
        reg = [r for r in tail if r.track_id not in premium_track_ids]
        if prem and reg and len(prem) < len(tail):
            for row in prem:
                premium_boosted_ids.add(row.id)
    ctx["premium_track_ids"] = premium_track_ids
    ctx["premium_boosted_ids"] = premium_boosted_ids
    return QueueItemSerializer(queue, many=True, context=ctx).data


def _broadcast_queue_updated(channel_id: int, user_id: int | None = None) -> list:
    serialized = _serialize_queue(channel_id, user_id)
    playback_state_store.save_queue_snapshot(channel_id, list(serialized))
    channel_layer = get_channel_layer()
    if channel_layer is not None:
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
    return serialized


def _broadcast_suggestions_updated(
    channel_id: int,
    *,
    event: str = "updated",
    actor_username: str | None = None,
) -> int:
    """Notify room clients (playback WebSocket) of pending suggestion count for admin nav badge."""
    pending = ChannelPlaylistSuggestion.objects.filter(
        channel_id=channel_id,
        status=ChannelPlaylistSuggestion.Status.PENDING,
    ).count()
    channel_layer = get_channel_layer()
    if channel_layer is not None:
        payload: dict = {
            "type": "SUGGESTIONS_UPDATED",
            "action": "suggestions_updated",
            "channel_id": channel_id,
            "pending_count": pending,
            "event": event,
        }
        if actor_username:
            payload["actor_username"] = actor_username
        async_to_sync(channel_layer.group_send)(
            f"channel_{channel_id}",
            {"type": "broadcast_event", "payload": payload},
        )
    return pending


def _log_channel_audit(channel_id: int, action: str, actor_id: int | None, *, target_type: str = "", target_id: str = "", metadata=None) -> None:
    ChannelAuditLog.objects.create(
        channel_id=channel_id,
        actor_id=actor_id,
        action=action,
        target_type=target_type or "",
        target_id=str(target_id or ""),
        metadata=metadata if isinstance(metadata, dict) else {},
    )


def _record_playback_event(
    channel_id: int,
    event_type: str,
    *,
    actor_id: int | None,
    track: Track | None,
    source: str = "manual",
    payload: dict | None = None,
) -> None:
    PlaybackEvent.objects.create(
        channel_id=channel_id,
        actor_id=actor_id,
        track=track,
        event_type=event_type,
        source=source,
        payload=payload or {},
    )

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
        from apps.common.webpush_service import notify_channel_join_request_push

        notify_channel_join_request_push(channel.id, getattr(user, "username", "?"), user.id)
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


def _can_manage_channel(user, channel_id: int) -> bool:
    if is_platform_superuser(user):
        return True
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


def _can_copy_playlist_to_channel(user, source: Playlist, channel_id: int) -> bool:
    if not _can_manage_channel(user, channel_id):
        return False
    return _playlist_visible_to_user(user, source)


def _playlist_inaccessible_track_ids(user, playlist: Playlist) -> list[int]:
    track_ids = list(PlaylistItem.objects.filter(playlist=playlist).values_list("track_id", flat=True))
    if not track_ids:
        return []
    allowed = set(tracks_accessible_to_user(user).filter(id__in=track_ids).values_list("id", flat=True))
    seen: set[int] = set()
    blocked: list[int] = []
    for tid in track_ids:
        if tid in seen:
            continue
        seen.add(tid)
        if tid not in allowed:
            blocked.append(tid)
    return blocked

