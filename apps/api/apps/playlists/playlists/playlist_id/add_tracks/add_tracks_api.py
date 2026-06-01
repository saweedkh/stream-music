"""Bulk-add tracks to a playlist."""

from __future__ import annotations

from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.channels.permissions import can_edit_channel_playlist
from apps.playlists.playlists.playlist_serializers import PlaylistSerializer
from apps.playlists.selectors import PLAYLIST_BULK_ADD_MAX, playlist_list_queryset
from apps.playlists.services import bulk_add_tracks_to_playlist


class PlaylistAddTracksView(generics.GenericAPIView):
    serializer_class = PlaylistSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = "playlist_id"

    def get_queryset(self):
        return playlist_list_queryset(self.request.user)

    def post(self, request, *args, **kwargs):
        playlist = self.get_object()
        if not can_edit_channel_playlist(request.user, playlist):
            raise PermissionDenied("permission_denied")
        result, err, max_hint = bulk_add_tracks_to_playlist(request.user, playlist, request.data.get("track_ids"))
        if err == "too_many_tracks":
            return Response(
                {"detail": err, "max": max_hint or PLAYLIST_BULK_ADD_MAX},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if err:
            return Response({"detail": err}, status=status.HTTP_400_BAD_REQUEST)
        assert result is not None
        return Response(
            {
                "added": result.added,
                "requested": result.requested,
                "skipped_not_allowed": result.skipped_not_allowed,
            }
        )
