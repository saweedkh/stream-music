"""Playlist favorite toggle."""

from __future__ import annotations

from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.accounts.models import UserPlaylistFavorite
from apps.accounts.selectors import favorited_playlist_ids
from apps.playlists.playlists.playlist_serializers import PlaylistSerializer
from apps.playlists.selectors import playlist_list_queryset, playlist_visible_to_user


class PlaylistFavoriteView(generics.GenericAPIView):
    serializer_class = PlaylistSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = "playlist_id"

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        user = self.request.user
        if getattr(user, "is_authenticated", False):
            ctx["favorited_playlist_ids"] = favorited_playlist_ids(user)
        return ctx

    def get_queryset(self):
        return playlist_list_queryset(self.request.user)

    def post(self, request, *args, **kwargs):
        playlist = self.get_object()
        if not playlist_visible_to_user(request.user, playlist):
            raise PermissionDenied("permission_denied")
        UserPlaylistFavorite.objects.get_or_create(user=request.user, playlist=playlist)
        return Response({"is_favorited": True})

    def delete(self, request, *args, **kwargs):
        playlist = self.get_object()
        if not playlist_visible_to_user(request.user, playlist):
            raise PermissionDenied("permission_denied")
        UserPlaylistFavorite.objects.filter(user=request.user, playlist=playlist).delete()
        return Response({"is_favorited": False}, status=status.HTTP_200_OK)
