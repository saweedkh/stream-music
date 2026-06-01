"""Channel API — ChannelPartyRecapView."""

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import (
    Channel,
)
from apps.channels.services.party_recap import build_party_recap


class ChannelPartyRecapView(APIView):
    """Public read-only recap for post-party pages (public/unlisted channels)."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if channel.privacy == Channel.Privacy.PRIVATE:
            return Response({"detail": "private"}, status=status.HTTP_403_FORBIDDEN)

        return Response(build_party_recap(channel))
