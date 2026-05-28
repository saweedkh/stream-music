"""Public profiles, playlist sharing, premium limits (migrating to accounts/playlists domains)."""

from __future__ import annotations

from datetime import timedelta

from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import Channel, ChannelMembership
from apps.common.favorites import UserPlaylistFavorite
from apps.common.serializers import ChannelSerializer, PlaylistItemSerializer, PlaylistSerializer
from apps.common.social_models import ChannelFollow, PlaylistShareLink, UserFollow, UserPublicProfile
from apps.common.user_badges import badges_for_user, is_platform_superuser
from apps.common.views import _can_manage_channel
from apps.discovery.selectors import public_channel_queryset
from apps.playback.models import PlaybackEvent
from apps.playlists.models import Playlist, PlaylistItem

# Re-export for backward compatibility
from apps.discovery.api.views import ExploreFeedView, GlobalSearchView, TrackFacetsView  # noqa: F401
from apps.social.api.views import ChannelFollowView  # noqa: F401


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
                },
                "profile": {
                    "bio": profile.bio,
                    "is_public": profile.is_public,
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


class MePublicProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        profile, _ = UserPublicProfile.objects.get_or_create(user_id=request.user.id)
        if "bio" in request.data:
            profile.bio = str(request.data.get("bio") or "")[:500]
        if "is_public" in request.data:
            profile.is_public = bool(request.data.get("is_public"))
        profile.save()
        return Response({"bio": profile.bio, "is_public": profile.is_public})


class PlaylistShareLinkView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, playlist_id: int):
        playlist = get_object_or_404(Playlist, id=playlist_id)
        if playlist.owner_id != request.user.id:
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        if playlist.channel_id is not None:
            return Response({"detail": "channel_playlist_not_shareable"}, status=status.HTTP_400_BAD_REQUEST)
        hours = int(request.data.get("expires_in_hours") or 0)
        expires_at = timezone.now() + timedelta(hours=hours) if hours > 0 else None
        privacy = request.data.get("privacy") or PlaylistShareLink.Privacy.UNLISTED
        if privacy not in {PlaylistShareLink.Privacy.PUBLIC, PlaylistShareLink.Privacy.UNLISTED}:
            privacy = PlaylistShareLink.Privacy.UNLISTED
        PlaylistShareLink.objects.filter(playlist=playlist, is_active=True).update(is_active=False)
        link = PlaylistShareLink.objects.create(
            playlist=playlist,
            created_by=request.user,
            privacy=privacy,
            expires_at=expires_at,
            is_active=True,
        )
        return Response(
            {
                "token": str(link.token),
                "share_url": f"/share/playlist/{link.token}",
                "privacy": link.privacy,
                "expires_at": link.expires_at.isoformat() if link.expires_at else None,
            }
        )

    def get(self, request, playlist_id: int):
        playlist = get_object_or_404(Playlist, id=playlist_id)
        if playlist.owner_id != request.user.id:
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        link = PlaylistShareLink.objects.filter(playlist=playlist, is_active=True).order_by("-id").first()
        if not link:
            return Response({"active": False})
        return Response(
            {
                "active": True,
                "token": str(link.token),
                "share_url": f"/share/playlist/{link.token}",
                "privacy": link.privacy,
                "expires_at": link.expires_at.isoformat() if link.expires_at else None,
            }
        )


class PlaylistSharePreviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, token: str):
        link = PlaylistShareLink.objects.filter(token=token, is_active=True).select_related("playlist", "playlist__owner").first()
        if not link:
            return Response({"detail": "invalid_share"}, status=status.HTTP_404_NOT_FOUND)
        if link.expires_at and link.expires_at < timezone.now():
            return Response({"detail": "share_expired"}, status=status.HTTP_410_GONE)
        playlist = link.playlist
        items = PlaylistItem.objects.filter(playlist=playlist).select_related("track").order_by("position", "id")[:200]
        return Response(
            {
                "playlist": PlaylistSerializer(playlist, context={"request": request}).data,
                "owner_username": playlist.owner.username,
                "items": PlaylistItemSerializer(items, many=True, context={"request": request}).data,
                "item_count": PlaylistItem.objects.filter(playlist=playlist).count(),
            }
        )


class PlaylistShareImportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        token = (request.data.get("share_token") or "").strip()
        if not token:
            return Response({"detail": "share_token_required"}, status=status.HTTP_400_BAD_REQUEST)
        link = PlaylistShareLink.objects.filter(token=token, is_active=True).select_related("playlist").first()
        if not link:
            return Response({"detail": "invalid_share"}, status=status.HTTP_404_NOT_FOUND)
        if link.expires_at and link.expires_at < timezone.now():
            return Response({"detail": "share_expired"}, status=status.HTTP_410_GONE)
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        if not _can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        src = link.playlist
        dest_name = str(request.data.get("name") or f"{src.name} (imported)")[:255]
        dest = Playlist.objects.create(name=dest_name, owner=request.user, channel_id=channel_id)
        src_items = PlaylistItem.objects.filter(playlist=src).select_related("track").order_by("position", "id")
        for i, item in enumerate(src_items):
            PlaylistItem.objects.create(playlist=dest, track=item.track, position=i)
        return Response({"playlist": PlaylistSerializer(dest, context={"request": request}).data})


class PremiumLimitsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.common.premium_limits import user_has_premium

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
