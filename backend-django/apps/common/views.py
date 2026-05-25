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


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def api_time(_request):
    return Response({"time": time.time()})


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
@ensure_csrf_cookie
def auth_csrf(request):
    from django.middleware.csrf import get_token

    return Response({"detail": "csrf_cookie_set", "csrfToken": get_token(request)})


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
        body = {"user": AuthUserSerializer(request.user).data}
        prefs, _ = UserNotificationSettings.objects.get_or_create(user_id=request.user.id)
        body["notification_settings"] = UserNotificationSettingsSerializer(prefs).data
        pub = (getattr(django_settings, "WEBPUSH_VAPID_PUBLIC_KEY", None) or "").strip()
        if pub:
            body["webpush"] = {"vapid_public_key": pub}
        return Response(body)

    def patch(self, request):
        ser = AuthUserProfileUpdateSerializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        body = {"user": AuthUserSerializer(request.user).data}
        prefs, _ = UserNotificationSettings.objects.get_or_create(user_id=request.user.id)
        body["notification_settings"] = UserNotificationSettingsSerializer(prefs).data
        pub = (getattr(django_settings, "WEBPUSH_VAPID_PUBLIC_KEY", None) or "").strip()
        if pub:
            body["webpush"] = {"vapid_public_key": pub}
        return Response(body)


class UserPasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = PasswordChangeSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        current = ser.validated_data["current_password"]
        new_pw = ser.validated_data["new_password"]
        if not request.user.check_password(current):
            return Response({"detail": "wrong_password"}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(new_pw)
        request.user.save(update_fields=["password"])
        update_session_auth_hash(request, request.user)
        return Response({"detail": "ok"})


class UserNotificationSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        prefs, _ = UserNotificationSettings.objects.get_or_create(user_id=request.user.id)
        return Response(UserNotificationSettingsSerializer(prefs).data)

    def patch(self, request):
        prefs, _ = UserNotificationSettings.objects.get_or_create(user_id=request.user.id)
        ser = UserNotificationSettingsSerializer(prefs, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class WebPushSubscriptionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ep = request.data.get("endpoint")
        keys = request.data.get("keys") if isinstance(request.data.get("keys"), dict) else {}
        p256dh = keys.get("p256dh") if isinstance(keys, dict) else None
        auth = keys.get("auth") if isinstance(keys, dict) else None
        if not ep or not p256dh or not auth:
            return Response({"detail": "invalid_subscription"}, status=status.HTTP_400_BAD_REQUEST)
        WebPushSubscription.objects.update_or_create(
            endpoint=str(ep),
            defaults={
                "user_id": request.user.id,
                "p256dh": str(p256dh)[:255],
                "auth": str(auth)[:255],
            },
        )
        return Response({"detail": "ok"})

    def delete(self, request):
        ep = request.data.get("endpoint") if isinstance(request.data, dict) else None
        qs = WebPushSubscription.objects.filter(user_id=request.user.id)
        if ep:
            qs = qs.filter(endpoint=str(ep))
        deleted, _ = qs.delete()
        return Response({"deleted": deleted})


class UsersListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        users = User.objects.exclude(id=request.user.id).order_by("username")[:100]
        return Response(
            {
                "results": [
                    {"id": user.id, "username": user.username, **user_badge_flags(user)} for user in users
                ]
            }
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
        from apps.common.premium_limits import can_create_channel

        ok, code = can_create_channel(request.user)
        if not ok:
            return Response({"detail": code}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        from apps.common.premium_limits import clamp_member_limit

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


class PlaylistViewSet(viewsets.ModelViewSet):
    serializer_class = PlaylistSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = Playlist.objects.select_related("owner", "channel").all()

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        user = self.request.user
        if getattr(user, "is_authenticated", False):
            ctx["favorited_playlist_ids"] = _favorited_playlist_ids_for_user(user)
        return ctx

    def get_queryset(self):
        user = self.request.user
        if is_platform_superuser(user):
            qs = self.queryset.all()
        else:
            channel_id = self.request.query_params.get("channel")
            if channel_id is not None and channel_id != "":
                try:
                    cid = int(channel_id)
                except ValueError:
                    return self.queryset.none()
                if not ChannelMembership.objects.filter(channel_id=cid, user=user, is_active=True).exists():
                    return self.queryset.none()
                qs = self.queryset.filter(channel_id=cid)
            else:
                qs = self.queryset.filter(
                    Q(owner=user)
                    | Q(channel__memberships__user=user, channel__memberships__is_active=True)
                    | Q(favorited_by__user=user),
                ).distinct()

        fav = (self.request.query_params.get("favorited") or "").strip().lower()
        if fav in ("1", "true", "yes"):
            qs = self.queryset.filter(favorited_by__user=user).distinct()
        return qs

    def perform_create(self, serializer):
        channel = serializer.validated_data.get("channel")
        if channel is not None and not _can_manage_channel(self.request.user, channel.id):
            raise PermissionDenied("permission_denied")
        serializer.save(owner=self.request.user)

    def perform_update(self, serializer):
        playlist = self.get_object()
        user = self.request.user
        if "channel" in serializer.validated_data:
            new_channel = serializer.validated_data.get("channel")
            if new_channel is not None and not _can_manage_channel(user, new_channel.id):
                raise PermissionDenied("permission_denied")
            if playlist.channel_id is None and new_channel is not None and playlist.owner_id != user.id:
                raise PermissionDenied("permission_denied")
        if not _can_edit_channel_playlist(user, playlist):
            raise PermissionDenied("permission_denied")
        serializer.save()

    def perform_destroy(self, instance):
        if not _can_edit_channel_playlist(self.request.user, instance):
            raise PermissionDenied("permission_denied")
        instance.delete()

    @action(detail=True, methods=["post", "delete"], url_path="favorite")
    def favorite(self, request, pk=None):
        playlist = self.get_object()
        if not _playlist_visible_to_user(request.user, playlist):
            raise PermissionDenied("permission_denied")
        if request.method == "POST":
            UserPlaylistFavorite.objects.get_or_create(user=request.user, playlist=playlist)
            return Response({"is_favorited": True})
        UserPlaylistFavorite.objects.filter(user=request.user, playlist=playlist).delete()
        return Response({"is_favorited": False})

    @action(detail=True, methods=["post"], url_path="add-tracks")
    def add_tracks(self, request, pk=None):
        playlist = self.get_object()
        if not _can_edit_channel_playlist(request.user, playlist):
            raise PermissionDenied("permission_denied")

        raw_ids = request.data.get("track_ids")
        if not isinstance(raw_ids, list) or len(raw_ids) == 0:
            return Response({"detail": "track_ids_required"}, status=status.HTTP_400_BAD_REQUEST)
        if len(raw_ids) > PLAYLIST_BULK_ADD_MAX:
            return Response(
                {"detail": "too_many_tracks", "max": PLAYLIST_BULK_ADD_MAX},
                status=status.HTTP_400_BAD_REQUEST,
            )

        parsed: list[int] = []
        for x in raw_ids:
            try:
                parsed.append(int(x))
            except (TypeError, ValueError):
                return Response({"detail": "invalid_track_id"}, status=status.HTTP_400_BAD_REQUEST)

        seen: set[int] = set()
        ordered_unique: list[int] = []
        for tid in parsed:
            if tid in seen:
                continue
            seen.add(tid)
            ordered_unique.append(tid)

        allowed = set(tracks_accessible_to_user(request.user).filter(id__in=ordered_unique).values_list("id", flat=True))
        to_add = [tid for tid in ordered_unique if tid in allowed]

        with transaction.atomic():
            base = playlist.items.aggregate(m=Max("position"))["m"]
            start = 0 if base is None else int(base) + 1
            rows = [PlaylistItem(playlist=playlist, track_id=tid, position=start + i) for i, tid in enumerate(to_add)]
            if rows:
                PlaylistItem.objects.bulk_create(rows)

        return Response(
            {
                "added": len(to_add),
                "requested": len(parsed),
                "skipped_not_allowed": len(ordered_unique) - len(to_add),
            }
        )

    @action(detail=True, methods=["post"], url_path="copy-to-channel")
    def copy_to_channel(self, request, pk=None):
        source = self.get_object()
        try:
            channel_id = int(request.data.get("channel_id"))
        except (TypeError, ValueError):
            return Response({"detail": "channel_id_required"}, status=status.HTTP_400_BAD_REQUEST)
        channel = Channel.objects.filter(id=channel_id).first()
        if channel is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if not channel.is_active:
            return Response({"detail": "channel_closed"}, status=status.HTTP_403_FORBIDDEN)
        if not _can_copy_playlist_to_channel(request.user, source, channel_id):
            raise PermissionDenied("permission_denied")
        name = str(request.data.get("name") or "").strip() or source.name
        blocked = set(_playlist_inaccessible_track_ids(request.user, source))
        with transaction.atomic():
            dest = Playlist.objects.create(name=name[:255], owner=request.user, channel_id=channel_id)
            items = list(PlaylistItem.objects.filter(playlist=source).order_by("position", "id"))
            allowed_rows = [row for row in items if row.track_id not in blocked]
            if allowed_rows:
                PlaylistItem.objects.bulk_create(
                    [
                        PlaylistItem(
                            playlist=dest,
                            track_id=row.track_id,
                            position=idx,
                        )
                        for idx, row in enumerate(allowed_rows)
                    ]
                )
        payload = PlaylistSerializer(dest, context=self.get_serializer_context()).data
        return Response(
            {
                "playlist": payload,
                "added": len(allowed_rows) if items else 0,
                "skipped_inaccessible": len(blocked),
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="assign-to-channel")
    def assign_to_channel(self, request, pk=None):
        """Link personal playlist to a channel (same object; edits apply for channel mods)."""
        source = self.get_object()
        try:
            channel_id = int(request.data.get("channel_id"))
        except (TypeError, ValueError):
            return Response({"detail": "channel_id_required"}, status=status.HTTP_400_BAD_REQUEST)
        channel = Channel.objects.filter(id=channel_id).first()
        if channel is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        if not channel.is_active:
            return Response({"detail": "channel_closed"}, status=status.HTTP_403_FORBIDDEN)
        if not _can_manage_channel(request.user, channel_id):
            raise PermissionDenied("permission_denied")
        if source.channel_id is not None:
            return Response({"detail": "playlist_already_on_channel"}, status=status.HTTP_400_BAD_REQUEST)
        if source.owner_id != request.user.id and not is_platform_superuser(request.user):
            return Response({"detail": "playlist_assign_owner_only"}, status=status.HTTP_403_FORBIDDEN)
        blocked = _playlist_inaccessible_track_ids(request.user, source)
        if blocked:
            return Response(
                {
                    "detail": "playlist_has_inaccessible_tracks",
                    "inaccessible_count": len(blocked),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        source.channel_id = channel_id
        source.save(update_fields=["channel_id"])
        return Response(PlaylistSerializer(source, context=self.get_serializer_context()).data)


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
            if not _playlist_visible_to_user(user, playlist):
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


class ChannelControlView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _event_type(action: str) -> str:
        return action.upper()

    @staticmethod
    def _build_control_payload(
        channel_id: int,
        action: str,
        playback_session: PlaybackSession,
        position: float | None,
        channel: Channel | None = None,
    ):
        if channel is None:
            channel = Channel.objects.filter(id=channel_id).first()
        payload = {
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
        if channel is not None:
            payload.update(playback_queue_meta(channel, playback_session))
        return payload

    def post(self, request, channel_id: int):
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
                # Keep the server-authoritative timeline aligned after manual seek.
                playback_session.started_at_server_time = time.time() - playback_session.paused_at_position
        elif action in {"next", "prev"}:
            queue = list(ChannelQueueItem.objects.filter(channel=channel).order_by("position"))
            if queue:
                direction = "next" if action == "next" else "prev"
                target_index = apply_queue_advance(channel, playback_session, queue, direction)
                if target_index is None:
                    action = "pause"
            playback_session.queue_version += 1
        playback_session.save(update_fields=["is_playing", "started_at_server_time", "paused_at_position", "queue_version", "track", "updated_at"])
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

        payload = self._build_control_payload(
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


class ChannelQueueView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active:
            return _channel_closed_response()
        serialized = _serialize_queue(channel_id, request.user.id)
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
        serialized = _serialize_queue(channel_id, request.user.id)
        ctx = _queue_serialize_context(channel_id, request.user.id, [item.id])
        playback_state_store.save_queue_snapshot(channel_id, serialized)
        return Response(QueueItemSerializer(item, context=ctx).data)

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
        serialized = _serialize_queue(channel_id, request.user.id)
        playback_state_store.save_queue_snapshot(channel_id, serialized)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChannelQueueUpvoteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int, item_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active:
            return _channel_closed_response()
        item = get_object_or_404(ChannelQueueItem, id=item_id, channel_id=channel_id)
        ChannelQueueUpvote.objects.get_or_create(queue_item=item, user=request.user)
        serialized = _serialize_queue(channel_id, request.user.id)
        playback_state_store.save_queue_snapshot(channel_id, serialized)
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
        ctx = _queue_serialize_context(channel_id, request.user.id, [item.id])
        return Response(QueueItemSerializer(item, context=ctx).data, status=status.HTTP_201_CREATED)

    def delete(self, request, channel_id: int, item_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        ChannelQueueUpvote.objects.filter(queue_item_id=item_id, queue_item__channel_id=channel_id, user=request.user).delete()
        serialized = _serialize_queue(channel_id, request.user.id)
        playback_state_store.save_queue_snapshot(channel_id, serialized)
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


class ChannelSimilarTracksView(APIView):
    """Tracks in this channel's playlists that share the same artist string as `from_track`."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active and channel.owner_id != request.user.id:
            return _channel_closed_response()
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel=channel, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        from_track_id = request.query_params.get("from_track")
        if not from_track_id:
            return Response({"results": []})
        try:
            tid = int(from_track_id)
        except (TypeError, ValueError):
            return Response({"results": []})
        ref = Track.objects.filter(id=tid).first()
        if ref is None:
            return Response({"results": []})
        artist = (ref.artist or "").strip()
        if not artist:
            return Response({"results": []})
        qs = (
            Track.objects.filter(playlist_items__playlist__channel_id=channel.id)
            .exclude(id=ref.id)
            .filter(artist__iexact=artist)
            .distinct()
            .order_by("title")[:24]
        )
        return Response({"results": TrackSerializer(qs, many=True, context={"request": request}).data})


class ChannelChatView(APIView):
    """Channel-scoped chat: only active members of this channel can read or post."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active and channel.owner_id != request.user.id:
            return _channel_closed_response()
        try:
            limit = int(request.query_params.get("limit", 50))
        except (TypeError, ValueError):
            limit = 50
        limit = min(100, max(1, limit))
        qs = (
            ChannelChatMessage.objects.filter(channel_id=channel_id)
            .select_related("user")
            .prefetch_related("reactions__user")
            .order_by("-id")
        )
        before = request.query_params.get("before")
        if before:
            try:
                bid = int(before)
                qs = qs.filter(id__lt=bid)
            except (TypeError, ValueError):
                pass
        rows = list(qs[:limit])
        rows.reverse()
        return Response({"results": ChannelChatMessageSerializer(rows, many=True, context={"request": request}).data})


class ChannelChatPinView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        msg = (
            ChannelChatMessage.objects.filter(channel_id=channel_id, is_pinned=True)
            .select_related("user", "pinned_by")
            .prefetch_related("reactions__user")
            .order_by("-pinned_at", "-id")
            .first()
        )
        return Response({"message": ChannelChatMessageSerializer(msg, context={"request": request}).data if msg else None})

    def put(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        message_id = request.data.get("message_id")
        with transaction.atomic():
            ChannelChatMessage.objects.filter(channel_id=channel_id, is_pinned=True).update(
                is_pinned=False,
                pinned_at=None,
                pinned_by=None,
            )
            if message_id in (None, "", 0):
                _log_channel_audit(channel_id, "chat.unpin_all", request.user.id, target_type="chat_message")
                return Response({"message": None})
            msg = get_object_or_404(ChannelChatMessage, id=int(message_id), channel_id=channel_id)
            msg.is_pinned = True
            msg.pinned_at = timezone.now()
            msg.pinned_by = request.user
            msg.save(update_fields=["is_pinned", "pinned_at", "pinned_by"])
            _log_channel_audit(channel_id, "chat.pin", request.user.id, target_type="chat_message", target_id=msg.id)
        return Response({"message": ChannelChatMessageSerializer(msg, context={"request": request}).data})


class ChannelTrackReactionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        track_id = request.query_params.get("track_id")
        qs = ChannelTrackReaction.objects.filter(channel_id=channel_id).select_related("user")
        if track_id:
            qs = qs.filter(track_id=track_id)
        rows = qs.order_by("-id")[:250]
        return Response({"results": ChannelTrackReactionSerializer(rows, many=True).data})

    def post(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        track_id = request.data.get("track_id")
        emoji = str(request.data.get("emoji") or "").strip()[:16]
        if not track_id or not emoji:
            return Response({"detail": "track_id_and_emoji_required"}, status=status.HTTP_400_BAD_REQUEST)
        row, _ = ChannelTrackReaction.objects.get_or_create(
            channel_id=channel_id,
            track_id=int(track_id),
            user_id=request.user.id,
            emoji=emoji,
        )
        _log_channel_audit(channel_id, "track.react", request.user.id, target_type="track", target_id=track_id, metadata={"emoji": emoji})
        return Response(ChannelTrackReactionSerializer(row).data, status=status.HTTP_201_CREATED)


class ChannelPlaybackHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        limit = min(200, max(1, int(request.query_params.get("limit", 60) or 60)))
        rows = PlaybackEvent.objects.filter(channel_id=channel_id).select_related("actor", "track").order_by("-id")[:limit]
        return Response({"results": PlaybackEventSerializer(rows, many=True).data})


class ChannelAuditLogView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        limit = min(200, max(1, int(request.query_params.get("limit", 80) or 80)))
        rows = ChannelAuditLog.objects.filter(channel_id=channel_id).select_related("actor").order_by("-id")[:limit]
        return Response({"results": ChannelAuditLogSerializer(rows, many=True).data})


class ChannelPlaylistSuggestionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        status_filter = str(request.query_params.get("status") or "").strip().lower()
        qs = ChannelPlaylistSuggestion.objects.filter(channel_id=channel_id).select_related("user", "track", "reviewed_by")
        if status_filter in {ChannelPlaylistSuggestion.Status.PENDING, ChannelPlaylistSuggestion.Status.APPROVED, ChannelPlaylistSuggestion.Status.REJECTED}:
            qs = qs.filter(status=status_filter)
        rows = qs.order_by("-id")[:200]
        return Response({"results": ChannelPlaylistSuggestionSerializer(rows, many=True).data})

    def post(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active:
            return _channel_closed_response()
        ex = channel.experience if isinstance(channel.experience, dict) else {}
        if ex.get("suggestions_enabled") is False:
            return Response({"detail": "suggestions_disabled"}, status=status.HTTP_403_FORBIDDEN)
        staff = _can_manage_channel(request.user, channel_id)
        if not staff:
            hour_ago = timezone.now() - timedelta(hours=1)
            limit = max(1, min(20, int(ex.get("suggestion_rate_limit_per_hour") or 5)))
            recent = ChannelPlaylistSuggestion.objects.filter(
                channel_id=channel_id,
                user_id=request.user.id,
                created_at__gte=hour_ago,
            ).count()
            if recent >= limit:
                return Response({"detail": "suggestion_rate_limited"}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        track_id = request.data.get("track_id")
        external_url = str(request.data.get("external_url") or "").strip()
        note = str(request.data.get("note") or "").strip()[:280]
        external_title = str(request.data.get("external_title") or "").strip()[:255]
        external_artist = str(request.data.get("external_artist") or "").strip()[:255]
        if not track_id and not external_url:
            return Response({"detail": "track_or_external_required"}, status=status.HTTP_400_BAD_REQUEST)
        if track_id and external_url:
            return Response({"detail": "track_or_external_not_both"}, status=status.HTTP_400_BAD_REQUEST)
        if track_id:
            if not tracks_accessible_to_user(request.user).filter(id=int(track_id)).exists():
                return Response({"detail": "track_not_accessible"}, status=status.HTTP_403_FORBIDDEN)
            row = ChannelPlaylistSuggestion.objects.create(
                channel_id=channel_id,
                track_id=int(track_id),
                user_id=request.user.id,
                note=note,
            )
            _log_channel_audit(channel_id, "suggestion.created", request.user.id, target_type="track", target_id=track_id)
        else:
            from apps.common.social_expansion_views import _parse_external_source

            url, title, artist, source = _parse_external_source(external_url)
            if not url:
                return Response({"detail": "invalid_external_url"}, status=status.HTTP_400_BAD_REQUEST)
            row = ChannelPlaylistSuggestion.objects.create(
                channel_id=channel_id,
                user_id=request.user.id,
                note=note,
                external_url=url,
                external_title=external_title or title,
                external_artist=external_artist or artist,
                external_source=source,
            )
            _log_channel_audit(channel_id, "suggestion.created", request.user.id, target_type="external", target_id=url)
        _broadcast_suggestions_updated(
            channel_id,
            event="created",
            actor_username=getattr(request.user, "username", None),
        )
        from apps.common.webpush_service import notify_channel_new_suggestion_push

        notify_channel_new_suggestion_push(channel_id, getattr(request.user, "username", "?"), request.user.id)
        return Response(ChannelPlaylistSuggestionSerializer(row).data, status=status.HTTP_201_CREATED)

    def patch(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        suggestion_id = request.data.get("suggestion_id")
        action = str(request.data.get("action") or "").strip().lower()
        if not suggestion_id or action not in {"approve", "reject"}:
            return Response({"detail": "invalid_payload"}, status=status.HTTP_400_BAD_REQUEST)
        row = get_object_or_404(ChannelPlaylistSuggestion, id=int(suggestion_id), channel_id=channel_id)
        row.status = ChannelPlaylistSuggestion.Status.APPROVED if action == "approve" else ChannelPlaylistSuggestion.Status.REJECTED
        row.reviewed_by_id = request.user.id
        row.reviewed_at = timezone.now()
        row.save(update_fields=["status", "reviewed_by", "reviewed_at"])
        if action == "approve":
            channel = get_object_or_404(Channel, id=channel_id)
            if row.track_id and row.track:
                from apps.playback.services.channel_queue import insert_track_after_now_playing

                insert_track_after_now_playing(channel, row.track, added_by_id=row.user_id)
                session, _ = PlaybackSession.objects.get_or_create(channel=channel)
                session.queue_version += 1
                session.save(update_fields=["queue_version", "updated_at"])
                _broadcast_queue_updated(channel_id, request.user.id)
            elif row.external_url:
                from apps.channels.chat_service import apply_chat_send

                label = row.external_title or "Link"
                artist = f" — {row.external_artist}" if row.external_artist else ""
                body = f"🎧 {label}{artist}\n{row.external_url}"
                apply_chat_send(channel_id, request.user, body)
        _log_channel_audit(channel_id, f"suggestion.{action}", request.user.id, target_type="suggestion", target_id=row.id)
        _broadcast_suggestions_updated(channel_id)
        return Response(ChannelPlaylistSuggestionSerializer(row).data)


class ChannelNotificationPreferenceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        row, _ = ChannelNotificationPreference.objects.get_or_create(channel_id=channel_id, user_id=request.user.id)
        return Response(ChannelNotificationPreferenceSerializer(row).data)

    def patch(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        row, _ = ChannelNotificationPreference.objects.get_or_create(channel_id=channel_id, user_id=request.user.id)
        for field in [
            "muted",
            "notify_room_started",
            "notify_queue_turn",
            "notify_skip_threshold",
            "notify_moderation",
        ]:
            if field in request.data:
                setattr(row, field, bool(request.data.get(field)))
        row.save()
        return Response(ChannelNotificationPreferenceSerializer(row).data)


class ChannelSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def patch(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        update_fields = []
        for field in ["name", "description", "privacy", "join_requires_approval"]:
            if field in request.data:
                setattr(channel, field, request.data[field])
                update_fields.append(field)
        if "member_limit" in request.data:
            from apps.common.premium_limits import clamp_member_limit

            channel.member_limit = clamp_member_limit(channel.owner, request.data.get("member_limit", channel.member_limit))
            update_fields.append("member_limit")
        if "public_join_slug" in request.data:
            if channel.privacy == Channel.Privacy.PRIVATE:
                if _normalize_public_join_slug_for_save(request.data.get("public_join_slug")) not in (None, False):
                    return Response({"detail": "public_join_slug_not_allowed"}, status=status.HTTP_400_BAD_REQUEST)
            else:
                normalized = _normalize_public_join_slug_for_save(request.data.get("public_join_slug"))
                if normalized is False:
                    return Response({"detail": "invalid_public_join_slug"}, status=status.HTTP_400_BAD_REQUEST)
                if normalized is None:
                    channel.public_join_slug = None
                else:
                    taken = (
                        Channel.objects.exclude(pk=channel.pk)
                        .filter(public_join_slug__iexact=normalized)
                        .exists()
                    )
                    if taken:
                        return Response({"detail": "public_join_slug_taken"}, status=status.HTTP_400_BAD_REQUEST)
                    channel.public_join_slug = normalized
                update_fields.append("public_join_slug")
        if channel.privacy == Channel.Privacy.PRIVATE and channel.public_join_slug:
            channel.public_join_slug = None
            if "public_join_slug" not in update_fields:
                update_fields.append("public_join_slug")
        if "experience" in request.data:
            raw = request.data.get("experience")
            if isinstance(raw, str):
                try:
                    raw = json.loads(raw)
                except json.JSONDecodeError:
                    return Response({"detail": "invalid_experience"}, status=status.HTTP_400_BAD_REQUEST)
            if isinstance(raw, dict):
                ex = dict(channel.experience or {})
                for k, v in raw.items():
                    if k not in _ALLOWED_EXPERIENCE_KEYS:
                        continue
                    if k == "chat_word_filters" and isinstance(v, list):
                        ex[k] = [str(w).strip().lower()[:64] for w in v if str(w).strip()][:50]
                    else:
                        ex[k] = v
                channel.experience = ex
                update_fields.append("experience")
        if "brand_logo" in getattr(request, "FILES", {}):
            channel.brand_logo = request.FILES["brand_logo"]
            update_fields.append("brand_logo")
        if not update_fields:
            return Response(ChannelSerializer(channel, context={"request": request}).data)
        update_fields.append("updated_at")
        channel.save(update_fields=list(dict.fromkeys(update_fields)))
        _log_channel_audit(
            channel.id,
            "channel.settings_updated",
            request.user.id,
            target_type="channel",
            target_id=channel.id,
            metadata={"fields": list(dict.fromkeys(update_fields))},
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
        _log_channel_audit(channel.id, "membership.leave", request.user.id, target_type="membership", target_id=membership.id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChannelCloseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if channel.owner_id != request.user.id and not is_platform_superuser(request.user):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        if not channel.is_active:
            return Response(status=status.HTTP_204_NO_CONTENT)
        channel.is_active = False
        channel.save(update_fields=["is_active", "updated_at"])
        playback_state_store.clear_channel(channel.id)
        _log_channel_audit(channel.id, "channel.closed", request.user.id, target_type="channel", target_id=channel.id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChannelReopenView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if channel.owner_id != request.user.id and not is_platform_superuser(request.user):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        if channel.is_active:
            return Response(status=status.HTTP_204_NO_CONTENT)
        channel.is_active = True
        channel.save(update_fields=["is_active", "updated_at"])
        _log_channel_audit(channel.id, "channel.reopened", request.user.id, target_type="channel", target_id=channel.id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChannelMembersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not is_platform_superuser(request.user) and not _can_manage_channel(request.user, channel_id):
            if not ChannelMembership.objects.filter(
                channel_id=channel_id, user=request.user, is_active=True
            ).exists():
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
                **user_badge_flags(m.user),
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
        _log_channel_audit(channel_id, "membership.role_changed", request.user.id, target_type="membership", target_id=membership.id, metadata={"role": role})
        return Response(MembershipSerializer(membership).data)

    def delete(self, request, channel_id: int, member_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        membership = get_object_or_404(ChannelMembership, id=member_id, channel_id=channel_id)
        if membership.role == ChannelMembership.Role.OWNER:
            return Response({"detail": "cannot_remove_owner"}, status=status.HTTP_400_BAD_REQUEST)
        membership.is_active = False
        membership.save(update_fields=["is_active"])
        _log_channel_audit(channel_id, "membership.removed", request.user.id, target_type="membership", target_id=membership.id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class WebPushTestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from apps.common.webpush_service import send_web_push_to_user

        send_web_push_to_user(
            request.user.id,
            title="Stream Music test",
            body="Push notifications are working on this device.",
            url=getattr(django_settings, "FRONTEND_BASE_URL", "/").rstrip("/") + "/dashboard",
            tag="stream-test",
            category="moderation",
        )
        return Response({"detail": "sent"})


class ChannelAuditExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        import csv
        from django.http import HttpResponse

        limit = min(500, max(1, int(request.query_params.get("limit", 200) or 200)))
        rows = ChannelAuditLog.objects.filter(channel_id=channel_id).select_related("actor").order_by("-id")[:limit]
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="channel-{channel_id}-audit.csv"'
        writer = csv.writer(response)
        writer.writerow(["id", "action", "actor", "target_type", "target_id", "created_at"])
        for row in rows:
            writer.writerow(
                [
                    row.id,
                    row.action,
                    row.actor.username if row.actor_id else "",
                    row.target_type,
                    row.target_id,
                    row.created_at.isoformat() if row.created_at else "",
                ]
            )
        return response


class ChannelPartyRecapView(APIView):
    """Public read-only recap for post-party pages (public/unlisted channels)."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if channel.privacy == Channel.Privacy.PRIVATE:
            return Response({"detail": "private"}, status=status.HTTP_403_FORBIDDEN)
        from apps.common.party_recap import build_party_recap

        return Response(build_party_recap(channel))
