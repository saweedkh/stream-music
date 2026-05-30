"""Channel API — ChannelAuditLogView."""

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import (
    ChannelAuditLog,
)
from apps.channels.permissions import can_manage_channel
from apps.channels.serializers.channel_serializers import (
    ChannelAuditLogSerializer,
)


class ChannelAuditLogView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        limit = min(200, max(1, int(request.query_params.get("limit", 80) or 80)))
        rows = ChannelAuditLog.objects.filter(channel_id=channel_id).select_related("actor").order_by("-id")[:limit]
        return Response({"results": ChannelAuditLogSerializer(rows, many=True).data})
