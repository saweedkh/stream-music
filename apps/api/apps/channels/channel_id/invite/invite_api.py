"""Channel API — ChannelInviteView."""

from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import (
    Channel,
    InviteToken,
)
from apps.channels.permissions import can_manage_channel
from apps.channels.serializers.channel_serializers import (
    InviteTokenSerializer,
)


class ChannelInviteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        if not can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        max_uses = int(request.data.get("max_uses", 0) or 0)
        expires_in_hours = int(request.data.get("expires_in_hours", 0) or 0)
        expires_at = timezone.now() + timedelta(hours=expires_in_hours) if expires_in_hours > 0 else None
        invite = InviteToken.objects.create(
            channel=channel,
            created_by=request.user,
            max_uses=max_uses,
            expires_at=expires_at,
            is_active=True,
        )
        return Response(
            {
                "token": str(invite.token),
                "invite_url": f"/join/private/{invite.token}",
                "invite": InviteTokenSerializer(invite).data,
            }
        )

    def get(self, request, channel_id: int):
        if not can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        invites = InviteToken.objects.filter(channel_id=channel_id).order_by("-created_at")[:20]
        return Response({"results": InviteTokenSerializer(invites, many=True).data})
