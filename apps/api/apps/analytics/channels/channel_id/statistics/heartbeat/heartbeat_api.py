"""Client-reported listen heartbeat for accurate totals."""

from __future__ import annotations

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analytics.services.listen_metrics import record_listen_seconds
from apps.channels.models import Channel, ChannelMembership


class ChannelListenHeartbeatView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        if not channel.is_active:
            return Response({"detail": "channel_closed"}, status=status.HTTP_400_BAD_REQUEST)
        if not ChannelMembership.objects.filter(
            channel_id=channel_id, user=request.user, is_active=True
        ).exists():
            return Response({"detail": "not_a_member"}, status=status.HTTP_403_FORBIDDEN)
        try:
            seconds = int(request.data.get("seconds") or 0)
        except (TypeError, ValueError):
            return Response({"detail": "invalid_seconds"}, status=status.HTTP_400_BAD_REQUEST)
        track_id = request.data.get("track_id")
        tid = int(track_id) if track_id is not None else None
        record_listen_seconds(
            channel_id,
            request.user.id,
            seconds,
            track_id=tid,
            count_as_play=False,
        )
        return Response({"ok": True, "recorded_seconds": max(0, min(seconds, 120))})
