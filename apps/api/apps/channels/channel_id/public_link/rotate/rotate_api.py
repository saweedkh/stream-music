"""Channel API — ChannelPublicLinkRotateView."""

import uuid

from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.channels.models import (
    Channel,
)
from apps.channels.permissions import can_manage_channel


class ChannelPublicLinkRotateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, channel_id: int):
        if not can_manage_channel(request.user, channel_id):
            return Response({"detail": "permission_denied"}, status=status.HTTP_403_FORBIDDEN)
        channel = get_object_or_404(Channel, id=channel_id)
        channel.public_slug = uuid.uuid4()
        channel.save(update_fields=["public_slug", "updated_at"])
        return Response({"public_url": f"/join/public/{channel.public_slug}"})
