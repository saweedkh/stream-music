"""Channel API — ChannelInviteRotateView."""

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import (
    Channel,
    InviteToken,
)
from apps.channels.permissions import can_manage_channel


class ChannelInviteRotateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        if not can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        InviteToken.objects.filter(channel=channel, is_active=True).update(is_active=False)
        invite = InviteToken.objects.create(channel=channel, created_by=request.user, is_active=True)
        return Response({"token": str(invite.token), "invite_url": f"/join/private/{invite.token}"})
