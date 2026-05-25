"""Global search, public profiles, playlist sharing, channel follows."""

from __future__ import annotations

from datetime import timedelta

from django.contrib.auth.models import User
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import Channel, ChannelMembership
from apps.common.premium_limits import can_create_channel, clamp_member_limit, user_has_premium
from apps.common.user_badges import is_platform_superuser
from apps.common.serializers import ChannelSerializer, PlaylistItemSerializer, PlaylistSerializer, TrackSerializer
from apps.common.favorites import UserPlaylistFavorite
from apps.common.social_models import ChannelFollow, PlaylistShareLink, UserFollow, UserPublicProfile
from apps.playback.models import PlaybackEvent
from apps.common.user_badges import badges_for_user
from apps.common.views import _can_manage_channel
from apps.playback.services.channel_queue import tracks_accessible_to_user
from apps.playlists.models import Playlist, PlaylistItem
from apps.tracks.models import Track


def _public_channel_qs():
    return (
        Channel.objects.filter(is_active=True, privacy=Channel.Privacy.PUBLIC)
        .exclude(Q(name__iexact="E2E") | Q(name__istartswith="E2E Room") | Q(name__istartswith="E2E "))
        .select_related("owner")
    )


class GlobalSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        if len(q) < 2:
            return Response({"tracks": [], "playlists": [], "channels": [], "users": [], "shared_playlists": []})
        user = request.user
        track_qs = tracks_accessible_to_user(user).filter(
            Q(title__icontains=q) | Q(artist__icontains=q) | Q(album__icontains=q) | Q(genre__icontains=q)
        )[:20]
        playlist_qs = Playlist.objects.filter(owner=user, channel__isnull=True, name__icontains=q)[:15]
        member_ids = list(
            Channel.objects.filter(memberships__user=user, memberships__is_active=True)
            .filter(Q(name__icontains=q) | Q(description__icontains=q))
            .distinct()
            .values_list("id", flat=True)[:15]
        )
        pub_ids = list(
            _public_channel_qs()
            .filter(Q(name__icontains=q) | Q(description__icontains=q))
            .exclude(id__in=member_ids)
            .values_list("id", flat=True)[:10]
        )
        channel_ids = list(member_ids) + list(pub_ids)
        channel_rows = Channel.objects.filter(id__in=channel_ids).select_related("owner") if channel_ids else []
        user_rows = (
            User.objects.filter(is_active=True, public_profile__is_public=True)
            .filter(Q(username__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q))
            .select_related("public_profile")[:12]
        )
        users = [
            {
                "id": u.id,
                "username": u.username,
                "display_name": (u.get_full_name() or u.username).strip(),
            }
            for u in user_rows
        ]
        shared_links = (
            PlaylistShareLink.objects.filter(is_active=True, playlist__name__icontains=q)
            .select_related("playlist", "playlist__owner")
            .order_by("-created_at")[:12]
        )
        shared_playlists = [
            {
                "token": str(link.token),
                "playlist_name": link.playlist.name if link.playlist else "",
                "owner_username": link.playlist.owner.username if link.playlist and link.playlist.owner_id else "",
            }
            for link in shared_links
        ]
        return Response(
            {
                "tracks": TrackSerializer(track_qs, many=True, context={"request": request}).data,
                "playlists": PlaylistSerializer(playlist_qs, many=True, context={"request": request}).data,
                "channels": ChannelSerializer(channel_rows, many=True, context={"request": request}).data,
                "users": users,
                "shared_playlists": shared_playlists,
            }
        )


class TrackFacetsView(APIView):
    """Distinct genre/album values for library filters."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = tracks_accessible_to_user(request.user)
        genres = sorted({g for g in qs.exclude(genre="").values_list("genre", flat=True) if g})
        albums = sorted({a for a in qs.exclude(album="").values_list("album", flat=True)[:500] if a})
        tags: set[str] = set()
        for raw in qs.values_list("tags", flat=True)[:300]:
            if isinstance(raw, list):
                for t in raw:
                    if isinstance(t, str) and t.strip():
                        tags.add(t.strip())
        return Response({"genres": genres, "albums": albums[:200], "tags": sorted(tags)[:100]})


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
            owned_public = _public_channel_qs().filter(owner_id=user.id).select_related("owner")[:30]
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
    """Copy shared playlist tracks into a channel playlist or personal library playlist."""

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


class ChannelFollowView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if not is_platform_superuser(request.user) and channel.privacy != Channel.Privacy.PUBLIC and not ChannelMembership.objects.filter(
            channel=channel, user=request.user, is_active=True
        ).exists():
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        row = ChannelFollow.objects.filter(channel_id=channel_id, user_id=request.user.id).first()
        follower_count = ChannelFollow.objects.filter(channel_id=channel_id).count()
        return Response(
            {
                "following": row is not None,
                "notify_live": row.notify_live if row else True,
                "follower_count": follower_count,
            }
        )

    def post(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if channel.privacy != Channel.Privacy.PUBLIC:
            return Response({"detail": "only_public_channels"}, status=status.HTTP_400_BAD_REQUEST)
        notify = request.data.get("notify_live", True)
        row, created = ChannelFollow.objects.get_or_create(
            channel_id=channel_id,
            user_id=request.user.id,
            defaults={"notify_live": bool(notify)},
        )
        if not created and "notify_live" in request.data:
            row.notify_live = bool(request.data.get("notify_live"))
            row.save(update_fields=["notify_live"])
        return Response({"following": True, "notify_live": row.notify_live}, status=status.HTTP_201_CREATED)

    def delete(self, request, channel_id: int):
        ChannelFollow.objects.filter(channel_id=channel_id, user_id=request.user.id).delete()
        return Response({"following": False})


class PremiumLimitsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.channels.models import Channel

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
