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

