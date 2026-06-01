"""Channel API — ChannelPlaybackHistoryView."""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.user_badges import is_platform_superuser
from apps.channels.models import (
    ChannelMembership,
)
from apps.playback.models import PlaybackEvent
from apps.playback.serializers.playback_serializers import PlaybackEventSerializer


class ChannelPlaybackHistoryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if (
            not is_platform_superuser(request.user)
            and not ChannelMembership.objects.filter(channel_id=channel_id, user=request.user, is_active=True).exists()
        ):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        limit = min(200, max(1, int(request.query_params.get("limit", 60) or 60)))
        rows = (
            PlaybackEvent.objects.filter(channel_id=channel_id).select_related("actor", "track").order_by("-id")[:limit]
        )
        return Response({"results": PlaybackEventSerializer(rows, many=True).data})
