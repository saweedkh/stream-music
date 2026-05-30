"""Track retrieve, update, and delete."""

from __future__ import annotations

from rest_framework import generics, permissions

from apps.accounts.selectors import favorited_track_ids
from apps.tracks.selectors import tracks_list_queryset
from apps.tracks.tracks.track_serializers import TrackSerializer


class TrackRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TrackSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = "track_id"

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        user = self.request.user
        if getattr(user, "is_authenticated", False):
            ctx["favorited_track_ids"] = favorited_track_ids(user)
        return ctx

    def get_queryset(self):
        return tracks_list_queryset(self.request.user, self.request.query_params)
