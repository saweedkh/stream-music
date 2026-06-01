"""Playlist list and create."""

from __future__ import annotations

from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied

from apps.accounts.selectors import favorited_playlist_ids
from apps.playlists.playlists.playlist_serializers import PlaylistSerializer
from apps.playlists.selectors import playlist_list_queryset


class PlaylistListCreateView(generics.ListCreateAPIView):
    serializer_class = PlaylistSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        user = self.request.user
        if getattr(user, "is_authenticated", False):
            ctx["favorited_playlist_ids"] = favorited_playlist_ids(user)
        return ctx

    def get_queryset(self):
        fav = (self.request.query_params.get("favorited") or "").strip().lower() in ("1", "true", "yes")
        return playlist_list_queryset(
            self.request.user,
            channel_id=self.request.query_params.get("channel"),
            favorited_only=fav,
        )

    def perform_create(self, serializer):
        from apps.channels.permissions import can_manage_channel

        channel = serializer.validated_data.get("channel")
        if channel is not None and not can_manage_channel(self.request.user, channel.id):
            raise PermissionDenied("permission_denied")
        serializer.save(owner=self.request.user)
