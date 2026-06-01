"""Playlist item retrieve, update, and delete."""

from __future__ import annotations

from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.channels.permissions import can_edit_channel_playlist
from apps.playlists.playlists.playlist_serializers import PlaylistItemSerializer
from apps.playlists.selectors import playlist_item_queryset
from apps.playlists.services import reorder_playlist_item


class PlaylistItemRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PlaylistItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = "item_id"

    def get_queryset(self):
        return playlist_item_queryset(self.request.user, playlist_id=self.request.query_params.get("playlist"))

    def partial_update(self, request, *args, **kwargs):
        item = self.get_object()
        if not can_edit_channel_playlist(request.user, item.playlist):
            raise PermissionDenied("permission_denied")
        if "position" not in request.data:
            return super().partial_update(request, *args, **kwargs)
        item = reorder_playlist_item(item, request.data.get("position", 0))
        return Response(PlaylistItemSerializer(item).data)

    def perform_destroy(self, instance):
        if not can_edit_channel_playlist(self.request.user, instance.playlist):
            raise PermissionDenied("permission_denied")
        instance.delete()
