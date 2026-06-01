"""Track share permissions."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tracks.models import Track
from apps.tracks.services import create_track_share, delete_track_share, list_track_shares
from apps.tracks.tracks.track_serializers import TrackSharePermissionSerializer


class TrackSharePermissionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, track_id: int):
        track = get_object_or_404(Track, id=track_id, owner=request.user)
        shares = list_track_shares(track)
        return Response({"results": TrackSharePermissionSerializer(shares, many=True).data})

    def post(self, request, track_id: int):
        track = get_object_or_404(Track, id=track_id, owner=request.user)
        user_id = request.data.get("user_id")
        channel_id = request.data.get("channel_id")
        try:
            uid = int(user_id) if user_id not in (None, "") else None
        except (TypeError, ValueError):
            return Response({"detail": "invalid_user_id"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            cid = int(channel_id) if channel_id not in (None, "") else None
        except (TypeError, ValueError):
            return Response({"detail": "invalid_channel_id"}, status=status.HTTP_400_BAD_REQUEST)
        share, err, http_status = create_track_share(
            request.user,
            track,
            user_id=uid,
            channel_id=cid,
        )
        if err:
            return Response({"detail": err}, status=http_status or status.HTTP_400_BAD_REQUEST)
        return Response(TrackSharePermissionSerializer(share).data, status=status.HTTP_201_CREATED)

    def delete(self, request, track_id: int):
        track = get_object_or_404(Track, id=track_id, owner=request.user)
        share_id = request.data.get("share_id")
        if not share_id:
            return Response({"detail": "share_id_required"}, status=status.HTTP_400_BAD_REQUEST)
        ok, err = delete_track_share(track, int(share_id))
        if not ok:
            return Response({"detail": err}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)
