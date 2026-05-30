"""Channel API — ChannelJoinRequestRejectView."""

from __future__ import annotations

from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import ChannelJoinRequest
from apps.channels.permissions import can_manage_channel


class ChannelJoinRequestRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int, request_id: int):
        if not can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        join_req = ChannelJoinRequest.objects.filter(
            id=request_id, channel_id=channel_id, status=ChannelJoinRequest.Status.PENDING
        ).first()
        if not join_req:
            return Response({"detail": "not_found"}, status=status.HTTP_404_NOT_FOUND)
        join_req.status = ChannelJoinRequest.Status.REJECTED
        join_req.resolved_at = timezone.now()
        join_req.resolved_by = request.user
        join_req.save(update_fields=["status", "resolved_at", "resolved_by"])
        return Response({"detail": "rejected"}, status=status.HTTP_200_OK)
