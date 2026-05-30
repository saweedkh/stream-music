"""Track favorite toggle."""

from __future__ import annotations

from rest_framework import generics, permissions, status
from rest_framework.response import Response

from apps.accounts.models import UserTrackFavorite
from apps.tracks.selectors import tracks_list_queryset
from apps.tracks.tracks.track_serializers import TrackSerializer


class TrackFavoriteView(generics.GenericAPIView):
    serializer_class = TrackSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_url_kwarg = "track_id"

    def get_queryset(self):
        return tracks_list_queryset(self.request.user, self.request.query_params)

    def post(self, request, *args, **kwargs):
        track = self.get_object()
        UserTrackFavorite.objects.get_or_create(user=request.user, track=track)
        return Response({"is_favorited": True})

    def delete(self, request, *args, **kwargs):
        track = self.get_object()
        UserTrackFavorite.objects.filter(user=request.user, track=track).delete()
        return Response({"is_favorited": False}, status=status.HTTP_200_OK)
