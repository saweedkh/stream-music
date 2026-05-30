"""Channel API — ChannelJoinRequestListView."""

from __future__ import annotations

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import ChannelJoinRequest
from apps.channels.permissions import can_manage_channel
from apps.channels.serializers.channel_serializers import ChannelJoinRequestSerializer


class ChannelJoinRequestListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        pending = (
            ChannelJoinRequest.objects.filter(channel_id=channel_id, status=ChannelJoinRequest.Status.PENDING)
            .select_related("user")
            .order_by("created_at")
        )
        return Response({"results": ChannelJoinRequestSerializer(pending, many=True).data})
