"""Premium / owner detailed channel analytics."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analytics.selectors import build_detailed_channel_stats
from apps.channels.models import Channel


class ChannelStatisticsDetailedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        get_object_or_404(Channel, id=channel_id)
        payload = build_detailed_channel_stats(channel_id, request.user)
        if payload is None:
            return Response(
                {"detail": "premium_or_owner_required"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response(payload)
