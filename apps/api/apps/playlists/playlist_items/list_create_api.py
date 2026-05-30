"""Playlist item list and create."""

from __future__ import annotations

from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied

from apps.channels.permissions import can_edit_channel_playlist
from apps.playlists.playlists.playlist_serializers import PlaylistItemSerializer
from apps.playlists.selectors import playlist_item_queryset
from apps.tracks.models import Track


class PlaylistItemListCreateView(generics.ListCreateAPIView):
    serializer_class = PlaylistItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return playlist_item_queryset(self.request.user, playlist_id=self.request.query_params.get("playlist"))

    def perform_create(self, serializer):
        playlist = serializer.validated_data["playlist"]
        track = serializer.validated_data["track"]
        if not can_edit_channel_playlist(self.request.user, playlist):
            raise PermissionDenied("permission_denied")
        can_use_track = track.owner_id == self.request.user.id or track.visibility in {
            Track.Visibility.PUBLIC_LAN,
            Track.Visibility.SHARED_WITH_CHANNELS,
            Track.Visibility.SHARED_WITH_USERS,
        }
        if not can_use_track:
            raise PermissionDenied("track_not_visible")
        serializer.save()
