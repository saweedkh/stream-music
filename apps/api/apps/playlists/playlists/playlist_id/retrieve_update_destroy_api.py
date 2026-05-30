"""Playlist retrieve, update, and delete."""

from __future__ import annotations

from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied

from apps.accounts.selectors import favorited_playlist_ids
from apps.channels.permissions import can_edit_channel_playlist, can_manage_channel
from apps.playlists.playlists.playlist_serializers import PlaylistSerializer
from apps.playlists.selectors import playlist_list_queryset


class PlaylistRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
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

    def perform_update(self, serializer):
        playlist = self.get_object()
        user = self.request.user
        if "channel" in serializer.validated_data:
            new_channel = serializer.validated_data.get("channel")
            if new_channel is not None and not can_manage_channel(user, new_channel.id):
                raise PermissionDenied("permission_denied")
            if playlist.channel_id is None and new_channel is not None and playlist.owner_id != user.id:
                raise PermissionDenied("permission_denied")
        if not can_edit_channel_playlist(user, playlist):
            raise PermissionDenied("permission_denied")
        serializer.save()

    def perform_destroy(self, instance):
        if not can_edit_channel_playlist(self.request.user, instance):
            raise PermissionDenied("permission_denied")
        instance.delete()
