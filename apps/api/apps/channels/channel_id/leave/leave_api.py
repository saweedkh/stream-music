"""Channel API — ChannelLeaveView."""

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.helpers import (
    _log_channel_audit,
)
from apps.channels.models import (
    Channel,
    ChannelMembership,
)


class ChannelLeaveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        channel = get_object_or_404(Channel, id=channel_id)
        membership = ChannelMembership.objects.filter(channel=channel, user=request.user, is_active=True).first()
        if not membership:
            return Response({"detail": "not_a_member"}, status=status.HTTP_400_BAD_REQUEST)
        if channel.owner_id == request.user.id or membership.role == ChannelMembership.Role.OWNER:
            return Response({"detail": "owner_cannot_leave"}, status=status.HTTP_400_BAD_REQUEST)
        membership.is_active = False
        membership.save(update_fields=["is_active"])
        _log_channel_audit(
            channel.id, "membership.leave", request.user.id, target_type="membership", target_id=membership.id
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
