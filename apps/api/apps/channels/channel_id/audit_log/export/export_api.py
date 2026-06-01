"""Channel API — ChannelAuditExportView."""

import csv

from django.http import HttpResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import (
    ChannelAuditLog,
)
from apps.channels.permissions import can_manage_channel


class ChannelAuditExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, channel_id: int):
        if not can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)

        limit = min(500, max(1, int(request.query_params.get("limit", 200) or 200)))
        rows = ChannelAuditLog.objects.filter(channel_id=channel_id).select_related("actor").order_by("-id")[:limit]
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="channel-{channel_id}-audit.csv"'
        writer = csv.writer(response)
        writer.writerow(["id", "action", "actor", "target_type", "target_id", "created_at"])
        for row in rows:
            writer.writerow(
                [
                    row.id,
                    row.action,
                    row.actor.username if row.actor_id else "",
                    row.target_type,
                    row.target_id,
                    row.created_at.isoformat() if row.created_at else "",
                ]
            )
        return response
