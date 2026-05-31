"""Public user profiles and premium limits."""

from __future__ import annotations

from django.contrib.auth.models import User
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import Channel, ChannelMembership
from apps.accounts.models import UserPlaylistFavorite
from apps.channels.api.serializers import ChannelSerializer
from apps.playlists.api.serializers import PlaylistSerializer
from apps.social.models import ChannelFollow, UserFollow, UserPublicProfile
from apps.social.services.avatar import avatar_url_for, validate_avatar_upload
from apps.accounts.user_badges import badges_for_user
from apps.discovery.selectors import public_channel_queryset
from apps.playback.models import PlaybackEvent
from apps.playlists.models import Playlist


class PublicUserProfileView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, username: str):
        user = User.objects.filter(username__iexact=username).first()
        if user is None:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        profile, _ = UserPublicProfile.objects.get_or_create(user_id=user.id)
        is_self = request.user.is_authenticated and request.user.id == user.id
        if not profile.is_public and not is_self:
            return Response({"detail": "profile_private"}, status=status.HTTP_403_FORBIDDEN)
        channels = []
        if profile.is_public or is_self:
            owned_public = public_channel_queryset().filter(owner_id=user.id).select_related("owner")[:30]
            channels = ChannelSerializer(owned_public, many=True, context={"request": request}).data
        following_count = 0
        user_following = False
        follower_count = 0
        if is_self:
            following_count = ChannelFollow.objects.filter(user_id=user.id).count()
        if profile.is_public or is_self:
            follower_count = UserFollow.objects.filter(following_id=user.id).count()
            if request.user.is_authenticated and not is_self:
                user_following = UserFollow.objects.filter(
                    follower_id=request.user.id,
                    following_id=user.id,
                ).exists()
        sessions_joined = (
            ChannelMembership.objects.filter(user_id=user.id, is_active=True).count()
            if profile.is_public or is_self
            else 0
        )
        tracks_played = (
            PlaybackEvent.objects.filter(actor_id=user.id, track_id__isnull=False).values("track_id").distinct().count()
            if profile.is_public or is_self
            else 0
        )
        public_playlists = []
        if profile.is_public or is_self:
            fav_ids = UserPlaylistFavorite.objects.filter(user_id=user.id).values_list("playlist_id", flat=True)[:30]
            pub_pl = (
                Playlist.objects.filter(owner_id=user.id, channel__isnull=True, id__in=fav_ids)
                .order_by("-created_at")[:20]
            )
            public_playlists = PlaylistSerializer(pub_pl, many=True, context={"request": request}).data
        return Response(
            {
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "badges": badges_for_user(user),
                    "date_joined": user.date_joined.isoformat() if user.date_joined else None,
                    "avatar_url": avatar_url_for(profile, request=request),
                },
                "profile": {
                    "bio": profile.bio,
                    "is_public": profile.is_public,
                    "avatar_url": avatar_url_for(profile, request=request),
                },
                "public_channels": channels,
                "public_playlists": public_playlists,
                "stats": {
                    "sessions_joined": sessions_joined,
                    "tracks_played": tracks_played,
                    "channel_follows": following_count if is_self else None,
                    "user_followers": follower_count,
                },
                "following_count": following_count,
                "follower_count": follower_count,
                "user_following": user_following,
                "is_self": is_self,
            }
        )


def _request_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).lower() in ("1", "true", "yes", "on")


def _public_profile_payload(profile, *, request) -> dict:
    return {
        "bio": profile.bio,
        "is_public": profile.is_public,
        "avatar_url": avatar_url_for(profile, request=request),
    }


class MePublicProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        from django.core.exceptions import ValidationError as DjangoValidationError

        profile, _ = UserPublicProfile.objects.get_or_create(user_id=request.user.id)
        if "bio" in request.data:
            profile.bio = str(request.data.get("bio") or "")[:500]
        if "is_public" in request.data:
            profile.is_public = _request_bool(request.data.get("is_public"))
        if _request_bool(request.data.get("avatar_clear")):
            if profile.avatar:
                profile.avatar.delete(save=False)
                profile.avatar = None
        uploaded = getattr(request, "FILES", {}).get("avatar")
        if uploaded is not None:
            try:
                validate_avatar_upload(uploaded)
            except DjangoValidationError as exc:
                code = exc.messages[0] if exc.messages else "avatar_invalid"
                return Response({"detail": str(code)}, status=status.HTTP_400_BAD_REQUEST)
            if profile.avatar:
                profile.avatar.delete(save=False)
            profile.avatar = uploaded
        profile.save()
        return Response(_public_profile_payload(profile, request=request))


class PremiumLimitsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.accounts.premium_limits import user_has_premium

        owned = Channel.objects.filter(owner_id=request.user.id).count()
        premium = user_has_premium(request.user)
        return Response(
            {
                "is_premium": premium,
                "owned_channels": owned,
                "max_owned_channels": 50 if premium else 5,
                "max_member_limit": 200 if premium else 50,
                "premium_queue_boost": premium,
            }
        )
