"""Playlist public share links."""

from __future__ import annotations

from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import Channel, ChannelMembership
from apps.common.serializers import PlaylistItemSerializer, PlaylistSerializer
from apps.playlists.models import PlaylistShareLink
from apps.accounts.user_badges import is_platform_superuser
from apps.channels.api.helpers import _can_manage_channel
from apps.playlists.models import Playlist, PlaylistItem


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
        if not is_platform_superuser(request.user) and not ChannelMembership.objects.filter(
            channel_id=channel_id, user=request.user, is_active=True
        ).exists():
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
