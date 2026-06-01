"""Assign playlist to a channel."""

from __future__ import annotations

from rest_framework import generics, permissions, status
from rest_framework.response import Response

from apps.accounts.selectors import favorited_playlist_ids
from apps.playlists.playlists.playlist_serializers import PlaylistSerializer
from apps.playlists.selectors import playlist_inaccessible_track_ids, playlist_list_queryset
from apps.playlists.services import assign_playlist_to_channel


class PlaylistAssignToChannelView(generics.GenericAPIView):
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
        source = self.get_object()
        try:
            channel_id = int(request.data.get("channel_id"))
        except (TypeError, ValueError):
            return Response({"detail": "channel_id_required"}, status=status.HTTP_400_BAD_REQUEST)
        blocked = playlist_inaccessible_track_ids(request.user, source)
        if blocked:
            return Response(
                {"detail": "playlist_has_inaccessible_tracks", "inaccessible_count": len(blocked)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        updated, err, http_status = assign_playlist_to_channel(request.user, source, channel_id)
        if err:
            body = {"detail": err}
            if err == "playlist_has_inaccessible_tracks":
                body["inaccessible_count"] = len(blocked)
            return Response(body, status=http_status or status.HTTP_400_BAD_REQUEST)
        return Response(PlaylistSerializer(updated, context=self.get_serializer_context()).data)
