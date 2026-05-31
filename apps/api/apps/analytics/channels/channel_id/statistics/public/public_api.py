"""Public channel listen statistics."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analytics.selectors import build_public_channel_stats
from apps.channels.models import Channel


class ChannelStatisticsPublicView(APIView):
    """Anyone authenticated (or allow anonymous for public channels — keep auth for now)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if channel.privacy == Channel.Privacy.PRIVATE:
            from apps.channels.models import ChannelMembership

            if not ChannelMembership.objects.filter(
                channel_id=channel_id, user=request.user, is_active=True
            ).exists():
                return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        return Response(build_public_channel_stats(channel_id))
