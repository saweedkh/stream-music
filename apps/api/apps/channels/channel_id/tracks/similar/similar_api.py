"""Channel API — ChannelSimilarTracksView."""

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.user_badges import is_platform_superuser
from apps.channels.helpers import (
    _channel_closed_response,
)
from apps.channels.models import (
    Channel,
    ChannelMembership,
)
from apps.playlists.playlists.playlist_serializers import TrackSerializer
from apps.tracks.models import Track


class ChannelSimilarTracksView(APIView):
    """Tracks in this channel's playlists that share the same artist string as `from_track`."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active and channel.owner_id != request.user.id:
            return _channel_closed_response()
        if (
            not is_platform_superuser(request.user)
            and not ChannelMembership.objects.filter(channel=channel, user=request.user, is_active=True).exists()
        ):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        from_track_id = request.query_params.get("from_track")
        if not from_track_id:
            return Response({"results": []})
        try:
            tid = int(from_track_id)
        except (TypeError, ValueError):
            return Response({"results": []})
        ref = Track.objects.filter(id=tid).first()
        if ref is None:
            return Response({"results": []})
        artist = (ref.artist or "").strip()
        if not artist:
            return Response({"results": []})
        qs = (
            Track.objects.filter(playlist_items__playlist__channel_id=channel.id)
            .exclude(id=ref.id)
            .filter(artist__iexact=artist)
            .distinct()
            .order_by("title")[:24]
        )
        return Response({"results": TrackSerializer(qs, many=True, context={"request": request}).data})
